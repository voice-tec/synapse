// Punteggio "in evidenza" per la vetrina marketplace — funzione pura, testabile
// (usata da app/api/market/stats). Premia segnali di qualità recenti, non i like:
//   import ricevuti negli ultimi 14gg   ×2
//   confermata negli ultimi 14gg        +3
//   creata negli ultimi 7gg             +1
// Top N con punteggio > 0; se nessuna supera 0, fallback alle confermate più
// recenti (o, in mancanza, alle più recenti e basta).

const DAY = 24 * 60 * 60 * 1000;

export type TrendingInput = {
  id: string;
  status?: string | null;
  created_at?: string | null;
  closed_at?: string | null;
  recentImports?: number; // cloni creati negli ultimi 14gg
};

export function trendingScore(t: TrendingInput, now: Date = new Date()): number {
  let score = (t.recentImports || 0) * 2;
  if (
    t.status === 'confirmed' &&
    t.closed_at &&
    now.getTime() - new Date(t.closed_at).getTime() <= 14 * DAY
  ) score += 3;
  if (t.created_at && now.getTime() - new Date(t.created_at).getTime() <= 7 * DAY) score += 1;
  return score;
}

export function pickTrending<T extends TrendingInput>(theses: T[], n = 3, now: Date = new Date()): T[] {
  const recency = (a: T, b: T) =>
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  const scored = theses
    .map((t) => ({ t, score: trendingScore(t, now) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || recency(a.t, b.t));
  if (scored.length) return scored.slice(0, n).map((x) => x.t);
  // Fallback: niente segnali recenti → le confermate più recenti, poi le altre.
  const confirmed = theses.filter((t) => t.status === 'confirmed').sort(recency);
  if (confirmed.length) return confirmed.slice(0, n);
  return theses.slice().sort(recency).slice(0, n);
}
