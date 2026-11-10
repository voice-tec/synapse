// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { safeHTML } from './safe-html';
it('removes CSS resource loads while preserving graph styling and safe source links', () => {
 const host=document.createElement('div');
 host.innerHTML=safeHTML('<span style="background:url(https://attacker.test/track)">bad</span><span style="color:#a78bfa;display:flex">good</span><a href="https://example.com" target="_blank">source</a>');
 expect(host.querySelector('span')?.getAttribute('style')).toBeNull();
 expect(host.querySelectorAll('span')[1].getAttribute('style')).toContain('color');
 expect(host.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
 expect(host.querySelector('a')?.getAttribute('rel')).toContain('noopener');
});
it.each([
 '<a href="jav&#x61;script:alert(1)" onclick="alert(1)">AI source</a>',
 '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>">',
 '<svg><foreignObject><iframe srcdoc="<script>alert(1)</script>"></iframe></foreignObject></svg>',
 '<span style="background:u\\72l(https://attacker.test)">encoded</span>',
 '<span style="background:image-set(\'https:attacker.test\')">resource</span>',
])('sanitizes hostile user and AI markup %#', input=>{
 const host=document.createElement('div');host.innerHTML=safeHTML(input);
 expect(host.querySelector('script,img,iframe,svg,math,[onclick],[onerror],[srcdoc]')).toBeNull();
 expect(host.querySelector('[style]')).toBeNull();
 expect(host.querySelector('a')?.getAttribute('href')||'').not.toMatch(/javascript:/i);
});
