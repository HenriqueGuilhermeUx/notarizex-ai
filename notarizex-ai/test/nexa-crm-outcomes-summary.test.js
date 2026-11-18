'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {aggregateSupportOutcomes,handler}=require('../netlify/functions/nexa-crm-inbox-bridge');
const since=Date.parse('2026-11-11T12:00:00Z');
test('Nexa Theo seven-day summary aggregates honest counts, no identifiers',()=>{
  const r=aggregateSupportOutcomes([
    {status:'human_needed',intent:'handoff',updated_at:'2026-11-18T12:00:00Z',contact_phone:'11999990000',last_message:'some personal text'},
    {status:'new',intent:'duvida',updated_at:'2026-11-17T12:00:00Z'},
    {status:'human_needed',intent:'handoff',updated_at:'2026-10-10T00:00:00Z'},
  ],[
    {direction:'inbound',created_at:'2026-11-18T12:00:00Z',message:'private'},
    {direction:'outbound',created_at:'2026-11-18T12:01:00Z',delivery_status:'sent',contact_phone:'11999990000'},
    {direction:'outbound',created_at:'2026-11-18T12:02:00Z',delivery_status:'read'},
    {direction:'outbound',created_at:'2026-11-18T12:03:00Z',delivery_status:'failed'},
    {direction:'outbound',created_at:'2026-11-18T12:04:00Z',delivery_status:'submitted'},
    {direction:'outbound',created_at:'2026-10-10T12:00:00Z',delivery_status:'delivered'},
  ],since);
  assert.equal(r.activeConversations,2);
  assert.equal(r.queue.human_needed,1);
  assert.equal(r.intents.handoff,1);
  assert.equal(r.messages.inbound,1);
  assert.equal(r.messages.outbound,4);
  assert.equal(r.messages.providerSent,1);
  assert.equal(r.messages.providerRead,1);
  assert.equal(r.messages.providerFailed,1);
  assert.equal(r.messages.providerUnconfirmed,1);
  assert.equal(r.confirmedByProvider,2);
  assert.equal(r.resolutionRate,null);
  assert.equal(r.kycCompletionRate,null);
  assert.doesNotMatch(JSON.stringify(r),/11999990000|private|personal text/);
});
test('bridge denies anonymous summary access before database access',async()=>{
  const response=await handler({httpMethod:'GET',headers:{},queryStringParameters:{summary:'7d'}});
  assert.equal(response.statusCode,401);
  assert.equal(JSON.parse(response.body).error,'unauthorized');
});
test('unknown conversation statuses are counted without leaking arbitrary labels',()=>{
  const r=aggregateSupportOutcomes([
    {status:'SensitiveThing',intent:'untrusted',updated_at:'2026-11-18T12:00:00Z'},
  ],[],since);
  assert.equal(r.queue.other,1);
  assert.equal(r.intents.other,1);
  assert.doesNotMatch(JSON.stringify(r),/SensitiveThing|untrusted/);
});
