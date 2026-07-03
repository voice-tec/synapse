// Lingua dell'output AI. Arriva dal client per richiesta (localStorage
// 'syn-lang', condiviso con le pagine pubbliche) — nessuna colonna DB.
// I prompt esistenti restano in italiano: per gli utenti EN si APPENDE una
// direttiva che li sovrascrive, così il diff sui prompt è zero.
export type Lang = 'it' | 'en';

export function normLang(x: unknown): Lang {
  return x === 'en' ? 'en' : 'it';
}

// Localizzazione deterministica: la sola direttiva in coda NON basta quando il
// prompt specifica "in Italian" campo per campo (visto in produzione: schema di
// analyze vinceva sulla direttiva). Per EN si riscrivono i marcatori di lingua
// nel prompt E si appende la direttiva.
const IT_MARKERS: [RegExp, string][] = [
  [/in ONE Italian sentence/g, 'in ONE English sentence'],
  [/Italian sentence/g, 'English sentence'],
  [/in Italian/g, 'in English'],
  [/frase italiana/g, 'frase in INGLESE (English)'],
  [/frasi italiane/g, 'frasi in INGLESE (English)'],
  [/in italiano/g, 'in INGLESE (English)'],
];
export function localizeSystem(system: string, lang: Lang): string {
  if (lang !== 'en') return system;
  let s = system;
  for (const [re, rep] of IT_MARKERS) s = s.replace(re, rep);
  return s + '\n\n' + langDirective(lang)!;
}

// Comodo per i system passati come stringa singola.
export function withLang(system: string, lang: Lang): string {
  return localizeSystem(system, lang);
}

// null per 'it': i prompt impongono già l'italiano.
export function langDirective(lang: Lang): string | null {
  if (lang !== 'en') return null;
  return 'CRITICAL LANGUAGE RULE (overrides EVERYTHING above, including examples): this user uses Symnaps in ENGLISH. Write EVERY user-facing text field of your JSON in natural English — insight, labels, takeaways, scenarios, catalysts, notes, theses, questions. The Italian examples in the schema show FORMAT only, not language. Keep enum/token values (e.g. stance "si|no|dipende", status/type keys) exactly as the schema specifies.';
}
