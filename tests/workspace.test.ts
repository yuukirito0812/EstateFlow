import test from 'node:test';
import assert from 'node:assert/strict';
import { seedWorkspace, workspaceSchema,day } from '../lib/domain.ts';
import { getNotifications } from '../lib/notifications.ts';
import { buildAssistantContext,redactContacts,validateAssistantOutput } from '../lib/assistant.ts';

test('viewed notifications stay read after save/reload; rescheduling creates a fresh reminder',()=>{
  const state=seedWorkspace();
  const notices=getNotifications(state,day());
  assert.ok(notices.length>0);
  state.settings.notificationReads=notices.map(item=>item.key);
  const restored=workspaceSchema.parse(JSON.parse(JSON.stringify(state)));
  assert.ok(getNotifications(restored,day()).every(item=>item.read));
  restored.tasks[0].time='16:00';
  assert.equal(getNotifications(restored,day()).filter(item=>!item.read).length,1);
  restored.tasks[0].done=true;
  assert.ok(getNotifications(restored,day()).every(item=>item.read));
});

test('notification reads are backward compatible and do not mark a task complete',()=>{
  const old=seedWorkspace();
  const raw=JSON.parse(JSON.stringify(old));delete raw.settings.notificationReads;
  const restored=workspaceSchema.parse(raw);
  assert.deepEqual(restored.settings.notificationReads,[]);
  restored.settings.notificationReads=getNotifications(restored,day()).map(item=>item.key);
  assert.equal(restored.tasks[0].done,false);
});

test('AI context covers every workspace collection and masks contact details in notes and drafts',()=>{
  const state=seedWorkspace();const lead=state.leads[0];
  lead.notes='Balcony preferred. Email private@sample.com or call +639171234567.';
  const payload=buildAssistantContext(state,'Draft a reply',lead.id);
  const text=JSON.stringify(payload);
  assert.equal(payload.leads.length,state.leads.length);
  assert.equal(payload.tasks.length,state.tasks.length);
  assert.equal(payload.properties.length,state.properties.length);
  assert.equal(payload.drafts.length,state.drafts.length);
  assert.ok(text.includes('Balcony preferred'));
  for(const value of [lead.email,lead.phone,'private@sample.com','+639171234567'])assert.ok(!text.includes(value),value);
  assert.ok(redactContacts('Contact private@sample.com').includes('[email removed]'));
});

test('invalid model actions are rejected before they can be applied',()=>{
  const state=seedWorkspace();
  for(const proposal of [
    {type:'stage',leadId:'missing',stage:'Qualified'},
    {type:'stage',leadId:'L001',stage:'Auto approved'},
    {type:'task',leadId:'L001',title:'Follow up'},
  ])assert.throws(()=>validateAssistantOutput({reply:'Proposed',proposal},state));
  assert.equal(validateAssistantOutput({reply:'Here is the overview.',draft:null,proposal:null},state).proposal,undefined);
});
