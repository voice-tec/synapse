'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { STYLE } from './synapse/style';
import { BODY } from './synapse/body';


export default function SynapsePage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const supabase = createClient();

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      // Inject BODY into the container. If the ref isn't ready yet, the canvas
      // won't exist — the waitForCanvas polling below handles that safely.
      if (containerRef.current) {
        containerRef.current.innerHTML = BODY;
      }
      const styleEl = document.createElement('style');
      styleEl.textContent = STYLE;
      if (!document.getElementById('__syn_main_style')) {
        styleEl.id = '__syn_main_style';
        document.head.appendChild(styleEl);
      }

      (window as any).__synSaveTask = async (task: any) => {
        try {
          const { data: saved } = await supabase.from('tasks').insert({
            user_id: user.id, raw_query: task.raw_query, intent: task.intent,
            fingerprint: task.fingerprint, output: task.output,
            origin_kind: task.originKind || null, origin_ref: task.originRef || null,
          }).select().single();
          if (saved) {
            const oldId = task.id; task.id = saved.id;
            const NODES = (window as any).NODES;
            if (NODES) { const n = NODES.find((x: any) => x.id === oldId); if (n) n.id = saved.id; }
            const EDGES = (window as any).EDGES;
            if (EDGES) EDGES.forEach((e: any) => { if (e.from === oldId) e.from = saved.id; if (e.to === oldId) e.to = saved.id; });
            if (task.connections?.length) {
              await supabase.from('connections').insert(task.connections.map((c: any) => ({
                user_id: user.id, task_from: saved.id, task_to: c.task_id, type: c.type, score: c.score,
              })));
            }
          }
        } catch (e) { console.warn('save task failed', e); }
      };

      (window as any).__synSaveThesis = async (mn: any) => {
        try {
          const { data: existing } = await supabase.from('theses').select('id').eq('user_id', user.id).eq('cluster_id', mn.clusterId).maybeSingle();
          const payload = {
            user_id: user.id, cluster_id: mn.clusterId, thesis: mn.thesis, confidence: mn.confidence,
            explanation: mn.explanation, pattern: mn.pattern, suggested_question: mn.suggested_question,
            signals: mn.signals || null,
            source_task_ids: mn.source_ids, history: mn.history, color: mn.color, pos_x: mn.x, pos_y: mn.y,
            updated_at: new Date().toISOString(),
          };
          if (existing) await supabase.from('theses').update(payload).eq('id', existing.id);
          else await supabase.from('theses').insert(payload);
        } catch (e) { console.warn('save thesis failed', e); }
      };

      (window as any).__synSaveAction = async (a: any) => {
        try {
          const { data: th } = await supabase.from('theses').select('id').eq('user_id', user.id).eq('cluster_id', a.clusterId).maybeSingle();
          const { data: existing } = await supabase.from('actions').select('id').eq('user_id', user.id).eq('cluster_id', a.clusterId).maybeSingle();
          const payload = {
            user_id: user.id, thesis_id: th?.id || null, cluster_id: a.clusterId,
            title: a.title, summary: a.summary, categories: a.categories, caveat: a.caveat,
            pos_x: a.x, pos_y: a.y,
          };
          if (existing) await supabase.from('actions').update(payload).eq('id', existing.id);
          else await supabase.from('actions').insert(payload);
        } catch (e) { console.warn('save action failed', e); }
      };

      (window as any).__synDeleteTask = async (taskId: string) => {
        try {
          await supabase.from('connections').delete().or(`task_from.eq.${taskId},task_to.eq.${taskId}`);
          await supabase.from('tasks').delete().eq('id', taskId);
        } catch (e) { console.warn('delete task failed', e); }
      };

      const { data: tasks } = await supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at');
      const { data: conns } = await supabase.from('connections').select('*').eq('user_id', user.id);
      const { data: theses } = await supabase.from('theses').select('*').eq('user_id', user.id);
      const { data: actions } = await supabase.from('actions').select('*').eq('user_id', user.id);
      (window as any).__SYN_PRELOAD = { tasks: tasks || [], conns: conns || [], theses: theses || [], actions: actions || [] };

      const { data: profile } = await supabase.from('profiles').select('plan, tasks_this_month, portfolio').eq('id', user.id).single();
      if (profile) { (window as any).__SYN_USAGE = { used: profile.tasks_this_month, limit: profile.plan === 'free' ? 10 : 99999, plan: profile.plan }; }
      (window as any).__SYN_PORTFOLIO = (profile as any)?.portfolio || [];

      // Portafoglio reale: salvato su profiles.portfolio, iniettato nei prompt
      // da /api/analyze e /api/portfolio per il collegamento esposizione.
      (window as any).__synSavePortfolio = async (p: any) => {
        const { error } = await supabase.from('profiles').update({ portfolio: p }).eq('id', user.id);
        if (error) throw error;
      };

      // Full reload, NON router.push: azzera lo stato globale dello script
      // iniettato (TASKS, NODES, __SYN_INITIALIZED) — altrimenti il prossimo
      // utente sulla stessa scheda vede i dati di quello precedente
      (window as any).__synLogout = async () => { await supabase.auth.signOut(); window.location.href = '/login'; };

      // lightweight-charts: caricata qui (import dinamico, niente SSR) ed esposta
      // allo script vanilla via window. Se fallisce, drawChart usa il canvas custom.
      try {
        const LWC = await import('lightweight-charts');
        (window as any).__SYN_LWC = { createChart: LWC.createChart, AreaSeries: LWC.AreaSeries, ColorType: LWC.ColorType };
      } catch (e) { console.warn('lightweight-charts non caricata, fallback canvas', e); }

      // Inject the main script ONLY after the BODY (and its #gc canvas) is in the DOM.
      // This removes the timing race that caused intermittent blank screens.
      const injectScript = () => {
        if (document.getElementById('__syn_main_script')) return; // already injected
        const scriptEl = document.createElement('script');
        scriptEl.id = '__syn_main_script';
        scriptEl.src = '/synapse/graph.js'; // SCRIPT estratto in public/synapse/graph.js
        document.body.appendChild(scriptEl);
      };
      let attempts = 0;
      const waitForCanvas = () => {
        if (document.getElementById('gc')) {
          injectScript();
        } else if (attempts < 40) {
          attempts++;
          setTimeout(waitForCanvas, 25); // retry up to ~1s
        } else {
          console.warn('Synapse: canvas non trovato dopo attesa, inietto comunque');
          injectScript();
        }
      };
      waitForCanvas();
    })();
  }, []);

  return <div ref={containerRef} style={{ height: '100vh' }} />;
}
