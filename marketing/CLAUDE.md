# CLAUDE.md — workspace marketing Symnaps

Questo è il workspace del team marketing per Symnaps. Vale per qualunque
lavoro dentro `marketing/`. Per il codice dell'app vale il CLAUDE.md di root.

## Struttura

```
_contesto/    fonte di verità del brand (NON si duplica, si carica)
_sop/         procedure operative standard per i flussi di marketing
_template/    scheletri riutilizzabili da compilare
ads/ landing/ presentazione/ report/ ricerca/ seo/
              → output finiti, salvati per tipologia
```

File di contesto e quando caricarli:

| File | Caricalo quando il task riguarda |
|---|---|
| `_contesto/guida-voce-brand.md` | **sempre** — ogni output testuale la rispetta |
| `_contesto/contesto-brand.md` | posizionamento, differenziatori, cosa è/non è Symnaps |
| `_contesto/contesto-growth-marketing.md` | target, canali, funnel, metriche, vincoli growth |
| `_contesto/guida-stile-brand.md` | asset visivi, screenshot, palette, logo |
| `_contesto/offerta-prodotti.md` | prezzi, piani, limiti, FAQ, obiezioni |

Non copiare fatti del brand (prezzi, hex, claim) dentro altri file di lavoro:
puntare a `_contesto/`. Se un fatto lì è sbagliato o vecchio, si corregge lì
(verificando sulle "Fonti di verità nel repo" in coda a ogni documento).

## Flusso per ogni task

1. Carica `_contesto/guida-voce-brand.md` + i file di contesto rilevanti
   (tabella sopra).
2. Se esiste una SOP per il flusso in `_sop/`, seguila.
3. Se esiste un template in `_template/`, parti da quello.
4. Salva l'output finito nella cartella della sua tipologia.
5. Registra l'uscita in `marketing/log-contenuti.md` (data, canale, link,
   eventuale tesi usata).

## Vincoli hard (compliance — nessuna eccezione)

- Mai consulenza finanziaria, mai raccomandazioni personalizzate, mai
  promesse di rendimento. Taglio educativo sempre; disclaimer sui contenuti
  che toccano strumenti o portafogli (testo standard in
  `guida-voce-brand.md`).
- Mai account finti, astroturfing o recensioni/engagement simulati
  (dettaglio in `_sop/sop-community.md`).

## Regole per le skill Claude di questo progetto

- **Brand-agnostic**: la skill definisce solo flusso di lavoro e processo.
  Mai nomi, claim, prezzi, colori o altri dettagli Symnaps nel file skill.
- La skill recupera il contesto del brand **a runtime**: nel corpo deve
  esserci l'istruzione di caricare i file rilevanti da `_contesto/` prima di
  produrre output. Così la skill resta riutilizzabile su altri brand
  cambiando solo la cartella di contesto.

## Regole per gli agenti

- Stessi vincoli: **brand-agnostic**, mai dettagli del brand nel file
  dell'agente; il contesto si legge a runtime da `_contesto/`.
- Ogni agente ha **un ruolo chiaro e non sovrapposto** (es. ricerca ≠
  scrittura ≠ revisione compliance): se due agenti potrebbero fare lo stesso
  lavoro, ridisegnare i confini prima di crearli.

## Lingua

Output in **italiano** di default (target IT-first). Inglese solo su
richiesta esplicita — la voce EN è definita in `guida-voce-brand.md`.
