import DOMPurify from 'dompurify';

// Unico confine HTML dinamico del renderer legacy. I nuovi pannelli usano DOM.
export function safeHTML(value: unknown): string {
  return DOMPurify.sanitize(String(value ?? ''), {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['canvas'],
    FORBID_TAGS: ['style', 'form', 'iframe', 'object', 'embed', 'img', 'video', 'audio'],
    FORBID_ATTR: ['srcdoc'],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}
export function escapeHTML(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
