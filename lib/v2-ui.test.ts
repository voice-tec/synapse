// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { safeHTML, escapeHTML } from './safe-html';
import { mountThesisCard } from './thesis-card-ui';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const thesis={id:'00000000-0000-4000-8000-000000000010',cluster_id:'test',thesis:'Current',original_hypothesis:'Original',revision:1,assets:['SPY'],workflow_state:'monitoring',created_at:'2026-10-22T12:00:00Z'};
const versions=[{revision:1,recorded_at:'2026-10-22T12:00:00Z',reason:'migration_baseline',snapshot:thesis}];
const settle=()=>new Promise(r=>setTimeout(r,0));
afterEach(()=>{vi.unstubAllGlobals();document.body.replaceChildren();});
describe('safe graph rendering',()=>{
 it('removes executable HTML and unsafe URLs while preserving the drawer structure',()=>{
  const host=document.createElement('div');host.innerHTML=safeHTML(`<div class="hero"><canvas id="dc-test"></canvas><img src=x onerror=alert(1)><svg onload=alert(1)></svg><a href="javascript:alert(1)" onclick="alert(1)">source</a><script>alert(1)</script><span style="color:red">text</span></div>`);
  expect(host.querySelector('script,img,svg')).toBeNull();expect(host.querySelector('[onclick],[onerror],[onload]')).toBeNull();expect(host.querySelector('a')?.hasAttribute('href')).toBe(false);expect(host.querySelector('canvas')?.id).toBe('dc-test');expect(host.querySelector('.hero')).not.toBeNull();
 });
 it('keeps untrusted text literal including quotes and entities',()=>{
  const host=document.createElement('div');const input='<b title="x">& malicious</b>';
  host.innerHTML=safeHTML(escapeHTML(input));expect(host.textContent).toBe(input);expect(host.querySelector('b')).toBeNull();
 });
 it('guards every graph HTML assignment and insertion',()=>{
  const source=readFileSync('public/synapse/graph.js','utf8');const ast=ts.createSourceFile('graph.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  let sinks=0;const visit=(n:ts.Node)=>{
   if(ts.isBinaryExpression(n)&&ts.isPropertyAccessExpression(n.left)&&n.left.name.text==='innerHTML') {sinks++;expect(n.right.getText(ast)).toMatch(/^safeHTML\(/);}
   if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='insertAdjacentHTML'){sinks++;expect(n.arguments[1].getText(ast)).toMatch(/^safeHTML\(/);}
   ts.forEachChild(n,visit);
  };visit(ast);expect(sinks).toBeGreaterThan(30);
 });
});
describe('versioned drawer',()=>{
 it('preserves legacy controls and supports accessible tabs, save and history reload',async()=>{
  let current=thesis;
  const fetcher=vi.fn(async(_url:any, options:any)=>{
   if(options?.method==='PATCH') {const patch=JSON.parse(options.body);current={...current,...patch,revision:2};versions.unshift({revision:2,recorded_at:'2026-10-22T13:00:00Z',reason:patch.reason,snapshot:current});return {ok:true,status:200,json:async()=>({thesis:current})};}
   return {ok:true,status:200,json:async()=>({thesis:current,versions})};
  });vi.stubGlobal('fetch',fetcher);
  const body=document.createElement('div');document.body.append(body);const legacy=document.createElement('button');legacy.textContent='Legacy action';const click=vi.fn();legacy.onclick=click;body.append(legacy);
  const node={clusterId:'test',source_ids:['stale'],signals:{confirm:['stale']},pattern:'stale'};mountThesisCard(body,node,'en');await settle();expect(node.source_ids).toEqual([]);expect(node.signals).toBeUndefined();expect(node.pattern).toBeUndefined();legacy.click();expect(click).toHaveBeenCalledOnce();
  const tabs=body.querySelectorAll<HTMLButtonElement>('[role=tab]');expect(tabs).toHaveLength(5);
  tabs[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));expect(tabs[1].getAttribute('aria-selected')).toBe('true');tabs[0].click();
  const form=body.querySelector('form')!;(form.elements.namedItem('thesis') as HTMLTextAreaElement).value='<img src=x onerror=alert(1)> Revised';(form.elements.namedItem('reason') as HTMLTextAreaElement).value='New facts';
  form.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));await settle();await settle();
  expect(fetcher).toHaveBeenCalledTimes(3);expect((node as any).revision).toBe(2);expect(body.querySelector('img')).toBeNull();expect(body.textContent).toContain('Original');expect(body.textContent).toContain('New version saved');tabs[3].click();expect(body.querySelectorAll('.v2-version').length).toBeGreaterThan(1);
 });
 it('keeps edits on conflict and offers explicit reload',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(_url:any,opts:any)=>opts?.method==='PATCH'?{ok:false,status:409,json:async()=>({error:'revision_conflict'})}:{ok:true,json:async()=>({thesis,versions:[]})}));
  const body=document.createElement('div');document.body.append(body);mountThesisCard(body,{clusterId:'test'},'en');await settle();
  const form=body.querySelector('form')!;const input=form.elements.namedItem('thesis') as HTMLTextAreaElement;input.value='Unsaved';(form.elements.namedItem('reason') as HTMLTextAreaElement).value='Reason';form.dispatchEvent(new Event('submit',{cancelable:true}));await settle();expect(input.value).toBe('Unsaved');expect(body.textContent).toContain('The thesis changed');
 });
});

describe('existing graph smoke test',()=>{
 it('hydrates existing tasks/theses and opens their original drawers with safe content',async()=>{
  const { BODY_FOR }=await import('../app/synapse/body');document.body.innerHTML=BODY_FOR('en');
  const context=new Proxy({}, {get:(_t,key)=>key==='measureText'?()=>({width:40}):key==='createRadialGradient'||key==='createLinearGradient'?()=>({addColorStop(){}}):()=>{}});
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as any);
  vi.stubGlobal('requestAnimationFrame',vi.fn());vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({watches:[],updatedTheses:[],updatedActions:[]})})));
  const w=window as any;w.__SYN_INITIALIZED=false;w.__SYN_LANG='en';w.__synSafeHTML=safeHTML;w.__synEscapeHTML=escapeHTML;
  w.__SYN_PRELOAD={tasks:[{id:'00000000-0000-4000-8000-000000000100',raw_query:'<img src=x onerror=alert(1)> Question',intent:{analysis_type:'causal'},fingerprint:{},output:{insight:'<script>alert(1)</script> reasoning'},created_at:'2026-10-22'}],conns:[],theses:[{...thesis,id:'00000000-0000-4000-8000-000000000010',confidence:75,source_task_ids:[],color:'#a78bfa'}],actions:[]};
  window.eval(readFileSync('public/synapse/graph.js','utf8'));await settle();
  expect(w.__SYN_INITIALIZED).toBe(true);expect(typeof w.jumpToNode).toBe('function');
  w.jumpToNode('00000000-0000-4000-8000-000000000100');await new Promise(r=>setTimeout(r,450));
  expect(document.querySelector('#drawer')?.classList.contains('open')).toBe(true);expect(document.querySelector('#dr-query')?.textContent).toContain('<img');expect(document.querySelector('#dr-body script,#dr-query img')).toBeNull();
  w.openMemoryDrawer({id:thesis.id,clusterId:'test',thesis:'Existing hypothesis',confidence:75,source_ids:[],color:'#a78bfa'});
  expect(document.querySelector('.hero-thesis')?.textContent).toContain('Existing hypothesis');expect(document.querySelector('[id^=mem-publish-]')).not.toBeNull();
  vi.restoreAllMocks();
 });
});
it('loads and draws an imported-only graph without triggering empty onboarding',async()=>{
 const { BODY_FOR }=await import('../app/synapse/body');document.body.innerHTML=BODY_FOR('it');
 const calls:string[]=[];const context=new Proxy({}, {get:(_t,key)=>{calls.push(String(key));return key==='measureText'?()=>({width:40}):key==='createRadialGradient'||key==='createLinearGradient'?()=>({addColorStop(){}}):()=>{};}});
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as any);
 const frame=vi.fn();vi.stubGlobal('requestAnimationFrame',frame);vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({watches:[],updatedTheses:[],updatedActions:[]})})));
 const w=window as any;w.__SYN_INITIALIZED=false;w.__synSafeHTML=safeHTML;w.__synEscapeHTML=escapeHTML;w.__SYN_LANG='it';w.__SYN_PRELOAD={tasks:[],conns:[],theses:[{...thesis,confidence:75,color:'#a78bfa',source_task_ids:[],imported_from_author:'abc'}],actions:[]};
 window.eval(readFileSync('public/synapse/graph.js','utf8'));
 expect(w.MEMORY_NODES).toHaveLength(1);expect(w.TASKS).toHaveLength(0);
 calls.length=0;frame.mock.calls[0][0]();expect(calls).toContain('fillText');
 w.openMemoryDrawer(w.MEMORY_NODES[0]);expect(document.querySelector('.hero-thesis')?.textContent).toContain('Current');
 vi.restoreAllMocks();
});
