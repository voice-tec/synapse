'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

const TC: Record<string, string> = { causal: '#5b9cf6', compare: '#2ecf98', risk: '#f0a030', trend: '#4ad68a', screen: '#4ad68a' };
const MEMORY_COLORS = ['#a78bfa', '#f472b6', '#34d399', '#fb923c', '#60a5fa'];

export default function SynapsePage() {
  const router = useRouter();
  const supabase = createClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // State refs (mutable, used by animation loop)
  const tasksRef = useRef<any[]>([]);
  const nodesRef = useRef<any[]>([]);
  const edgesRef = useRef<any[]>([]);
  const memNodesRef = useRef<any[]>([]);
  const selRef = useRef<string | null>(null);
  const hovRef = useRef<string | null>(null);

  const [stats, setStats] = useState({ tasks: 0, conns: 0, hyps: 0, mem: 0 });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [drawer, setDrawer] = useState<any>(null); // {type:'task'|'memory', data}
  const [usage, setUsage] = useState<{ used: number; limit: number; plan: string } | null>(null);
  const [ready, setReady] = useState(false);

  // ── Load existing graph from DB on mount ──
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: tasks } = await supabase.from('tasks').select('*').order('created_at');
      const { data: conns } = await supabase.from('connections').select('*');
      const { data: theses } = await supabase.from('theses').select('*');
      const { data: profile } = await supabase.from('profiles').select('plan, tasks_this_month').eq('id', user.id).single();

      if (tasks) {
        tasksRef.current = tasks.map((t) => ({
          id: t.id, raw_query: t.raw_query, intent: t.intent,
          fingerprint: t.fingerprint, output: t.output, created_at: new Date(t.created_at),
          connections: [],
        }));
        // rebuild node positions
        const W = window.innerWidth, graphH = window.innerHeight - 200;
        nodesRef.current = tasksRef.current.map((task, i) => {
          const a = (i / tasksRef.current.length) * Math.PI * 2;
          return { id: task.id, x: W / 2 + Math.cos(a) * 200, y: graphH / 2 + Math.sin(a) * 150, vx: 0, vy: 0, task };
        });
      }
      if (conns) {
        edgesRef.current = conns.map((c) => ({ from: c.task_from, to: c.task_to, score: c.score, type: c.type }));
        // attach connections to tasks
        tasksRef.current.forEach((t) => {
          t.connections = conns.filter((c) => c.task_from === t.id).map((c) => {
            const other = tasksRef.current.find((x) => x.id === c.task_to);
            return { task_id: c.task_to, query: other?.raw_query || '', type: c.type, score: c.score };
          });
        });
      }
      if (theses) {
        const W = window.innerWidth, graphH = window.innerHeight - 200;
        memNodesRef.current = theses.map((th, i) => ({
          id: th.id, clusterId: th.cluster_id, thesis: th.thesis, confidence: th.confidence,
          explanation: th.explanation, pattern: th.pattern, suggested_question: th.suggested_question,
          source_ids: th.source_task_ids || [], history: th.history || [], color: th.color || MEMORY_COLORS[i % 5],
          phaseOffset: Math.random() * Math.PI * 2,
          x: th.pos_x || (W / 2 + (i - 1) * 200), y: th.pos_y || (graphH / 2),
        }));
      }
      if (profile) setUsage({ used: profile.tasks_this_month, limit: profile.plan === 'free' ? 10 : 99999, plan: profile.plan });

      updateStats();
      setReady(true);
    })();
  }, []);

  const updateStats = useCallback(() => {
    const hyps = new Set(tasksRef.current.map((t) => (t.fingerprint?.hypothesis || '').toLowerCase().slice(0, 40)).filter(Boolean));
    setStats({ tasks: tasksRef.current.length, conns: edgesRef.current.length, hyps: hyps.size, mem: memNodesRef.current.length });
  }, []);

  // ── Animation loop ──
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf: number;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px'; canvas.style.height = rect.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize(); window.addEventListener('resize', resize);

    function drawHex(x: number, y: number, r: number) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i - Math.PI / 6; const px = x + r * Math.cos(a), py = y + r * Math.sin(a); i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
      ctx.closePath();
    }
    function wrap(text: string, max: number) {
      const words = text.split(' '); const lines: string[] = []; let line = '';
      for (const w of words) { if ((line + ' ' + w).trim().length > max) { if (line) lines.push(line); line = w; } else line = (line + ' ' + w).trim(); }
      if (line) lines.push(line); return lines;
    }

    function loop() {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width / dpr, H = canvas.height / dpr, graphH = H - 110;
      ctx.clearRect(0, 0, W, H);
      const nodes = nodesRef.current, edges = edgesRef.current, mems = memNodesRef.current;
      const cx = W / 2, cy = graphH / 2;

      // physics
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = 200 + Math.max(a.task.raw_query.length, b.task.raw_query.length) * 2.2;
        const f = d < minDist ? 28000 / (d * d) : 8000 / (d * d);
        const fx = (dx / d) * f, fy = (dy / d) * f; a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
      }
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < 160) { const p = (160 - d) / 2 + 1; a.x -= (dx / d) * p; a.y -= (dy / d) * p; b.x += (dx / d) * p; b.y += (dy / d) * p; }
      }
      for (const e of edges) {
        const a = nodes.find((n) => n.id === e.from), b = nodes.find((n) => n.id === e.to);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        const target = 300 + (1 - e.score) * 120, f = (d - target) * 0.008 * e.score;
        const fx = (dx / d) * f, fy = (dy / d) * f; a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
      for (const n of nodes) {
        n.vx += (cx - n.x) * 0.002; n.vy += (cy - n.y) * 0.002; n.vx *= 0.76; n.vy *= 0.76;
        n.x += n.vx; n.y += n.vy; n.x = Math.max(120, Math.min(W - 120, n.x)); n.y = Math.max(100, Math.min(graphH - 80, n.y));
      }

      // edges
      for (const e of edges) {
        const a = nodes.find((n) => n.id === e.from), b = nodes.find((n) => n.id === e.to);
        if (!a || !b) continue;
        const ecmap: any = { same_hypothesis: '#f0a030', complementary_data: '#5b9cf6', same_question_type: '#2ecf98' };
        const ec = ecmap[e.type] || '#5b9cf6';
        const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.18, my = (a.y + b.y) / 2 - (b.x - a.x) * 0.18;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y);
        ctx.strokeStyle = ec; ctx.globalAlpha = 0.1 + e.score * 0.55; ctx.lineWidth = 0.5 + e.score * 2.5; ctx.stroke(); ctx.globalAlpha = 1;
      }

      // task nodes
      for (const n of nodes) {
        const task = n.task, color = TC[task.intent?.analysis_type] || '#5b9cf6';
        const isSel = selRef.current === n.id, isHov = hovRef.current === n.id;
        const r = (isSel || isHov) ? 28 : 20;
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 14, 0, Math.PI * 2); ctx.fillStyle = color; ctx.globalAlpha = isSel ? 0.18 : isHov ? 0.1 : 0.04; ctx.fill(); ctx.globalAlpha = 1;
        const connCount = edges.filter((e) => e.from === n.id || e.to === n.id).length;
        if (connCount > 0) { const arc = Math.min((connCount / 6) * Math.PI * 2, Math.PI * 2); ctx.beginPath(); ctx.arc(n.x, n.y, r + 6, -Math.PI / 2, -Math.PI / 2 + arc); ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.35; ctx.stroke(); ctx.globalAlpha = 1; }
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fillStyle = '#0e0e12'; ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = isSel ? 2.5 : isHov ? 2 : 1.5; ctx.globalAlpha = isSel ? 1 : isHov ? 0.9 : 0.65; ctx.stroke(); ctx.globalAlpha = 1;
        ctx.fillStyle = color; ctx.font = `${isSel || isHov ? 13 : 11}px DM Mono`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((task.intent?.analysis_type || '?')[0].toUpperCase(), n.x, n.y);
        const tooClose = nodes.some((o) => { if (o.id === n.id) return false; const dx = o.x - n.x, dy = o.y - n.y; return Math.sqrt(dx * dx + dy * dy) < 90; });
        if (!tooClose || isSel || isHov) {
          const q = task.raw_query, ll = 30; let lines;
          if (q.length <= ll) lines = [q]; else { const mid = Math.floor(q.length / 2); let sp = q.lastIndexOf(' ', mid + 10); if (sp < 4) sp = q.indexOf(' ', mid - 10); if (sp < 0) sp = ll; lines = [q.slice(0, sp).trim(), q.slice(sp).trim()]; }
          ctx.fillStyle = isSel ? '#dddde8' : isHov ? '#b0b0c8' : '#5a5a78'; ctx.font = `${isSel || isHov ? 11 : 10}px DM Mono`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.globalAlpha = tooClose ? 0.5 : 1;
          lines.forEach((l, i) => ctx.fillText(l, n.x, n.y + r + 8 + i * 14)); ctx.globalAlpha = 1;
        }
      }

      // memory nodes
      for (const mn of mems) {
        const color = mn.color || '#a78bfa';
        const isSel = selRef.current === mn.id, isHov = hovRef.current === mn.id;
        const r = (isSel || isHov) ? 34 : 26;
        const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 1000 + mn.phaseOffset);
        for (const sid of mn.source_ids || []) { const sn = nodes.find((n) => n.id === sid); if (!sn) continue; ctx.beginPath(); ctx.setLineDash([4, 4]); ctx.moveTo(mn.x, mn.y); ctx.lineTo(sn.x, sn.y); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.globalAlpha = 0.2; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
        drawHex(mn.x, mn.y, r + 18); ctx.fillStyle = color; ctx.globalAlpha = 0.05 * pulse; ctx.fill(); ctx.globalAlpha = 1;
        drawHex(mn.x, mn.y, r + 8); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.globalAlpha = 0.18 + 0.12 * pulse; ctx.stroke(); ctx.globalAlpha = 1;
        drawHex(mn.x, mn.y, r); ctx.fillStyle = '#0d0a18'; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = isSel ? 2.5 : 1.5; ctx.globalAlpha = isSel ? 1 : 0.8; ctx.stroke(); ctx.globalAlpha = 1;
        const conf = mn.confidence / 100; ctx.beginPath(); ctx.arc(mn.x, mn.y, r + 12, -Math.PI / 2, -Math.PI / 2 + conf * Math.PI * 2); ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
        if (mn.history?.length > 1) {
          const hw = r * 0.9, hh = r * 0.4, hx = mn.x - hw / 2, hy = mn.y + 4;
          const vals = mn.history.map((h: any) => h.confidence); const hmin = Math.min(...vals), hmax = Math.max(...vals), hrange = hmax - hmin || 1;
          ctx.beginPath(); vals.forEach((v: number, i: number) => { const px = hx + (i / (vals.length - 1)) * hw, py = hy + hh - (v - hmin) / hrange * hh; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
          ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.6; ctx.stroke(); ctx.globalAlpha = 1;
        } else { ctx.fillStyle = color; ctx.font = `${isSel ? 14 : 11}px DM Mono`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('◆', mn.x, mn.y); }
        ctx.fillStyle = isSel ? '#fff' : isHov ? '#d4bbff' : '#7c5ab8'; ctx.font = `${isSel ? 11 : 10}px DM Mono`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        const shortT = mn.thesis.length > 30 ? mn.thesis.slice(0, 30) + '…' : mn.thesis; const tLines = wrap(shortT, 26);
        tLines.forEach((l, i) => ctx.fillText(l, mn.x, mn.y + r + 8 + i * 13));
        const prevConf = mn.history?.length > 1 ? mn.history[mn.history.length - 2].confidence : null;
        const trend = prevConf !== null ? (mn.confidence > prevConf ? '↑' : mn.confidence < prevConf ? '↓' : '→') : '';
        ctx.fillStyle = color; ctx.font = '9px DM Mono'; ctx.fillText(`${mn.confidence}% ${trend}`, mn.x, mn.y + r + 8 + tLines.length * 13 + 4);
      }

      raf = requestAnimationFrame(loop);
    }
    loop();

    function onMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const hit = nodesRef.current.find((n) => Math.hypot(n.x - mx, n.y - my) < 32);
      const memHit = memNodesRef.current.find((mn) => Math.hypot(mn.x - mx, mn.y - my) < 38);
      hovRef.current = memHit ? memHit.id : hit ? hit.id : null;
      canvas.style.cursor = (hit || memHit) ? 'pointer' : 'default';
    }
    function onClick(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const memHit = memNodesRef.current.find((mn) => Math.hypot(mn.x - mx, mn.y - my) < 38);
      if (memHit) { selRef.current = memHit.id; setDrawer({ type: 'memory', data: memHit }); return; }
      const hit = nodesRef.current.find((n) => Math.hypot(n.x - mx, n.y - my) < 32);
      if (hit) { selRef.current = hit.id; setDrawer({ type: 'task', data: hit.task }); } else { selRef.current = null; }
    }
    canvas.addEventListener('mousemove', onMove); canvas.addEventListener('click', onClick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); canvas.removeEventListener('mousemove', onMove); canvas.removeEventListener('click', onClick); };
  }, []);

  // ── Compute connections (same logic as before) ──
  function computeConns(newT: any, existing: any[]) {
    const res: any[] = [];
    for (const old of existing) {
      let score = 0, type = 'complementary_data';
      const h1 = (newT.fingerprint?.hypothesis || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
      const h2 = (old.fingerprint?.hypothesis || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
      const ho = h1.filter((w: string) => h2.includes(w)).length;
      if (ho >= 2) { score += 0.45; type = 'same_hypothesis'; }
      const a1 = (newT.intent?.assets || []).map((a: string) => a.toLowerCase());
      const a2 = (old.intent?.assets || []).map((a: string) => a.toLowerCase());
      const ao = a1.filter((a: string) => a2.some((b: string) => b.includes(a) || a.includes(b))).length;
      if (ao > 0) score += Math.min(0.35, ao * 0.18);
      if (newT.intent?.analysis_type === old.intent?.analysis_type) { score += 0.15; if (type === 'complementary_data') type = 'same_question_type'; }
      const s1 = (newT.fingerprint?.sector || '').toLowerCase(), s2 = (old.fingerprint?.sector || '').toLowerCase();
      if (s1 && s2 && (s1 === s2 || s1.includes(s2) || s2.includes(s1))) score += 0.15;
      score = Math.round(Math.min(score, 1) * 100) / 100;
      if (score >= 0.35) res.push({ task_id: old.id, query: old.raw_query, type, score });
    }
    return res.sort((a, b) => b.score - a.score).slice(0, 4);
  }

  // ── Run task ──
  async function runTask() {
    const q = query.trim(); if (!q || loading) return;
    setLoading(true);
    try {
      const prevCtx = tasksRef.current.length
        ? `\n\nPRIOR TASKS:\n${tasksRef.current.map((t, i) => `[${i + 1}] "${t.raw_query}" | type:${t.intent?.analysis_type} | hypothesis:"${t.fingerprint?.hypothesis}"`).join('\n')}`
        : '';

      const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, priorContext: prevCtx }) });
      const json = await res.json();
      if (json.error === 'limit_reached') { alert(`Hai raggiunto il limite di ${json.limit} task del piano ${json.plan}. Passa a Pro per task illimitate.`); setLoading(false); return; }
      if (json.error) throw new Error(json.error);

      const parsed = json.result;
      if (json.usage) setUsage(json.usage);

      const { data: { user } } = await supabase.auth.getUser();
      // Save task to DB
      const { data: saved } = await supabase.from('tasks').insert({
        user_id: user!.id, raw_query: q, intent: parsed.intent, fingerprint: parsed.fingerprint, output: parsed.output,
      }).select().single();

      const task: any = { id: saved!.id, raw_query: q, created_at: new Date(), ...parsed, connections: [] };
      task.connections = computeConns(task, tasksRef.current);
      tasksRef.current = [task, ...tasksRef.current];

      // Save connections
      if (task.connections.length) {
        await supabase.from('connections').insert(task.connections.map((c: any) => ({ user_id: user!.id, task_from: task.id, task_to: c.task_id, type: c.type, score: c.score })));
      }

      const W = window.innerWidth, graphH = window.innerHeight - 200;
      const a = Math.random() * Math.PI * 2, dist = 160 + Math.random() * 200;
      nodesRef.current.push({ id: task.id, x: W / 2 + Math.cos(a) * dist, y: graphH / 2 + Math.sin(a) * dist, vx: 0, vy: 0, task });
      for (const c of task.connections) edgesRef.current.push({ from: task.id, to: c.task_id, score: c.score, type: c.type });

      updateStats();
      setQuery('');
      setDrawer({ type: 'task', data: task });
      setTimeout(() => checkMemory(), 800);
    } catch (e: any) { alert('Errore: ' + e.message); }
    finally { setLoading(false); }
  }

  // ── Check memory clusters ──
  async function checkMemory() {
    if (tasksRef.current.length < 5) return;
    try {
      const summary = tasksRef.current.map((t, i) => `[${i + 1}] query:"${t.raw_query}" | hypothesis:"${t.fingerprint?.hypothesis || ''}" | sector:${t.fingerprint?.sector || ''} | type:${t.intent?.analysis_type || ''}`).join('\n');
      const res = await fetch('/api/memory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary, taskCount: tasksRef.current.length }) });
      const json = await res.json();
      if (json.error || !json.result?.clusters?.length) return;

      const { data: { user } } = await supabase.auth.getUser();
      const W = window.innerWidth, graphH = window.innerHeight - 200;
      const now = new Date().toISOString();

      for (const cluster of json.result.clusters) {
        if (cluster.confidence < 65) continue;
        const sourceIds = (cluster.source_indices || []).map((i: number) => tasksRef.current[i - 1]?.id).filter(Boolean);
        const existing = memNodesRef.current.find((mn) => mn.clusterId === cluster.id);

        if (existing) {
          if (existing.thesis !== cluster.thesis || existing.confidence !== cluster.confidence) {
            existing.history.push({ thesis: existing.thesis, confidence: existing.confidence, date: now });
          }
          Object.assign(existing, { thesis: cluster.thesis, confidence: cluster.confidence, explanation: cluster.explanation, pattern: cluster.pattern, source_ids: sourceIds, suggested_question: cluster.suggested_question });
          await supabase.from('theses').update({ thesis: cluster.thesis, confidence: cluster.confidence, explanation: cluster.explanation, pattern: cluster.pattern, suggested_question: cluster.suggested_question, source_task_ids: sourceIds, history: existing.history, updated_at: now }).eq('id', existing.id);
        } else {
          let bestX = W / 2, bestY = graphH / 2, bestDist = 0;
          const obs = [...nodesRef.current, ...memNodesRef.current];
          for (let tx = 130; tx < W - 130; tx += 90) for (let ty = 110; ty < graphH - 90; ty += 90) {
            const minD = obs.reduce((m, n) => Math.min(m, Math.hypot(n.x - tx, n.y - ty)), Infinity);
            if (minD > bestDist) { bestDist = minD; bestX = tx; bestY = ty; }
          }
          const color = MEMORY_COLORS[memNodesRef.current.length % 5];
          const { data: savedT } = await supabase.from('theses').insert({
            user_id: user!.id, cluster_id: cluster.id, thesis: cluster.thesis, confidence: cluster.confidence,
            explanation: cluster.explanation, pattern: cluster.pattern, suggested_question: cluster.suggested_question,
            source_task_ids: sourceIds, history: [{ thesis: cluster.thesis, confidence: cluster.confidence, date: now }],
            color, pos_x: bestX, pos_y: bestY,
          }).select().single();
          memNodesRef.current.push({ id: savedT!.id, clusterId: cluster.id, x: bestX, y: bestY, color, phaseOffset: Math.random() * Math.PI * 2, thesis: cluster.thesis, confidence: cluster.confidence, explanation: cluster.explanation, pattern: cluster.pattern, source_ids: sourceIds, suggested_question: cluster.suggested_question, history: [{ thesis: cluster.thesis, confidence: cluster.confidence, date: now }] });
        }
      }
      updateStats();
    } catch (e) { console.warn('memory check failed', e); }
  }

  async function logout() { await supabase.auth.signOut(); router.push('/login'); }

  if (!ready) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a5a78', fontSize: 13 }}>caricamento della tua rete...</div>;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* TOPBAR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px', borderBottom: '1px solid #1f1f28', background: '#0e0e12' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Fraunces, serif', fontSize: 17, fontWeight: 300 }}>
          <svg width="22" height="28" viewBox="0 0 22 28" fill="none"><path d="M17 6.5C17 4.5 15 3 11 3C7 3 5 4.8 5 7C5 9.2 7.5 10.2 11 11C14.5 11.8 17 13 17 15.5C17 18 14.5 19.5 11 19.5C7.5 19.5 5 18 5 16" stroke="white" strokeWidth="1.8" strokeLinecap="round" /><circle cx="17" cy="6.5" r="2.2" fill="white" /><circle cx="5" cy="16" r="2.2" fill="white" /></svg>
          Synapse
        </div>
        {usage && <span style={{ fontSize: 10, color: '#5a5a78', marginLeft: 8 }}>{usage.plan} · {usage.plan === 'free' ? `${usage.used}/${usage.limit} task` : 'illimitato'}</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 28, alignItems: 'center' }}>
          {[['tasks', 'task'], ['conns', 'conn.'], ['hyps', 'ipotesi'], ['mem', 'tesi ◆']].map(([k, label]) => (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 16, fontWeight: 500 }}>{(stats as any)[k]}</span>
              <span style={{ fontSize: 10, color: '#3a3a50', textTransform: 'uppercase' }}>{label}</span>
            </div>
          ))}
          <button onClick={logout} style={{ background: 'none', border: '1px solid #2a2a36', borderRadius: 8, padding: '6px 12px', color: '#7a7a95', fontFamily: 'DM Mono', fontSize: 11, cursor: 'pointer' }}>esci</button>
        </div>
      </div>

      {/* GRAPH */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        {stats.tasks === 0 && <div style={{ position: 'absolute', top: 20, left: 20, fontSize: 10, color: '#3a3a50' }}>la tua rete semantica apparirà qui</div>}

        {/* INPUT BAR */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 20px 16px', background: 'linear-gradient(transparent, #08080a 30%)', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runTask(); } }}
            placeholder="Scrivi qualsiasi domanda di analisi finanziaria..."
            rows={1}
            style={{ flex: 1, background: '#141418', border: '1px solid #2a2a36', borderRadius: 18, padding: '12px 16px', color: '#dddde8', fontFamily: 'DM Mono', fontSize: 12, resize: 'none', outline: 'none', minHeight: 44, lineHeight: 1.5 }}
          />
          <button onClick={runTask} disabled={loading} style={{ background: '#5b9cf6', color: '#08080a', border: 'none', borderRadius: 12, padding: '10px 20px', fontFamily: 'DM Mono', fontSize: 12, fontWeight: 500, cursor: 'pointer', height: 44, opacity: loading ? 0.4 : 1 }}>
            {loading ? '...' : 'analizza →'}
          </button>
        </div>
      </div>

      {/* DRAWER */}
      {drawer && <Drawer drawer={drawer} onClose={() => { setDrawer(null); selRef.current = null; }} onJump={(id: string) => { const n = nodesRef.current.find((x) => x.id === id); if (n) setDrawer({ type: 'task', data: n.task }); }} onAskSuggested={(q: string) => { setDrawer(null); setQuery(q); }} />}
    </div>
  );
}

// ── DRAWER COMPONENT ──
function Drawer({ drawer, onClose, onJump, onAskSuggested }: any) {
  const isMemory = drawer.type === 'memory';
  const d = drawer.data;
  const color = isMemory ? (d.color || '#a78bfa') : (TC[d.intent?.analysis_type] || '#5b9cf6');

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 30 }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '72vh', background: '#0e0e12', borderTop: '1px solid #2a2a36', borderRadius: '24px 24px 0 0', zIndex: 31, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#2a2a36', margin: '12px auto 0', cursor: 'pointer' }} onClick={onClose} />
        <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid #1f1f28', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, background: color + '22', color, marginTop: 3 }}>{isMemory ? 'tesi emergente' : d.intent?.analysis_type}</span>
          <div style={{ flex: 1, fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 300, lineHeight: 1.4 }}>
            {isMemory ? <><span style={{ fontSize: 13, opacity: 0.6, display: 'block', marginBottom: 4 }}>◆ nodo memoria</span>{d.thesis}</> : d.raw_query}
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #2a2a36', background: 'none', color: '#7a7a95', fontSize: 16, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {isMemory ? <MemoryBody d={d} color={color} onJump={onJump} onAsk={onAskSuggested} /> : <TaskBody d={d} color={color} onJump={onJump} />}
        </div>
      </div>
    </>
  );
}

function lbl(t: string) { return <div style={{ fontSize: 10, color: '#3a3a50', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>{t}</div>; }

function TaskBody({ d, color, onJump }: any) {
  return (
    <>
      {d.fingerprint?.hypothesis && <div>{lbl('ipotesi implicita')}<div style={{ background: '#141418', borderLeft: `2px solid ${color}`, borderRadius: '0 10px 10px 0', padding: '12px 16px', fontFamily: 'Fraunces, serif', fontSize: 15, fontWeight: 300, fontStyle: 'italic', lineHeight: 1.5 }}>"{d.fingerprint.hypothesis}"</div></div>}
      {d.output?.insight && <div>{lbl('analisi AI')}<div style={{ background: '#141418', borderRadius: 14, padding: 16, fontFamily: 'Fraunces, serif', fontSize: 14, fontWeight: 300, color: '#7a7a95', lineHeight: 1.8 }}>{d.output.insight}</div></div>}
      {d.connections?.length > 0 && <div>{lbl(`connessioni (${d.connections.length})`)}<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{d.connections.map((c: any, i: number) => <div key={i} onClick={() => onJump(c.task_id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#141418', border: '1px solid #1f1f28', borderRadius: 10, cursor: 'pointer' }}><span style={{ fontSize: 12, color: '#f0a030', minWidth: 36 }}>{Math.round(c.score * 100)}%</span><span style={{ fontSize: 12, color: '#7a7a95' }}>{c.query}</span></div>)}</div></div>}
      {d.output?.sources?.length > 0 && <div>{lbl('fonti')}<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{d.output.sources.map((s: string, i: number) => <span key={i} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: '#1a1a20', color: '#3a3a50' }}>{s}</span>)}</div></div>}
    </>
  );
}

function MemoryBody({ d, color, onJump, onAsk }: any) {
  return (
    <>
      <div>{lbl('tesi corrente')}<div style={{ background: '#141418', borderLeft: `2px solid ${color}`, borderRadius: '0 12px 12px 0', padding: '16px 20px', fontFamily: 'Fraunces, serif', fontSize: 16, fontWeight: 300, fontStyle: 'italic', color: '#d4bbff', lineHeight: 1.6 }}>"{d.thesis}"</div></div>
      <div>{lbl('confidenza')}<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ flex: 1, height: 4, background: '#2a2a36', borderRadius: 2 }}><div style={{ height: 4, borderRadius: 2, width: d.confidence + '%', background: color }} /></div><span style={{ fontSize: 12, color }}>{d.confidence}%</span></div><div style={{ fontSize: 11, color: '#3a3a50', lineHeight: 1.6, marginTop: 8 }}>{d.explanation}</div></div>
      {d.pattern && <div>{lbl('pattern rilevato')}<div style={{ background: '#141418', borderRadius: 12, padding: '14px 16px', fontSize: 13, color: '#7a7a95', lineHeight: 1.7, fontFamily: 'Fraunces, serif', fontWeight: 300 }}>{d.pattern}</div></div>}
      {d.history?.length > 1 && <div>{lbl('evoluzione della tesi')}<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[...d.history].reverse().map((h: any, i: number) => { const isLatest = i === 0; return <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 14px', background: isLatest ? color + '11' : '#141418', border: `1px solid ${isLatest ? color + '44' : '#1f1f28'}`, borderRadius: 10 }}><div style={{ minWidth: 50, textAlign: 'right' }}><div style={{ fontSize: 15, fontWeight: 500, color: isLatest ? color : '#7a7a95' }}>{h.confidence}%</div><div style={{ fontSize: 9, color: '#3a3a50' }}>{new Date(h.date).toLocaleDateString('it', { day: 'numeric', month: 'short' })}</div></div><div style={{ flex: 1, fontFamily: 'Fraunces, serif', fontSize: isLatest ? 13 : 11, fontStyle: 'italic', color: isLatest ? '#dddde8' : '#7a7a95', lineHeight: 1.4 }}>"{h.thesis}"</div></div>; })}</div></div>}
      <div>{lbl(`task sorgente (${(d.source_ids || []).length})`)}<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{(d.source_ids || []).map((sid: string, i: number) => <div key={i} onClick={() => onJump(sid)} style={{ padding: '10px 14px', background: '#141418', border: `1px solid ${color}22`, borderRadius: 10, cursor: 'pointer', fontSize: 12, color: '#7a7a95' }}><span style={{ color, marginRight: 8 }}>{i + 1}</span>{/* query loaded from parent */}vai alla task</div>)}</div></div>
      {d.suggested_question && <div>{lbl('prossimo passo suggerito')}<div onClick={() => onAsk(d.suggested_question)} style={{ background: color + '11', border: `1px dashed ${color}44`, borderRadius: 12, padding: '14px 16px', fontSize: 12, color, cursor: 'pointer', lineHeight: 1.5 }}>→ {d.suggested_question}</div></div>}
    </>
  );
}
