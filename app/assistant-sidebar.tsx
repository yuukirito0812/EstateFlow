'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Check, Copy, Mail, Mic, MicOff, PanelRightClose, Plus, RotateCcw, Send, Settings2, Sparkles, Square, X } from 'lucide-react';
import { day, dueLabel, money, newId, STAGES, templateDraft, type Workspace } from '@/lib/domain';
import { assistantMessageSchema, type AssistantMessage, type AssistantProposal } from '@/lib/assistant';

type Recognition = {
  lang:string;continuous:boolean;interimResults:boolean;
  onresult:((event:{results:{length:number;[index:number]:{isFinal:boolean;0:{transcript:string}}}})=>void)|null;
  onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;
  start:()=>void;stop:()=>void;abort:()=>void;
};
type SpeechWindow=Window & {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
export type AssistantRequest={id:string;leadId:string};
type Props={data:Workspace;view:string;open:boolean;demo:boolean;scope:string;apiKey:string;model:string;busy:boolean;request:AssistantRequest|null;onMinimize:()=>void;onSettings:()=>void;onDraft:(leadId:string,subject:string,body:string,provider?:string)=>Promise<boolean>;onProposal:(proposal:AssistantProposal)=>Promise<boolean>};

export default function AssistantSidebar({data,view,open,demo,scope,apiKey,model,busy,request,onMinimize,onSettings,onDraft,onProposal}:Props){
  const [messages,setMessages]=useState<AssistantMessage[]>([]),[input,setInput]=useState(''),[thinking,setThinking]=useState(false);
  const [leadId,setLeadId]=useState(''),[tone,setTone]=useState('Professional'),[listening,setListening]=useState(false),[speechSupported,setSpeechSupported]=useState(false),[speechError,setSpeechError]=useState(''),[interim,setInterim]=useState(''),[copied,setCopied]=useState('');
  const [loadedScope,setLoadedScope]=useState('');
  const scrollRef=useRef<HTMLDivElement>(null),inputRef=useRef<HTMLTextAreaElement>(null),controller=useRef<AbortController|null>(null),recognition=useRef<Recognition|null>(null),inFlight=useRef(false),handledRequest=useRef(''),copyTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const applying=useRef(false);
  const storageKey=`estateflow-chat-v2:${scope}`;
  const selected=data.leads.find(lead=>lead.id===leadId);
  const names=useMemo(()=>new Map(data.leads.map(lead=>[lead.id,lead.name])),[data.leads]);

  useEffect(()=>{if(!scope)return;try{const saved=JSON.parse(sessionStorage.getItem(storageKey)||'[]');setMessages(Array.isArray(saved)?saved.slice(-60).flatMap(item=>{const result=assistantMessageSchema.safeParse(item);return result.success?[result.data]:[];}):[]);}catch{setMessages([]);}setLoadedScope(scope);},[scope,storageKey]);
  useEffect(()=>{if(loadedScope!==scope||!scope)return;try{sessionStorage.setItem(storageKey,JSON.stringify(messages.slice(-60)));}catch{/* Chat still works if storage is unavailable. */}},[messages,loadedScope,scope,storageKey]);
  useEffect(()=>{const w=window as SpeechWindow;setSpeechSupported(!!(w.SpeechRecognition||w.webkitSpeechRecognition));return()=>{controller.current?.abort();recognition.current?.abort();if(copyTimer.current)clearTimeout(copyTimer.current);};},[]);
  useEffect(()=>{if(!open){recognition.current?.stop();return;}const box=scrollRef.current;if(box)box.scrollTo({top:box.scrollHeight,behavior:'auto'});},[open,messages,thinking]);
  useEffect(()=>{if(!request||handledRequest.current===request.id||!scope)return;handledRequest.current=request.id;setLeadId(request.leadId);setInput('Draft a follow-up email.');inputRef.current?.focus();},[request,scope]);

  async function copy(text:string,id:string){try{await navigator.clipboard.writeText(text);setCopied(id);if(copyTimer.current)clearTimeout(copyTimer.current);copyTimer.current=setTimeout(()=>setCopied(''),1800);}catch{setSpeechError('Copy is unavailable. Select the message text to copy it.');}}
  function stop(){controller.current?.abort();recognition.current?.stop();}
  function startVoice(){
    setSpeechError('');if(listening){recognition.current?.stop();return;}
    const Speech=(window as SpeechWindow).SpeechRecognition||(window as SpeechWindow).webkitSpeechRecognition;
    if(!Speech){setSpeechError('Voice input is unavailable in this browser. Use Chrome or Edge, or type your message.');return;}
    const instance=new Speech(),base=input.trim();let finalText='';instance.lang='en-PH';instance.continuous=false;instance.interimResults=true;
    instance.onresult=event=>{let interimText='';finalText='';for(let i=0;i<event.results.length;i++){if(event.results[i].isFinal)finalText+=event.results[i][0].transcript+' ';else interimText+=event.results[i][0].transcript;}setInput([base,finalText.trim()].filter(Boolean).join(' ').slice(0,4000));setInterim(interimText);};
    instance.onerror=event=>{setListening(false);setInterim('');setSpeechError(event.error==='not-allowed'||event.error==='service-not-allowed'?'Allow microphone access in your browser’s site settings, then try again.':event.error==='no-speech'?'No speech detected. Tap the microphone to try again.':event.error==='audio-capture'?'No microphone found. Connect one and try again.':event.error==='network'?'The browser speech service could not connect. Check your connection or type your message.':'Voice input stopped. Try again.');};
    instance.onend=()=>{setListening(false);setInterim('');recognition.current=null;inputRef.current?.focus();};
    recognition.current=instance;try{instance.start();setListening(true);}catch{setSpeechError('Could not start the microphone. Check browser permissions and try again.');recognition.current=null;}
  }

  async function send(override?:string){
    const text=(override||input).trim();if(!text||inFlight.current)return;recognition.current?.stop();setInput('');setSpeechError('');
    const user:AssistantMessage={id:newId(),role:'user',text};const history=messages.filter(message=>!message.error).slice(-12);setMessages(list=>[...list,user].slice(-60));inFlight.current=true;setThinking(true);
    const abort=new AbortController();controller.current=abort;
    try{
      if(apiKey&&!demo){
        const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json','x-ai-key':apiKey},body:JSON.stringify({message:text,leadId:leadId||undefined,model,tone,view,history:history.map(message=>({role:message.role,text:message.text,draft:message.draft,proposal:message.proposal,actioned:message.actioned}))}),signal:abort.signal});
        const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not get a response. Try again.');
        const parsed=assistantMessageSchema.parse({id:newId(),role:'assistant',text:result.reply,provider:'Gemini',draft:result.draft,proposal:result.proposal});setMessages(list=>[...list,parsed].slice(-60));
      }else{
        const lead=data.leads.find(l=>text.toLowerCase().includes(l.name.toLowerCase()))||data.leads.find(l=>text.toLowerCase().includes(l.name.split(' ')[0].toLowerCase()))||selected;
        const answer:AssistantMessage={id:newId(),role:'assistant',text:'',provider:'Workspace tools'};
        if(/draft|write|compose/i.test(text)){
          if(!lead){answer.text='Choose a lead above, then ask me to draft the email.';}else{answer.text=`Here is a ${tone.toLowerCase()} template for ${lead.name}.`;answer.draft={leadId:lead.id,...templateDraft(lead,tone,data.settings.name)};}
        }else if(/schedule|remind|task/i.test(text)&&lead){answer.text=`Add this task for ${lead.name}?`;answer.proposal={type:'task',leadId:lead.id,title:`Follow up with ${lead.name}`,dueDate:/today/i.test(text)?day():day(1)};}
        else if(/move|stage|qualified/i.test(text)&&lead){const stage=STAGES.find(s=>text.toLowerCase().includes(s.toLowerCase()));if(stage){answer.text=`Move ${lead.name} to ${stage}?`;answer.proposal={type:'stage',leadId:lead.id,stage};}else answer.text='Name the stage you want to move this lead to.';}
        else{const due=data.tasks.filter(t=>!t.done&&t.due<=day()).sort((a,b)=>(a.due+a.time).localeCompare(b.due+b.time));answer.text=`${due.length} tasks need attention.\n\n${due.slice(0,6).map((t,i)=>`${i+1}. ${t.title} — ${names.get(t.leadId)||'Workspace'}, ${dueLabel(t.due)}`).join('\n')||'No tasks are due.'}\n\n${data.leads.filter(l=>!['Won','Lost'].includes(l.stage)).length} active leads · ${data.properties.length} listings · ${data.drafts.filter(d=>d.status==='Needs review').length} drafts awaiting review.\n\n${demo?'Sign in and connect Gemini for a live conversation.':'Connect Gemini in Settings for open-ended questions.'}`;}
        setMessages(list=>[...list,answer].slice(-60));
      }
    }catch(e){setMessages(list=>[...list,{id:newId(),role:'assistant' as const,text:abort.signal.aborted?'Response stopped.':e instanceof Error?e.message:'Connection failed. Try again.',error:true,retry:text}].slice(-60));}
    finally{inFlight.current=false;setThinking(false);controller.current=null;}
  }

  async function apply(message:AssistantMessage){if(message.actioned||busy||applying.current)return;applying.current=true;try{let ok=false;if(message.draft)ok=await onDraft(message.draft.leadId,message.draft.subject,message.draft.body,message.provider==='Gemini'?'Gemini':'Template');else if(message.proposal)ok=await onProposal(message.proposal);if(ok)setMessages(list=>list.map(item=>item.id===message.id?{...item,actioned:true}:item));}finally{applying.current=false;}}
  const quickPrompts=selected?[['Draft email',`Draft a follow-up email for ${selected.name}.`],['Find a match',`Which listings fit ${selected.name}? Explain the match.`],['Next step',`What should I do next for ${selected.name}?`]]:[['Plan today','Prioritize today’s follow-ups and explain why.'],['Pipeline','Summarize my pipeline and identify stalled leads.'],['Listings','Which leads match my listings?']];
  return <aside className="assistant-dock" hidden={!open} aria-label="AI assistant">
    <header className="assistant-heading"><span className="assistant-icon"><Sparkles size={19}/></span><div><h2>Assistant</h2><p><i className={apiKey&&!demo?'online':''}/>{apiKey&&!demo?'Gemini connected':demo?'Demo tools':'Workspace tools'}</p></div><button className="icon-button" aria-label="New conversation" title="New conversation" onClick={()=>{stop();setMessages([]);setInput('');}} disabled={thinking}><Plus size={17}/></button><button className="icon-button" onClick={onMinimize} aria-label="Minimize assistant" title="Minimize assistant"><PanelRightClose size={18}/></button></header>
    <div className="assistant-context"><div className="assistant-page"><span className="context-live"/>Live context <strong>{view}</strong><button className="icon-button" aria-label="AI settings" onClick={onSettings}><Settings2 size={14}/></button></div><label className="assistant-focus"><span>Focus</span><select value={selected?.id||''} onChange={e=>setLeadId(e.target.value)} aria-label="Assistant lead focus"><option value="">Entire workspace</option>{data.leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>{selected&&<p className="assistant-selected">{selected.stage} · {selected.area} · {money(selected.budget)}</p>}</div>
    <div className="assistant-thread" ref={scrollRef} role="log" aria-live="polite" aria-relevant="additions" aria-busy={thinking}>
      {!messages.length&&<div className="assistant-welcome"><span className="assistant-welcome-icon"><Sparkles size={25}/></span><h3>How can I help?</h3><p>Ask about your leads, draft an email, or plan your next step.</p><div className="assistant-capabilities"><span>{data.leads.length} leads</span><span>{data.properties.length} listings</span><span>{data.tasks.filter(t=>!t.done).length} open tasks</span></div>{!apiKey&&<button className="assistant-connect" onClick={onSettings}>{demo?'Sign in for live AI':'Connect Gemini'}<ArrowUpRight size={14}/></button>}</div>}
      {messages.map(message=><article className={'assistant-message '+message.role+(message.error?' has-error':'')} key={message.id}><div className="assistant-message-label">{message.role==='user'?'You':message.error?'Assistant':message.provider||'Assistant'}{message.role==='assistant'&&!message.error&&<button className="icon-button" aria-label="Copy response" onClick={()=>void copy(message.text,message.id)}>{copied===message.id?<Check size={13}/>:<Copy size={13}/>}</button>}</div><div className="assistant-message-text">{message.text}</div>
        {message.draft&&<div className="assistant-draft"><span><Mail size={13}/>Email draft</span><strong>{message.draft.subject}</strong><p>{message.draft.body.replaceAll('[First Name]',names.get(message.draft.leadId)?.split(' ')[0]||'[First Name]').replaceAll('[Agent Name]',data.settings.name)}</p><div><button className="button primary" disabled={busy||message.actioned} onClick={()=>void apply(message)}>{message.actioned?<><Check size={13}/>Saved</>:'Save to drafts'}</button><button className="icon-button" aria-label="Copy email draft" onClick={()=>void copy(`Subject: ${message.draft!.subject}\n\n${message.draft!.body}`,message.id+'draft')}>{copied===message.id+'draft'?<Check size={14}/>:<Copy size={14}/>}</button></div></div>}
        {message.proposal&&<div className="assistant-proposal"><strong>{names.get(message.proposal.leadId)||'Lead'}</strong><p>{message.proposal.type==='task'?`${message.proposal.title} · ${dueLabel(message.proposal.dueDate||day())}`:`Move to ${message.proposal.stage}`}</p><button className="button primary" disabled={busy||message.actioned} onClick={()=>void apply(message)}>{message.actioned?<><Check size={13}/>Applied</>:'Confirm change'}</button></div>}
        {message.error&&message.retry&&<button className="assistant-retry" disabled={thinking} onClick={()=>void send(message.retry)}><RotateCcw size={13}/>Retry</button>}
      </article>)}
      {thinking&&<div className="assistant-thinking"><span/><span/><span/>Working…<button onClick={stop} aria-label="Stop response"><Square size={12}/></button></div>}
    </div>
    <div className="assistant-bottom"><div className="assistant-suggestions">{quickPrompts.map(([label,prompt])=><button key={label} disabled={thinking} onClick={()=>void send(prompt)}>{label}</button>)}</div>
      <form className="assistant-composer" onSubmit={e=>{e.preventDefault();void send();}}><textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} maxLength={4000} rows={3} placeholder="Ask a question or describe a task…" aria-label="Message assistant" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/><div className="assistant-compose-tools"><select value={tone} onChange={e=>setTone(e.target.value)} aria-label="Email tone">{['Professional','Warm','Concise'].map(value=><option key={value}>{value}</option>)}</select><button type="button" className={'icon-button mic-button '+(listening?'listening':'')} onClick={startVoice} disabled={thinking} aria-label={listening?'Stop microphone':'Start microphone'} aria-pressed={listening} title={speechSupported?'Dictate your message':'Check voice input availability'}>{listening?<MicOff size={18}/>:<Mic size={18}/>}</button>{thinking?<button type="button" className="assistant-send" onClick={stop} aria-label="Stop response"><Square size={15}/></button>:<button className="assistant-send" disabled={!input.trim()||listening} aria-label="Send message"><Send size={16}/></button>}</div></form>
      {listening&&<p className="assistant-voice-status" role="status">{interim||'Listening… tap the microphone to finish.'}</p>}{speechError&&<div className="assistant-inline-error" role="alert"><span>{speechError}</span><button aria-label="Dismiss voice message" onClick={()=>setSpeechError('')}><X size={13}/></button></div>}
      <p className="assistant-footnote">{listening?'Review the transcript before sending.':apiKey&&!demo?'Emails and changes need your review.':'Connect Gemini for live AI.'}</p>
    </div>
  </aside>;
}
