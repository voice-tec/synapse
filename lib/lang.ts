// Lingua dell'output AI. Arriva dal client per richiesta (localStorage
// 'syn-lang', condiviso con le pagine pubbliche) — nessuna colonna DB.
// I prompt esistenti restano in italiano: per gli utenti EN si APPENDE una
// direttiva che li sovrascrive, così il diff sui prompt è zero.
export type Lang = 'it' | 'en';

export function normLang(x: unknown): Lang {
  return x === 'en' ? 'en' : 'it';
}

// Comodo per i system passati come stringa singola.
export function withLang(system: string, lang: Lang): string {
  const d = langDirective(lang);
  return d ? system + '\n\n' + d : system;
}

// null per 'it': i prompt impongono già l'italiano.
export function langDirective(lang: Lang): string | null {
  if (lang !== 'en') return null;
  return 'LANGUAGE OVERRIDE: this user uses Symnaps in ENGLISH. Ignore any earlier instruction to write in Italian: write EVERY user-facing text field of your JSON in natural English. Keep enum/token values (e.g. stance "si|no|dipende", status/type keys) exactly as the schema specifies.';
}
