'use client';
// Privacy policy minima (GDPR) per la beta pubblica. NON è consulenza legale:
// farla rivedere prima di crescere.
import { usePublicLang, LangToggle } from '@/lib/i18n-public';

const T = {
  it: {
    title: 'Privacy policy',
    updated: 'Ultimo aggiornamento: 2 luglio 2026',
    sections: [
      ['Titolare del trattamento', 'Il titolare del trattamento è Tommaso Zanatta. Contatto: tommasozanatta@icloud.com.'],
      ['Dati raccolti', 'Account: indirizzo email e credenziali gestite da Supabase (autenticazione). Contenuti: le domande che poni, le analisi generate, tesi, portafogli dichiarati e preferenze del profilo (es. nome pubblico). Analytics: eventi d\'uso, pagine visitate e replay di sessione tramite PostHog (server nell\'UE), associati a un identificativo pseudonimo. Cookie tecnici di sessione necessari al login.'],
      ['Finalità e base giuridica', 'Erogare il servizio (esecuzione del contratto, art. 6.1.b GDPR): account, salvataggio del grafo, generazione delle analisi tramite modelli AI (Anthropic) e dati di mercato di terze parti. Migliorare il prodotto (legittimo interesse, art. 6.1.f): analytics aggregati. Il portafoglio dichiarato è usato solo per contestualizzare le tue analisi e non è mai visibile ad altri utenti.'],
      ['Dove vanno i dati', 'Supabase (database e autenticazione), Vercel (hosting), Anthropic (elaborazione delle domande da parte del modello AI), PostHog EU (analytics), fornitori di dati di mercato (ricevono solo i simboli richiesti, mai la tua identità). Le tesi che scegli di pubblicare nel marketplace sono visibili ad altri utenti in forma anonima (hash) o col nome pubblico che hai scelto.'],
      ['Conservazione', 'I dati restano finché mantieni l\'account. Puoi eliminare singole analisi e tesi in autonomia; per l\'eliminazione completa dell\'account scrivi al contatto sopra.'],
      ['I tuoi diritti', 'Accesso, rettifica, cancellazione, limitazione, portabilità e opposizione (artt. 15-21 GDPR), scrivendo a tommasozanatta@icloud.com. Hai anche il diritto di reclamo al Garante per la protezione dei dati personali.'],
      ['Nota', 'Le analisi generate hanno scopo esclusivamente informativo ed educativo e non costituiscono consulenza finanziaria.'],
    ],
    back: '← torna al sito',
  },
  en: {
    title: 'Privacy policy',
    updated: 'Last updated: July 2, 2026',
    sections: [
      ['Data controller', 'The data controller is Tommaso Zanatta. Contact: tommasozanatta@icloud.com.'],
      ['Data we collect', 'Account: email address and credentials managed by Supabase (authentication). Content: the questions you ask, generated analyses, theses, declared portfolio and profile preferences (e.g. public name). Analytics: usage events, page views and session replay via PostHog (EU servers), tied to a pseudonymous identifier. Technical session cookies required for login.'],
      ['Purpose and legal basis', 'Providing the service (contract performance, art. 6.1.b GDPR): account, graph storage, AI-generated analyses (Anthropic) and third-party market data. Product improvement (legitimate interest, art. 6.1.f): aggregate analytics. Your declared portfolio is only used to contextualize your own analyses and is never visible to other users.'],
      ['Where data goes', 'Supabase (database and authentication), Vercel (hosting), Anthropic (AI processing of your questions), PostHog EU (analytics), market data providers (they only receive requested symbols, never your identity). Theses you choose to publish on the marketplace are visible to other users anonymously (hash) or under the public name you picked.'],
      ['Retention', 'Data is kept as long as you keep your account. You can delete individual analyses and theses yourself; for full account deletion write to the contact above.'],
      ['Your rights', 'Access, rectification, erasure, restriction, portability and objection (arts. 15-21 GDPR) by writing to tommasozanatta@icloud.com. You may also lodge a complaint with your supervisory authority.'],
      ['Note', 'Generated analyses are for informational and educational purposes only and do not constitute financial advice.'],
    ],
    back: '← back to site',
  },
};

export default function PrivacyPage() {
  const [lang, setLang] = usePublicLang();
  const t = T[lang];
  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#e8e8f0', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #1f1f28' }}>
        <a href="/welcome" style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 300, color: '#e8e8f0', textDecoration: 'none' }}>Symnaps</a>
        <span style={{ marginLeft: 'auto' }} />
        <LangToggle lang={lang} setLang={setLang} />
      </div>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 18px 60px' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 30, fontWeight: 300, marginBottom: 6 }}>{t.title}</div>
        <div style={{ fontSize: 11, color: '#5a5a78', marginBottom: 28 }}>{t.updated}</div>
        {t.sections.map(([h, p], i) => (
          <div key={i} style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#b8b8cc', marginBottom: 6 }}>{h}</div>
            <div style={{ fontSize: 12.5, color: '#8a8aa5', lineHeight: 1.7 }}>{p}</div>
          </div>
        ))}
        <a href="/welcome" style={{ color: '#7a7a95', fontSize: 11.5 }}>{t.back}</a>
      </div>
    </div>
  );
}
