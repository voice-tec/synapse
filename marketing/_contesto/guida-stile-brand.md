# Guida di stile brand — Symnaps

> Questo documento serve a produrre asset visivi (social, landing, thumbnail,
> slide) coerenti con il prodotto. I valori qui sotto sono estratti dal
> codice del prodotto: in caso di dubbio, il prodotto vince.

## Principio

Il prodotto È l'identità visiva. Il grafo scuro con i suoi glifi è
riconoscibile e non replicabile dai competitor: ogni asset dovrebbe contenere
il prodotto vero (screenshot o ricostruzione fedele), non illustrazioni
generiche di finanza.

## Palette

| Ruolo | Hex | Uso |
|---|---|---|
| Sfondo | `#08080a` | fondo di tutto: app, asset social, slide |
| Superficie | `#0e0e12` / `#16161e` | card, pannelli |
| Bordo | `#2a2a36` / `#1f1f28` | linee sottili 1px |
| Testo | `#e8e8f0` | testo primario |
| Testo secondario | `#9a9ab2` / `#7a7a95` / `#5a5a78` | gerarchie di grigio-viola |
| **Viola tesi** | `#a78bfa` | colore firma: tesi, accenti, hover (testo tesi in `#d4bbff`) |
| Verde conferma | `#4ad68a` | confermata, segnali positivi, import |
| Rosso invalida | `#e05555` | invalidata, segnali negativi |
| Blu dati | `#5b9cf6` | accuratezza, link condivisione |
| Ambra | `#f0a030` | evoluzioni/rami, avvisi soft |

Regola: fondo sempre scuro. Mai tema chiaro negli asset.

## Tipografia

- **Fraunces** (serif, corsivo, peso leggero): è la voce delle tesi. Le
  citazioni di tesi vanno sempre in Fraunces corsivo tra virgolette:
  *"L'oro protegge quando i tassi scendono"*.
- **System-ui / sans**: tutto il resto (UI, label, body).
- **Lowercase diffuso**: label, bottoni e micro-copy del prodotto sono in
  minuscolo ("pubblica", "apri →", "◆ tesi"). Gli asset lo rispettano.
- Label uppercase piccole (9-10px, letter-spacing largo) solo per etichette
  di sezione, come nell'app.

## Glifi proprietari

Il set di simboli è parte del linguaggio — usarli al posto di icone generiche:

- `●` domanda · `◆` tesi · `▤` portafoglio
- `⑂` evoluzione/ramo · `↘` evoluta nel grafo di qualcuno
- `✓` confermata · `✕` invalidata · `⚡` contraddice/cambio verdetto
- `⚔` sfida (avvocato del diavolo) · `◈` conferme di sistema

## Logo

- Glifo bianco su fondo scuro: uso standard.
- Su superfici chiare o incontrollabili (favicon, avatar, embed): **piastra
  scura** `#08080a` con angoli arrotondati dietro al glifo — mai il logo
  bianco nudo su fondo chiaro (sparisce).
- File: `public/logo.png` (glifo), `app/icon.png` / `app/favicon.ico`
  (versione su piastra).

## Asset social — regole pratiche

1. Screenshot del prodotto reale su `#08080a`, ritagliati larghi (il grafo
   respira), senza cornici di browser.
2. Una sola idea per asset: una tesi, un verdetto, un knowledge tree.
3. Testo sovrapposto minimo: la frase in Fraunces corsivo + eventuale label
   lowercase. Niente titoloni bold urlati.
4. La OG image del sito (grafo + cascata Domande/Tesi/Portafogli) è il
   riferimento di densità e tono.

## Cosa NON fare

- Niente stock photo: trader alla scrivania, grafici a candele, tori/orsi,
  monete che piovono.
- Niente frecce verdi "al rialzo" con percentuali di guadagno (vietato anche
  legalmente: vedi `contesto-brand.md`).
- Niente gradienti fluo, emoji-pioggia, badge "100% GRATIS".
- Non alterare i colori semantici (verde = conferma, rosso = invalida:
  mai usarli decorativamente invertiti).

---

**Fonti di verità nel repo:** `app/synapse/style.ts` e `app/market/ui.tsx`
(palette e componenti), `app/welcome/page.tsx` (landing e Fraunces),
`app/opengraph-image.tsx` (OG image di riferimento), `public/logo.png` +
`app/icon.png` (logo e piastra).
