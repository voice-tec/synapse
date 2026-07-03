import { ImageResponse } from 'next/og';

// OG image generata a runtime (convenzione opengraph-image): niente asset da
// mantenere, stesso tema del prodotto. Vale per tutte le route (root segment).
export const runtime = 'edge';
export const alt = 'Symnaps — domande, tesi, portafogli: financial intelligence a grafo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const C = { bg: '#08080a', q: '#5b9cf6', t: '#a78bfa', p: '#34d399', muted: '#7a7a95', border: '#2a2a36' };
// Esagono pointy-top come drawHex() del grafo, centrato su (0,0), raggio ~46
const HEX = '46,0 23,40 -23,40 -46,0 -23,-40 23,-40';

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: C.bg, position: 'relative', fontFamily: 'sans-serif' }}>
        {/* alone radiale morbido dietro il grafo */}
        <div style={{ position: 'absolute', right: -120, top: 40, width: 640, height: 560, borderRadius: 320, background: 'radial-gradient(circle, rgba(167,139,250,0.16), rgba(8,8,10,0))' }} />

        {/* colonna testo */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 0 0 84px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
            <div style={{ display: 'flex', fontSize: 26, color: C.muted, letterSpacing: 4, textTransform: 'uppercase' }}>Symnaps</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 92, fontWeight: 700, lineHeight: 1.05, letterSpacing: -3 }}>
            <span style={{ color: C.q }}>Domande.</span>
            <span style={{ color: C.t }}>Tesi.</span>
            <span style={{ color: C.p }}>Portafogli.</span>
          </div>
          <div style={{ display: 'flex', marginTop: 30, fontSize: 26, color: C.muted, maxWidth: 560, lineHeight: 1.4 }}>
            Il grafo che trasforma le tue domande di finanza in tesi con un track record misurato su dati reali.
          </div>
          <div style={{ display: 'flex', marginTop: 34, fontSize: 22, color: '#5a5a78' }}>symnaps.com</div>
        </div>

        {/* mini-grafo: domande → tesi (esagono con arco) → portafoglio */}
        <div style={{ display: 'flex', width: 460, height: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="420" height="480" viewBox="0 0 420 480">
            {/* archi */}
            <line x1="80" y1="110" x2="210" y2="240" stroke={C.t} strokeWidth="2.5" strokeDasharray="7 7" opacity="0.7" />
            <line x1="70" y1="360" x2="210" y2="240" stroke={C.t} strokeWidth="2.5" strokeDasharray="7 7" opacity="0.7" />
            <line x1="210" y1="240" x2="350" y2="250" stroke={C.p} strokeWidth="2.5" strokeDasharray="7 7" opacity="0.7" />
            {/* domande: cerchi blu */}
            <circle cx="80" cy="110" r="34" fill="#0e0e12" stroke={C.q} strokeWidth="5" />
            <circle cx="70" cy="360" r="30" fill="#0e0e12" stroke={C.q} strokeWidth="5" />
            {/* tesi: esagono viola + arco confidenza */}
            <g transform="translate(210, 240)">
              <polygon points={HEX} fill="#0d0a18" stroke={C.t} strokeWidth="5" />
              <circle cx="0" cy="0" r="58" fill="none" stroke={C.t} strokeWidth="5" strokeDasharray="262 364" strokeLinecap="round" transform="rotate(-90)" opacity="0.65" />
            </g>
            {/* portafoglio: quadrato verde */}
            <rect x="318" y="218" width="64" height="64" fill="#0a1a14" stroke={C.p} strokeWidth="5" />
          </svg>
        </div>
      </div>
    ),
    size
  );
}
