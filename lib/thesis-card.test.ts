import { describe, expect, it } from 'vitest';
import { signalPredicates, validateRevision } from './thesis-card';
import { computeConfidence, deriveOutcome, evalSignals } from './confidence';
const input={revision:1,thesis:'Hypothesis',reason:'New evidence',workflow_state:'monitoring',assets:['SPY'],evaluation_deadline:'2027-01-31'};
describe('versioned thesis contract',()=>{
 it('whitelists research and excludes forged original/status/metrics',()=>{
  const result=validateRevision({...input,original_hypothesis:'forged',status:'confirmed',accuracy:100,user_id:'other'});
  expect(result).not.toHaveProperty('status'); expect(result).not.toHaveProperty('accuracy');expect(result).not.toHaveProperty('original_hypothesis');expect(result).not.toHaveProperty('user_id');
 });
 it.each([{revision:0},{reason:''},{thesis:''},{workflow_state:'confirmed'},{assets:['']},{evaluation_deadline:'2027-02-31'}])('rejects invalid revision %j',patch=>{expect(()=>validateRevision({...input,...patch})).toThrow();});
 it('preserves imported fundamentals and legacy text without importing evaluation state',async()=>{
  const signals=signalPredicates({confirm:[{kind:'fund',metric:'MSFT',field:'pe',op:'<',threshold:30,fired:true,checked_at:'yesterday'},'Legacy note']});
  expect(signals.confirm[0].field).toBe('pe'); expect(signals.confirm[0]).not.toHaveProperty('fired');expect(signals.confirm[1].text).toBe('Legacy note');
  const result=await evalSignals(signals,'2026-10-22',{latestFredValue:async()=>null,fetchTickerPerformance:async()=>null,fetchFundamental:async()=>25});
  expect(result.confirmFired).toBe(1);
 });
 it('stable imported conviction can reach confirmation without compounding previous adjustments',()=>{
  const importedBase=75;
  const first=computeConfidence(importedBase,2,0), refresh=computeConfidence(importedBase,2,0);
  expect(first).toBe(refresh); expect(deriveOutcome(2,0,2,refresh).status).toBe('confirmed');
 });
});
describe('signal evaluation hygiene',()=>{
 it('rejects invalid operators, nonfinite data and stale manual results without mutating inputs',async()=>{
  const stale={kind:'manual',fired:true,checked_at:'old'};
  const invalid={kind:'fred',metric:'CPIAUCSL',op:'=',threshold:3};
  const missing={kind:'fred',metric:'CPIAUCSL',op:'<',threshold:3};
  const result=await evalSignals({confirm:[stale,invalid,missing]},'2026-10-22',{latestFredValue:async()=>NaN,fetchTickerPerformance:async()=>null});
  expect(result.testableTotal).toBe(0);expect(result.confirmFired).toBe(0);expect(result.signals.confirm[0]).not.toHaveProperty('fired');expect(stale.fired).toBe(true);
  expect(result.signals.confirm[2].data_missing).toBe(true);
 });
});
it('does not treat duplicate observations as independent confirmations',async()=>{
 const a={kind:'fred',metric:'CPIAUCSL',op:'<',threshold:3};
 const b={...a,threshold:1};
 const deps={latestFredValue:async()=>2,fetchTickerPerformance:async()=>null};
 const first=await evalSignals({confirm:[a,a,b]},'2026-10-22',deps);
 const reverse=await evalSignals({confirm:[b,a,a]},'2026-10-22',deps);
 expect(first.testableTotal).toBe(1);expect(first.confirmFired).toBe(1);expect(reverse.confirmFired).toBe(1);
 expect(deriveOutcome(first.confirmFired,0,first.testableTotal,99).status).toBe('active');
});
