import test from 'node:test';
import assert from 'node:assert/strict';
import { seedWorkspace, workspaceSchema } from '../lib/domain.ts';
import { localAssistantReply } from '../lib/local-assistant.ts';
import { validateAssistantOutput } from '../lib/assistant.ts';
import { connectProvider, generateProvider, geminiCandidates, AIProviderError } from '../lib/ai-provider.ts';

const state=seedWorkspace(),lead=state.leads[0];
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
test('create me an email asks for a recipient instead of returning tasks',()=>{
  const answer=localAssistantReply(state,'can you create me an email');
  assert.match(answer.text,/Who is this email for/);assert.ok(answer.choices?.some(c=>c.label===lead.name));assert.equal(answer.proposal,undefined);assert.doesNotMatch(answer.text,/tasks need attention/);
});
test('email recipient choices and plain-name follow-up keep the email intent',()=>{
  const prompt='Create a viewing confirmation email for tomorrow at 3pm',question=localAssistantReply(state,prompt);
  const draft=localAssistantReply(state,lead.name,{history:[{id:'user',role:'user',text:prompt},question]});
  assert.equal(draft.draft?.leadId,lead.id);assert.match(draft.draft!.subject,/viewing/i);assert.match(draft.draft!.body,/tomorrow at 3pm/);assert.equal(draft.proposal,undefined);
  const revised=localAssistantReply(state,'Make this email shorter.',{history:[{id:'user',role:'user',text:prompt},question,{id:'user2',role:'user',text:lead.name},draft]});
  assert.equal(revised.draft?.leadId,lead.id);assert.match(revised.draft!.subject,/viewing/i);assert.ok(revised.draft!.body.length<draft.draft!.body.length);
});
test('generic emails work without a CRM lead and remain valid',()=>{
  const answer=localAssistantReply(state,'Create a general email template.');
  assert.equal(answer.draft?.leadId,'');assert.match(answer.draft!.body,/\[Recipient Name\]/);
  assert.equal(validateAssistantOutput({reply:answer.text,draft:answer.draft},state).draft?.leadId,'');
});
test('named email and explicit task requests produce distinct reviewed actions',()=>{
  const email=localAssistantReply(state,'Create an email for '+lead.name);
  assert.ok(email.draft);assert.equal(email.proposal,undefined);
  const task=localAssistantReply(state,'Remind me to call '+lead.name+' tomorrow');
  assert.equal(task.proposal?.type,'task');assert.equal(task.draft,undefined);
  const unknown=localAssistantReply(state,'Can you explain a contract clause?');
  assert.doesNotMatch(unknown.text,/tasks need attention/);assert.ok(unknown.choices?.length);
});
test('workspace names are backward compatible and validated',()=>{
  const old=JSON.parse(JSON.stringify(state));delete old.settings.workspaceName;
  assert.equal(workspaceSchema.parse(old).settings.workspaceName,'Workspace');
  assert.equal(workspaceSchema.safeParse({...state,settings:{...state.settings,workspaceName:''}}).success,false);
});
test('Gemini discovery prefers current free-tier Flash-Lite and excludes media models',()=>{
  const models=['gemini-2.5-flash-lite','gemini-3.1-flash-lite','gemini-3.5-flash-lite','gemini-3.5-flash-lite-tts','gemini-3.1-flash-image','gemini-4-argon'].map(name=>({name:'models/'+name,supportedGenerationMethods:['generateContent']}));
  assert.deepEqual(geminiCandidates(models).slice(0,3),['gemini-3.5-flash-lite','gemini-3.1-flash-lite','gemini-2.5-flash-lite']);
  assert.ok(geminiCandidates(models).every(m=>!/image|tts|argon/.test(m)));
});
test('connection checks continue past advertised but unavailable Gemini models',async()=>{
  const calls:string[]=[];
  const fetcher:typeof fetch=async(input)=>{const url=String(input);calls.push(url);if(url.includes('?pageSize'))return response({models:['gemini-3.5-flash-lite','gemini-3.1-flash-lite'].map(m=>({name:'models/'+m,supportedGenerationMethods:['generateContent']}))});if(url.includes('3.5'))return response({error:{message:'Model not found'}},404);return response({candidates:[{content:{parts:[{text:'OK'}]}}]});};
  const result=await connectProvider('test-only-key','gemini',new AbortController().signal,fetcher);
  assert.equal(result.model,'gemini-3.1-flash-lite');assert.equal(calls.length,3);
});
test('invalid keys stop early and quota failures are actionable',async()=>{
  await assert.rejects(()=>connectProvider('test-only-key','gemini',new AbortController().signal,async()=>response({error:{message:'API_KEY_INVALID'}},400)),(e:unknown)=>e instanceof AIProviderError&&e.code==='invalid_key');
  await assert.rejects(()=>connectProvider('test-only-key','groq',new AbortController().signal,async(input)=>String(input).endsWith('/models')?response({data:[{id:'openai/gpt-oss-20b'}]}):response({error:{message:'Rate limit'}},429)),(e:unknown)=>e instanceof AIProviderError&&e.code==='quota'&&/Built-in/.test(e.message));
});
test('chat automatically replaces a model that becomes unavailable',async()=>{
  const fetcher:typeof fetch=async(input)=>{const url=String(input);if(url.includes('2.5'))return response({error:{message:'Model unavailable'}},404);if(url.includes('?pageSize'))return response({models:[{name:'models/gemini-3.5-flash-lite',supportedGenerationMethods:['generateContent']}]});return response({candidates:[{content:{parts:[{text:'{"reply":"Hello"}'}]}}]});};
  const result=await generateProvider({key:'test-only-key',provider:'gemini',model:'gemini-2.5-flash-lite',system:'Test',turns:[{role:'user',text:'Hello'}],signal:new AbortController().signal},fetcher);
  assert.equal(result.model,'gemini-3.5-flash-lite');assert.equal(JSON.parse(result.text).reply,'Hello');
});
test('Groq uses its own key header and returns standard assistant JSON',async()=>{
  const fetcher:typeof fetch=async(_input,init)=>{assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer test-only-key');const body=JSON.parse(String(init?.body));assert.equal(body.response_format.type,'json_object');return response({choices:[{message:{content:'{"reply":"Email ready"}'},finish_reason:'stop'}]});};
  const result=await generateProvider({key:'test-only-key',provider:'groq',model:'openai/gpt-oss-20b',system:'Return JSON',turns:[{role:'user',text:'Create an email'}],signal:new AbortController().signal},fetcher);
  assert.equal(JSON.parse(result.text).reply,'Email ready');
});
