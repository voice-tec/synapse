import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { askClaudeJSON } from '@/lib/anthropic';
import { macroSnapshot } from '@/lib/fred';

// Vercel cron — ogni giorno (vedi vercel.json), ma ogni watch viene
// ricontrollata al più una volta a settimana (filtro su last_checked_at):
// il cron giornaliero serve solo a spalmare il carico.
// Stesso modello di /api/analyze (sonnet): un modello diverso produrrebbe
// falsi flip per differenze di giudizio, non per cambi reali del quadro.

export const maxDuration = 300;

const RECHECK_DAYS = 6;
const BATCH = 15; // tetto per run: limita costo e durata

const SYS = `You are the analysis engine of Synapse, a financial intelligence platform.
You previously answered an investment question with a verdict. Re-evaluate ONLY the verdict with today's data. Use web_search if current data is needed.

Return ONLY valid JSON, no extra text:
{"stance":"si|no|dipende","label":"the direct answer in ONE Italian sentence, max 12 words","confidence":"alta|media|bassa","changed_because":"if your stance differs from the previous one, ONE Italian sentence explaining what changed; null otherwise"}`;

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const staleBefore = new Date(Date.now() - RECHECK_DAYS * 24 * 3600 * 1000).toISOString();
  const { data: watches, error } = await admin
    .from('watches')
    .select('id, query, last_stance, last_label')
    .eq('active', true)
    .lt('last_checked_at', staleBefore)
    .order('last_checked_at', { ascending: true })
    .limit(BATCH);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!watches?.length) return NextResponse.json({ ok: true, checked: 0 });

  const macro = await macroSnapshot();
  const system = [
    { type: 'text', text: SYS },
    { type: 'text', text: `Today's date: ${new Date().toISOString().slice(0, 10)}.` },
    ...(macro ? [{ type: 'text', text: macro }] : []),
  ];

  let checked = 0, flips = 0;
  for (const w of watches) {
    try {
      const { json: v } = await askClaudeJSON({
        model: 'claude-sonnet-4-6',
        system,
        user: `Question: "${w.query}"\nPrevious verdict: stance=${w.last_stance || '—'}, label="${w.last_label || '—'}"\n\nRe-evaluate the verdict now.`,
        maxTokens: 600,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }],
      });

      const update: any = {
        last_stance: v.stance || w.last_stance,
        last_label: v.label || w.last_label,
        last_confidence: v.confidence || null,
        last_checked_at: new Date().toISOString(),
      };
      // Flip: la stance è cambiata davvero (e c'era una stance precedente).
      // Non sovrascrivere un flip ancora non visto dall'utente.
      if (w.last_stance && v.stance && v.stance !== w.last_stance) {
        update.flip = {
          old_stance: w.last_stance,
          new_stance: v.stance,
          new_label: v.label || null,
          why: v.changed_because || null,
          detected_at: new Date().toISOString(),
        };
        update.flip_seen = false;
        flips++;
      }
      await admin.from('watches').update(update).eq('id', w.id);
      checked++;
    } catch (e) {
      // singola watch fallita (API giù, JSON rotto): si riprova al giro dopo
      await admin.from('watches')
        .update({ last_checked_at: new Date().toISOString() })
        .eq('id', w.id);
    }
  }

  return NextResponse.json({ ok: true, checked, flips });
}
