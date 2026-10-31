import { day, shiftDate, dueLabel, money, isOpen, matchProperty, STAGES, templateDraft, type Lead, type Workspace } from './domain.ts';
import type { AssistantMessage } from './assistant.ts';

export const isEmailRequest=(text:string)=>/\be-?mail\b|\bdraft\b|\bcompose\b|\bwrite\b.*\b(message|reply|letter)\b/i.test(text);
const isRevision=(text:string)=>/\b(shorter|shorten|concise|warmer|friendly|friendlier|professional|rewrite|revise|improve|formal|casual)\b/i.test(text);
type Options={leadId?:string;tone?:string;history?:AssistantMessage[];view?:string};
function findLead(state:Workspace,text:string){
  const query=text.toLowerCase(),full=state.leads.filter(l=>query.includes(l.name.toLowerCase()));
  if(full.length===1)return full[0];
  const first=state.leads.filter(l=>{const name=l.name.split(' ')[0];return name.length>2&&new RegExp('\\b'+name.replace(/[.*+?^\x24{}()|[\]\\]/g,'\\$&')+'\\b','i').test(text);});
  return first.length===1?first[0]:undefined;
}
function emailFor(lead:Lead|undefined,text:string,tone:string,sender:string){
  const recipient=lead?.name.split(' ')[0]||'[Recipient Name]',sign=sender||'[Your Name]';
  const concise=tone==='Concise'||/\bshorter|shorten|concise\b/i.test(text),warm=tone==='Warm'||/\bwarm|friendly|friendlier\b/i.test(text);
  const hello=warm?'I hope you’re doing well. ':'';
  let subject='Following up',body='';
  if(/\bviewing|showing|appointment\b/i.test(text)){
    const date=text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0]||(/\btomorrow\b/i.test(text)?'tomorrow':/\btoday\b/i.test(text)?'today':'[date]');
    const time=text.match(/\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/i)?.[0]||'[time]';
    subject='Property viewing confirmation';
    body='Hi '+recipient+',\n\n'+hello+'I’m confirming your property viewing on '+date+' at '+time+' at [property or meeting point]. Please let me know if this still works for you'+(concise?'.':', or if you need to reschedule.')+'\n\n'+(concise?'Best,':'Thank you,')+'\n'+sign;
  }else if(/\bthank|after.*(?:call|meeting|viewing)\b/i.test(text)){
    subject='Thank you for your time';
    body='Hi '+recipient+',\n\nThank you for taking the time to speak with me. '+(lead?'I’ll use your preferences for a '+lead.type.toLowerCase()+' in '+lead.area+' as we review the next options.':'I appreciated the chance to discuss [topic].')+'\n\nPlease let me know if you have any questions or updates.\n\nBest,\n'+sign;
  }else if(/\bre.?engag|inactive|long time|checking back\b/i.test(text)){
    subject=lead?'Still looking in '+lead.area+'?':'Checking in';
    body='Hi '+recipient+',\n\n'+hello+(lead?'Are you still looking for a '+lead.type.toLowerCase()+' in '+lead.area+'?':'I wanted to check whether [topic] is still a priority for you.')+' If your plans have changed, I’m happy to adjust.'+(concise?'':' Let me know what would be most helpful right now.')+'\n\nBest,\n'+sign;
  }else if(lead)return templateDraft(lead,concise?'Concise':warm?'Warm':'Professional',sign);
  else{subject='Following up on [topic]';body='Hi '+recipient+',\n\n'+hello+'I’m following up on [topic]. '+(concise?'Could you share an update when convenient?':'Could you share an update, or let me know if you need anything from me to move forward?')+'\n\nThank you,\n'+sign;}
  return {subject,body};
}
export function localAssistantReply(state:Workspace,message:string,options:Options={}):AssistantMessage{
  const history=options.history||[],last=[...history].reverse().find(h=>h.role==='assistant'&&!h.error);
  const named=findLead(state,message),selected=state.leads.find(l=>l.id===options.leadId),priorDraft=[...history].reverse().find(h=>h.draft)?.draft;
  const pendingEmail=!!last?.choices?.length&&/Who is this email for|What should the email cover/i.test(last.text),revising=isRevision(message)&&!!priorDraft;
  const lead=named||selected||(revising?state.leads.find(l=>l.id===priorDraft?.leadId):undefined);
  const email=isEmailRequest(message)||revising||(pendingEmail&&(!!named||/\bgeneral\b/i.test(message)));
  const reply:AssistantMessage={id:globalThis.crypto?.randomUUID?.()||'reply-'+Date.now(),role:'assistant',provider:'Built-in',text:''};
  if(email){
    if(!lead&&!/\bgeneral|template|recipient name\b/i.test(message)&&!revising){
      reply.text='Who is this email for? Choose a lead, or start with a general template.';
      reply.choices=[...state.leads.slice(0,5).map(l=>({label:l.name,prompt:'Draft an email for '+l.name+'.'})),{label:'General email',prompt:'Draft a general email template.'}];return reply;
    }
    const earlier=revising&&priorDraft?priorDraft.subject+'\n'+priorDraft.body:history.filter(h=>h.role==='user'&&isEmailRequest(h.text)).slice(-1)[0]?.text||'';
    reply.draft={leadId:lead?.id||priorDraft?.leadId||'',...emailFor(lead,(pendingEmail||revising?earlier+'\n':'')+message,options.tone||'Professional',state.settings.name)};
    reply.text=lead?'Here’s an email for '+lead.name+'. Edit it below, then save or copy.':'Here’s a starter email. Replace the bracketed details, or tell me the recipient and purpose.';
    reply.choices=[{label:'Make it shorter',prompt:'Make this email shorter.'},{label:'Warmer tone',prompt:'Make this email warmer.'}];return reply;
  }
  if(lead&&/\b(remind|schedule|add|create|set)\b.*\b(task|reminder|call|follow.?up|viewing)\b|\bremind me\b/i.test(message)){
    const date=message.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0]||(/\btoday\b/i.test(message)?day():day(1));
    const explicit=message.replace(/^.*?\b(?:remind me to|task to|task:|reminder to|schedule a|schedule an)\s*/i,'').replace(new RegExp(lead.name,'ig'),'').replace(/\b(today|tomorrow|on \d{4}-\d{2}-\d{2})\b/ig,'').replace(/[?.]+$/,'').trim();
    const title=explicit&&explicit.length<120&&!/\bcreate|add|remind|schedule\b/i.test(explicit)?explicit[0].toUpperCase()+explicit.slice(1):'Follow up with '+lead.name;
    reply.text='Review this task for '+lead.name+'.';reply.proposal={type:'task',leadId:lead.id,title,dueDate:date};return reply;
  }
  if(lead&&/\bmove\b|\bchange\b.*\bstage\b/i.test(message)){
    const stage=STAGES.find(s=>new RegExp('\\b'+s+'\\b','i').test(message));
    if(stage){reply.text='Move '+lead.name+' from '+lead.stage+' to '+stage+'?';reply.proposal={type:'stage',leadId:lead.id,stage};}else reply.text='Which stage should '+lead.name+' move to? Available stages: '+STAGES.join(', ')+'.';return reply;
  }
  if(/\bmatch|listing|propert(?:y|ies)\b/i.test(message)){
    if(lead){
      const matches=state.properties.map(p=>({p,...matchProperty(lead,p)})).filter(m=>m.score>0).sort((a,b)=>b.score-a.score).slice(0,5);
      reply.text='Listing matches for '+lead.name+':\n\n'+(matches.map(m=>'• '+m.p.name+' — '+money(m.p.price)+'\n  '+m.reasons.join(' · ')+(m.p.price>lead.budget?'\n  Above the recorded budget.':'')).join('\n\n')||'No listings match the recorded preferences. Try a different area, type, or budget.');
      reply.choices=[{label:'Draft follow-up',prompt:'Draft a follow-up email for '+lead.name+'.'}];
    }else reply.text=state.properties.length?'Your '+state.properties.length+' listings:\n\n'+state.properties.slice(0,8).map(p=>'• '+p.name+' — '+p.area+' · '+p.type+' · '+money(p.price)).join('\n')+'\n\nName a lead to compare these against their preferences.':'No listings yet. Add a property in Properties to start matching.';
    return reply;
  }
  if(lead){
    const tasks=state.tasks.filter(t=>t.leadId===lead.id&&!t.done);
    reply.text=lead.name+'\n'+lead.stage+' · '+lead.area+' · '+lead.type+'\nBudget: '+money(lead.budget)+'\nTimeline: '+lead.timeline+'\nFollow-up: '+dueLabel(lead.followUp)+'\nLast contact: '+(lead.lastContact?dueLabel(lead.lastContact):'Not recorded')+'\n\n'+(lead.notes?'Notes: '+lead.notes+'\n\n':'')+(tasks.length?'Open tasks:\n'+tasks.slice(0,5).map(t=>'• '+t.title+' — '+dueLabel(t.due)).join('\n'):'No open tasks for this lead.');
    reply.choices=[{label:'Draft email',prompt:'Draft an email for '+lead.name+'.'},{label:'Find listings',prompt:'Find listings for '+lead.name+'.'}];return reply;
  }
  if(/\bpipeline|stage|stalled|conversion\b/i.test(message)){
    const stalled=state.leads.filter(l=>isOpen(l)&&(!l.lastContact||l.lastContact<=shiftDate(day(),-7)));
    reply.text='Pipeline\n\n'+STAGES.map(s=>s+': '+state.leads.filter(l=>l.stage===s).length).join('\n')+'\n\n'+stalled.length+' active leads have no contact recorded in the past 7 days.'+(stalled.length?'\n'+stalled.slice(0,5).map(l=>'• '+l.name+' — '+l.stage).join('\n'):'');return reply;
  }
  if(/\btask|overdue|priorit|today|focus|follow.?up|next step|plan\b/i.test(message)){
    const due=state.tasks.filter(t=>!t.done&&t.due<=day()).sort((a,b)=>(a.due+a.time).localeCompare(b.due+b.time)),leads=state.leads.filter(l=>isOpen(l)&&l.followUp&&l.followUp<=day());
    reply.text=due.length?due.length+' tasks need attention:\n\n'+due.slice(0,8).map((t,i)=>(i+1)+'. '+t.title+' — '+(state.leads.find(l=>l.id===t.leadId)?.name||'Workspace')+', '+dueLabel(t.due)).join('\n'):'No tasks are due today.';
    if(leads.length)reply.text+='\n\n'+leads.length+' leads have a follow-up due: '+leads.slice(0,6).map(l=>l.name).join(', ')+'.';
    reply.choices=[{label:'Draft a follow-up',prompt:'Create a follow-up email.'}];return reply;
  }
  reply.text=/^(hi|hello|hey|thanks|thank you)[!. ]*$/i.test(message)?'Hi! What would you like to work on?':'I can draft emails, look up leads, match listings, and review tasks. Choose an option or name a lead. Connect Gemini or Groq in Settings for open-ended AI questions.';
  reply.choices=[{label:'Write an email',prompt:'Create an email.'},{label:'Plan today',prompt:'What should I focus on today?'},{label:'Pipeline summary',prompt:'Summarize my pipeline.'}];return reply;
}
