# SOP — Articolo SEO

> Come si produce un pezzo per la cartella `seo/`. Obiettivo: query
> informazionali italiane sul metodo di analisi, mai stock picking.

## Scelta della keyword

1. Query target = domande di metodo: "come analizzare un'azione", "come
   costruire una tesi di investimento", "cos'è il track record", "come
   valutare un consiglio finanziario", "inflazione e portafoglio".
2. Escludi a priori: "quale azione comprare", "previsioni [ticker]",
   "migliori azioni 2026" — traffico sbagliato, rischio compliance.
3. Verifica che la query abbia intento informazionale e che i primi
   risultati siano deboli/generici (spazio per un pezzo con metodo vero).

## Produzione

1. Compila il brief: `_template/template-articolo-seo.md` (title, H1, meta,
   scaletta, query secondarie).
2. Scrivi seguendo `_contesto/guida-voce-brand.md`: frasi corte, ogni numero
   con fonte, "dipende" ammesso.
3. **Aggancio prodotto**: ogni articolo dimostra il concetto con una tesi
   pubblica reale del marketplace (screenshot + link a `/market/t/[id]`).
   Il prodotto è l'esempio, non la pubblicità.
4. Un solo CTA, in fondo, sobrio: "Inizia da una domanda — gratis, senza
   carta" → symnaps.com.
5. Disclaimer educativo in coda (testo standard in `guida-voce-brand.md`).

## Revisione (checklist)

- [ ] La query è nel title, H1 e primi 100 caratteri, senza forzature
- [ ] Zero promesse di rendimento, zero "consigli"
- [ ] Almeno una fonte istituzionale citata (FRED/Twelve Data/FMP o simili)
- [ ] Screenshot conformi a `guida-stile-brand.md`
- [ ] Link interni: 1 a una pagina tesi, 1 a /market o /welcome
- [ ] Disclaimer presente
- [ ] Meta description ≤155 caratteri, voce del brand

## Dopo la pubblicazione

- Registra in `marketing/log-contenuti.md`.
- Ricicla: lo stesso pezzo diventa 1 thread X + 1 post LinkedIn
  (`sop-post-social.md`), mai copia-incolla — riscrivi per il formato.
