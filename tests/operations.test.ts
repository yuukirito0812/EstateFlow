import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleOperations, emptyOperations, operationsSchema, projectHealth, taskHealth, contactHealth, qualityIssues } from '../lib/operations.ts';
import { seedWorkspace, workspaceSchema } from '../lib/domain.ts';

test('portfolio operations sample has 16 projects, 28 contacts and 48 linked tasks',()=>{
 const data=sampleOperations();
 assert.equal(data.projects.length,16);
 assert.equal(data.contacts.length,28);
 assert.equal(data.tasks.length,48);
 assert.ok(data.projects.every(p=>p.id.startsWith('P-')));
 const projects=new Set(data.projects.map(p=>p.id));
 assert.ok(data.contacts.every(c=>projects.has(c.projectId)));
 assert.ok(data.tasks.every(t=>projects.has(t.projectId)));
 assert.deepEqual(operationsSchema.parse(data),data);
});
test('dated exceptions and data-quality checks reflect edits',()=>{
 const data=sampleOperations();
 const date='2026-11-13';
 assert.equal(projectHealth(data.projects[1],date),'Overdue');
 assert.equal(projectHealth(data.projects[4],date),'Complete');
 assert.equal(contactHealth(data.contacts[0],date),'Overdue');
 assert.equal(taskHealth(data.tasks[1],date),'Overdue');
 const issues=qualityIssues(data);
 assert.ok(issues.some(x=>x.kind==='Duplicate email'));
 assert.ok(issues.some(x=>x.kind==='Follow-up'));
 data.contacts[25].email='new.contact@example.com';
 assert.equal(qualityIssues(data).filter(i=>i.kind==='Duplicate email').length,0);
});
test('existing EstateFlow workspaces gain empty operations without losing existing data',()=>{
 const seed=seedWorkspace();
 const old=JSON.parse(JSON.stringify(seed));
 delete old.operations;
 const restored=workspaceSchema.parse(old);
 assert.deepEqual(restored.operations,emptyOperations());
 assert.equal(restored.leads.length,seed.leads.length);
 assert.equal(restored.tasks.length,seed.tasks.length);
});
