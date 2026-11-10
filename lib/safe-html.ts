import DOMPurify from 'dompurify';

let configured = false;
function configureSanitizer() {
  if (configured) return;
  // DOMPurify non filtra CSS: blocca risorse remote e sintassi CSS offuscata.
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName === 'style' && /url\s*\(|image-set\s*\(|expression\s*\(|@import|behavior|binding|[\\\/]/i.test(data.attrValue)) data.keepAttr = false;
  });
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName === 'A') node.setAttribute('rel', 'noopener noreferrer');
  });

  configured = true;
}

// Unico confine HTML dinamico del renderer legacy. I nuovi pannelli usano DOM.
export function safeHTML(value: unknown): string {
  configureSanitizer();
  return DOMPurify.sanitize(String(value ?? ''), {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['canvas'],
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['style', 'form', 'iframe', 'object', 'embed', 'img', 'video', 'audio'],
    FORBID_ATTR: ['srcdoc'],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}
export function escapeHTML(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
