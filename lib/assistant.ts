import { z } from 'zod';
import { STAGES, type Workspace } from './domain.ts';

export const proposalSchema=z.discriminatedUnion('type',[
  z.object({type:z.literal('task'),leadId:z.string().max(80),title:z.string().min(1).max(200),dueDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}),
  z.object({type:z.literal('stage'),leadId:z.string().max(80),stage:z.enum(STAGES)})
]);
export const emailSchema=z.object({leadId:z.string().max(80),subject:z.string().min(1).max(200),body:z.string().min(1).max(10000)});
export const assistantOutputSchema=z.object({reply:z.string().min(1).max(8000),proposal:proposalSchema.nullish().transform(value=>value||undefined),draft:emailSchema.nullish().transform(value=>value||undefined)});
export const assistantMessageSchema=z.object({id:z.string().max(80),role:z.enum(['user','assistant']),text:z.string().max(8000),provider:z.string().max(80).optional(),draft:emailSchema.optional(),proposal:proposalSchema.optional(),actioned:z.boolean().optional(),error:z.boolean().optional(),retry:z.string().max(4000).optional()});
export type AssistantMessage=z.infer<typeof assistantMessageSchema>;
export type AssistantProposal=z.infer<typeof proposalSchema>;

export function redactContacts(text:string){
  return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email removed]')
    .replace(/(?:\+?\d[\d ()-]{7,}\d)/g,value=>/^\d{4}-\d{2}-\d{2}$/.test(value)?value:'[phone removed]')
    .replace(/(?:AIza[\w-]{25,}|sk-[\w-]{20,})/g,'[key removed]');
}

export function buildAssistantContext(state:Workspace,message:string,leadId?:string){
  const query=message.toLowerCase();
  const focus=new Set(state.leads.filter(l=>l.id===leadId||query.includes(l.id.toLowerCase())||query.includes(l.name.toLowerCase())).map(l=>l.id));
  const contacts=state.leads.flatMap(lead=>[lead.email,lead.phone]).filter(Boolean);
  const matcher=contacts.length?new RegExp(contacts.map(value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'gi'):null;
  const scrub=(text:string)=>redactContacts(matcher?text.replace(matcher,'[contact removed]'):text);
  const counts=Object.fromEntries(STAGES.map(stage=>[stage,state.leads.filter(l=>l.stage===stage).length]));
  return {
    summary:{leadCount:state.leads.length,taskCount:state.tasks.length,listingCount:state.properties.length,draftCount:state.drafts.length,pipeline:counts},
    leads:state.leads.map(l=>({id:l.id,name:l.name,area:l.area,type:l.type,budget:l.budget,timeline:l.timeline,stage:l.stage,followUp:l.followUp,lastContact:l.lastContact,tags:l.tags.map(scrub),notes:scrub(l.notes).slice(0,600)})),
    notes:state.leads.filter(l=>focus.has(l.id)).map(l=>({leadId:l.id,notes:scrub(l.notes)})),
    tasks:state.tasks.map(t=>({id:t.id,leadId:t.leadId,title:scrub(t.title),due:t.due,time:t.time,kind:t.kind,done:t.done})),
    properties:state.properties.map(p=>({...p,description:scrub(p.description).slice(0,500)})),
    drafts:state.drafts.map((d,i)=>({id:d.id,leadId:d.leadId,subject:scrub(d.subject),status:d.status,provider:d.provider,createdAt:d.createdAt,...(focus.has(d.leadId)||i<5?{body:scrub(d.body)}:{})})),
    recentActivity:state.activities.slice(0,60).map(a=>({leadId:a.leadId,text:scrub(a.text),at:a.at,kind:a.kind})),
    agentName:state.settings.name,
    coverage:'All lead, task, listing and draft summaries, plus the first 600 characters of each lead note. Full notes for named/selected leads, focused or five latest draft bodies, and 60 recent activity entries.'
  };
}

export function validateAssistantOutput(value:unknown,state:Workspace){
  const parsed=assistantOutputSchema.parse(value);
  for(const field of ['draft','proposal'] as const){if(parsed[field]&&!state.leads.some(l=>l.id===parsed[field]!.leadId))throw new Error('The response referred to an unknown lead. Please name the lead and retry.');}
  return parsed;
}

export const geminiResponseSchema={type:'OBJECT',properties:{reply:{type:'STRING'},draft:{type:'OBJECT',nullable:true,properties:{leadId:{type:'STRING'},subject:{type:'STRING'},body:{type:'STRING'}},required:['leadId','subject','body']},proposal:{type:'OBJECT',nullable:true,properties:{type:{type:'STRING',enum:['task','stage']},leadId:{type:'STRING'},title:{type:'STRING'},dueDate:{type:'STRING'},stage:{type:'STRING',enum:[...STAGES]}},required:['type','leadId']}},required:['reply']};
