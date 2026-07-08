# Contesto growth marketing — Symnaps

> Questo documento serve a inquadrare target, funnel, canali e vincoli del
> growth di Symnaps. Ogni SOP, contenuto o campagna nelle cartelle `seo/`,
> `ads/`, `landing/` parte da qui. Decisioni prese il 2026-07-08.

## Target

### Primario: investitore autonomo italiano (beachhead)

- 25-45 anni, investe da solo in ETF e azioni (PAC su VWCE/SWDA, singoli
  titoli tech/USA), conto su Directa/Fineco/Degiro/Scalable.
- Consuma contenuti finanza: r/ItaliaPersonalFinance, fintwit italiano,
  YouTube/Telegram di finanza personale, newsletter.
- Dolore: ha opinioni e fonti sparse, non ha un metodo per organizzarle né
  un modo per verificare a posteriori se i suoi ragionamenti reggevano.
- Diffidente verso i guru e il copy trading → il posizionamento
  anti-guru/anti-hype è un vantaggio, non un limite.
- Lingua: italiano. Il prodotto è già bilingue, ma il go-to-market parte IT:
  meno competizione, community raggiungibili, voce del brand già italiana.

### Secondario (fase 2): retail EU/globale in inglese

Si attiva quando: (a) il loop marketplace funziona in IT, (b) c'è massa di
tesi pubbliche EN. Nessun lavoro dedicato prima.

## Messaggio

**Un posto dove il tuo ragionamento di investimento vive, si aggiorna coi
dati e lascia un track record.**

Declinazioni per angolo:

- metodo: "Inizia da una domanda. Al resto pensa la struttura."
- anti-guru: "Il track record è misurato sui dati — non si compra e non si
  gonfia."
- dati: "Niente numeri inventati: FRED, Twelve Data, FMP."
- marketplace: "Il GitHub della ricerca finanziaria: le tesi si evolvono di
  grafo in grafo."

Mai: promesse di rendimento, "batti il mercato", urgenza artificiale.

## Funnel e misurazione

Visita → signup → prima domanda → prima tesi → pubblicazione/evoluzione →
(waitlist Pro).

Eventi PostHog già tracciati (EU): `signup`, `login`, `question_analyzed`,
`thesis_emerged`, `thesis_challenged`, `thesis_published`, `thesis_imported`,
`portfolio_generated`, `graph_shared`, `pro_waitlist`.

- **North star: utenti che arrivano alla prima tesi** (`thesis_emerged`) —
  è il momento in cui il prodotto ha dimostrato il suo valore.
- KPI di attivazione: % signup → prima domanda; % prima domanda → prima tesi.
- KPI di loop: tesi pubblicate, evoluzioni (`thesis_imported`), grafi
  condivisi (`graph_shared`).
- KPI di intento economico: iscritti waitlist Pro (`pro_waitlist`).
- Obiettivo di fase: **utenti attivi e waitlist, non revenue** (billing non
  attivo — beta soft).

## Canali (scelti: solo organico)

### 1. SEO / content (cartella `seo/`)

- Leva unica: le **pagine tesi pubbliche** (`/market/t/[id]`) e i profili
  autore sono contenuto indicizzabile che si genera da solo e si aggiorna
  coi dati — nessun blog da alimentare a mano per avere pagine fresche.
- Contenuti editoriali: pezzi metodologici ("come si costruisce una tesi di
  investimento", "cos'è un track record verificabile"), non stock picking.
- Query target: informazionali italiane su metodo/strumenti di analisi, non
  "quale azione comprare".

### 2. Social organico

- Piattaforme: X/fintwit IT e LinkedIn (metodo, screenshot del grafo);
  TikTok/IG solo se il formato video breve dimostra trazione.
- Formato firma: **screenshot del grafo su tema scuro** — il prodotto è
  visivamente riconoscibile, va mostrato, non raccontato (vedi
  `guida-stile-brand.md`).
- Contenuto ricorrente: una tesi pubblica del marketplace raccontata (dati,
  segnali, cosa la invaliderebbe) con link alla pagina tesi.

### 3. Community

- r/ItaliaPersonalFinance, Telegram/Discord di finanza: partecipazione
  genuina, il prodotto si cita solo quando risponde a un problema espresso.
  Mai spam, mai account finti (stessa etica del marketplace).
- Il **grafo condiviso senza account** (`/g/[token]`) è il formato nativo da
  community: si linka un ragionamento leggibile da chiunque, non una landing.

### Cosa NON facciamo (per ora)

- Paid (Google/Meta): budget ~0 € e billing assente — riattivare la
  valutazione quando Pro è acquistabile. La cartella `ads/` resta pronta.
- Influencer a pagamento, affiliazioni, growth hack rumorosi.

## Vincoli

- Budget: **~0 €/mese** — tempo del founder + contenuti.
- Beta soft: nessun lancio "botto", crescita per cerchi (community → SEO).
- Compliance: taglio educativo sempre; niente consulenza, niente promesse di
  rendimento (vincolo hard, vedi `contesto-brand.md`).
- Costi variabili AI: il piano Free ha cap (10 analisi/mese) — la crescita
  non spinge i costi fuori controllo, ma i contenuti non devono promettere
  uso illimitato.

---

**Fonti di verità nel repo:** eventi in `app/layout.tsx` e route API
(PostHog), piani in `app/api/analyze/route.ts` (`PLAN_LIMITS`) e
`lib/ai-usage.ts` (`AI_CALL_LIMITS`), superfici pubbliche `/market`,
`/market/t/[id]`, `/g/[token]`, landing `app/welcome/page.tsx`.
