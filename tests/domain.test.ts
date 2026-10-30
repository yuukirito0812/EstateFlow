import test from 'node:test';
import assert from 'node:assert/strict';
import { seedWorkspace, workspaceSchema, templateDraft, priority, day } from '../lib/domain.ts';

test('the public demonstration contains fictional contacts and independent records', () => {
  const first = seedWorkspace();
  const second = seedWorkspace();
  assert.ok(workspaceSchema.safeParse(first).success);
  assert.ok(first.leads.every(lead => lead.email.endsWith('@example.com')));
  first.leads[0].notes = 'Changed in one session';
  assert.notEqual(second.leads[0].notes, first.leads[0].notes);
});

test('follow-up templates exclude private notes and contact channels', () => {
  const lead = { ...seedWorkspace().leads[0], notes: 'Private account detail 9182', email: 'private@example.invalid', phone: '+639999999999' };
  for (const tone of ['Warm', 'Professional', 'Concise']) {
    const draft = templateDraft(lead, tone, 'Demo Agent');
    for (const value of [lead.notes, lead.email, lead.phone]) assert.ok(!draft.body.includes(value));
    assert.ok(draft.body.includes('Demo Agent'));
  }
});

test('closed leads do not become urgent when an old follow-up date remains', () => {
  for (const stage of ['Won', 'Lost'] as const) {
    assert.equal(priority({ ...seedWorkspace().leads[0], stage, followUp: day(-10) }).label, 'Closed');
  }
});

test('the saved workspace rejects unsupported stages, negative budgets, and excessive data', () => {
  for (const update of [{ stage: 'Auto approved' }, { budget: -1 }, { notes: 'x'.repeat(5001) }]) {
    const state = seedWorkspace();
    Object.assign(state.leads[0], update);
    assert.equal(workspaceSchema.safeParse(state).success, false);
  }
});
