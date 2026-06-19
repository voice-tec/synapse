import { createHash } from 'crypto';

// Riferimento opaco e stabile a un autore (no identità): stesso user_id → stesso
// hash. Usato dalla vetrina per raggruppare e dall'import per il badge "importata".
export function authorRef(uid: string): string {
  return createHash('sha256').update(uid).digest('hex').slice(0, 8);
}

// Reputazione di un autore = aggregato del suo track record su TUTTE le sue tesi
// (non solo le pubbliche): quante tesi, quante confermate, accuratezza media.
// Serve alla vetrina del marketplace per far scegliere su prova reale, non sul
// nome. Funzione pura: testabile e riusabile.

export type Rep = { theses: number; confirmed: number; invalidated: number; accuracy: number | null };

export function authorRep(theses: { status?: string | null; accuracy?: number | null }[]): Rep {
  let confirmed = 0, invalidated = 0, accSum = 0, accN = 0;
  for (const t of theses) {
    if (t.status === 'confirmed') confirmed++;
    else if (t.status === 'invalidated') invalidated++;
    if (typeof t.accuracy === 'number') { accSum += t.accuracy; accN++; }
  }
  return {
    theses: theses.length,
    confirmed,
    invalidated,
    accuracy: accN ? Math.round(accSum / accN) : null,
  };
}
