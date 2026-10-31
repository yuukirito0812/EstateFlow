'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Check, Copy, Mail, Mic, MicOff, MessageCircle, Minus, Pencil, Plus, RotateCcw, Send, Settings2, Sparkles, Square, X } from 'lucide-react';
import { day, dueLabel, money, newId, STAGES, templateDraft, type Workspace } from '@/lib/domain';
import { assistantMessageSchema, type AssistantMessage, type AssistantProposal } from '@/lib/assistant';
import { localAssistantReply } from '@/lib/local-assistant';
import type { AIProvider } from '@/lib/ai-provider';

type Recognition = {
  lang:string;continuous:boolean;interimResults:boolean;
  onresult:((event:{results:{length:number;[index:number]:{isFinal:boolean;0:{transcript:string}}}})=>void)|null;
  onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;
  start:()=>void;stop:()=>void;abort:()=>void;
};
type SpeechWindow=Window & {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
export type AssistantRequest={id:string;leadId:string};
type Props={data:Workspace;view:string;open:boolean;demo:boolean;scope:string;apiKey:string;model:string;provider:AIProvider;onRestore:()=>void;onModel:(model:string)=>void;busy:boolean;request:AssistantRequest|null;onMinimize:()=>void;onSettings:()=>void;onDraft:(leadId:string,subject:string,body:string,provider?:string)=>Promise<boolean>;onProposal:(proposal:AssistantProposal)=>Promise<boolean>};

export default function AssistantSidebar({data,view,open,demo,scope,apiKey,model,provider,onRestore,onModel,busy,request,onMinimize,onSettings,onDraft,onProposal}:Props){
  const [messages,setMessages]=useState<AssistantMessage[]>([]),[input,setInput]=useState(''),[thinking,setThinking]=useState(false);
  const [leadId,setLeadId]=useState(''),[tone,setTone]=useState('Professional'),[listening,setListening]=useState(false),[speechSupported,setSpeechSupported]=useState(false),[speechError,setSpeechError]=useState(''),[interim,setInterim]=useState(''),[copied,setCopied]=useState('');
  const [loadedScope,setLoadedScope]=useState(''),[preferBuiltIn,setPreferBuiltIn]=useState(false),[seenReplies,setSeenReplies]=useState(0);
  const live=!!apiKey&&!demo&&!preferBuiltIn,replyCount=messages.filter(m=>m.role==='assistant').length;
  useEffect(()=>{if(open)setSeenReplies(replyCount);},[open,replyCount]);
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

  async function send(override?:string,builtIn=false){
    const text=(override||input).trim();if(!text||inFlight.current)return;recognition.current?.stop();setInput('');setSpeechError('');
    const user:AssistantMessage={id:newId(),role:'user',text};const history=messages.filter(message=>!message.error).slice(-12);setMessages(list=>[...list,user].slice(-60));inFlight.current=true;setThinking(true);
    const abort=new AbortController();controller.current=abort;
    try{
      if(live&&!builtIn){
        const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json','x-ai-key':apiKey},body:JSON.stringify({message:text,leadId:leadId||undefined,model,provider,tone,view,history:history.map(message=>({role:message.role,text:message.text,draft:message.draft,proposal:message.proposal,actioned:message.actioned}))}),signal:abort.signal});
        const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not get a response. Try again.');
        if(result.model&&result.model!==model)onModel(result.model);
        const parsed=assistantMessageSchema.parse({id:newId(),role:'assistant',text:result.reply,provider:result.provider||'AI',draft:result.draft,proposal:result.proposal});setMessages(list=>[...list,parsed].slice(-60));
      }else{
        const answer=localAssistantReply(data,text,{leadId,tone,history:messages,view});
        setMessages(list=>[...list,answer].slice(-60));
      }
    }catch(e){setMessages(list=>[...list,{id:newId(),role:'assistant' as const,text:abort.signal.aborted?'Response stopped.':e instanceof Error?e.message:'Connection failed. Try again.',error:true,retry:text}].slice(-60));}
    finally{inFlight.current=false;setThinking(false);controller.current=null;}
  }

  async function apply(message:AssistantMessage,kind:'draft'|'proposal'){if(message.actioned||busy||applying.current||(kind==='draft'?message.draftSaved:message.proposalApplied))return;applying.current=true;try{let ok=false;if(kind==='draft'&&message.draft)ok=await onDraft(message.draft.leadId,message.draft.subject,message.draft.body,message.provider==='Built-in'?'Template':message.provider||'AI');else if(kind==='proposal'&&message.proposal)ok=await onProposal(message.proposal);if(ok)setMessages(list=>list.map(item=>item.id===message.id?{...item,...(kind==='draft'?{draftSaved:true}:{proposalApplied:true}),actioned:kind==='draft'?(!item.proposal||!!item.proposalApplied):(!item.draft||!!item.draftSaved)}:item));}finally{applying.current=false;}}
  const quickPrompts=selected?[['Draft email',`Draft a follow-up email for ${selected.name}.`],['Find a match',`Which listings fit ${selected.name}? Explain the match.`],['Next step',`What should I do next for ${selected.name}?`]]:[['Write email','Create an email.'],['Plan today','What should I focus on today?'],['Pipeline','Summarize my pipeline.']];
  return <>{!open&&<button className="assistant-launcher" onClick={()=>{onRestore();setTimeout(()=>inputRef.current?.focus(),100);}} aria-label="Open assistant" title="Chat with EstateFlow"><span className="assistant-launcher-halo"/><MessageCircle size={25}/><Sparkles size={11} className="bubble-spark"/>{replyCount>seenReplies&&<b>{replyCount-seenReplies}</b>}<span className="assistant-bubble-label">Ask EstateFlow</span></button>}<aside className="assistant-dock" hidden={!open} aria-label="AI assistant">
    <header className="assistant-heading"><span className="assistant-icon"><Sparkles size={19}/></span><div><h2>Assistant</h2><p><i className={live?'online':''}/>{live?(provider==='gemini'?'Gemini':'Groq')+' connected':'Built-in · No key needed'}</p></div><button className="icon-button" aria-label="New conversation" title="New conversation" onClick={()=>{stop();setMessages([]);setInput('');}} disabled={thinking}><Plus size={17}/></button><button className="icon-button" onClick={onMinimize} aria-label="Minimize assistant" title="Minimize assistant"><Minus size={18}/></button></header>
    <div className="assistant-context"><div className="assistant-page"><span className="context-live"/>Live context <strong>{view}</strong><button className="icon-button" aria-label="AI settings" onClick={onSettings}><Settings2 size={14}/></button></div><label className="assistant-focus"><span>Focus</span><select value={selected?.id||''} onChange={e=>setLeadId(e.target.value)} aria-label="Assistant lead focus"><option value="">Entire workspace</option>{data.leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>{selected&&<p className="assistant-selected">{selected.stage} · {selected.area} · {money(selected.budget)}</p>}</div>
    <div className="assistant-thread" ref={scrollRef} role="log" aria-live="polite" aria-relevant="additions" aria-busy={thinking}>
      {!messages.length&&<div className="assistant-welcome"><span className="assistant-welcome-icon"><Sparkles size={25}/></span><h3>How can I help?</h3><p>Write an email, explore your leads, or plan today’s work.</p><div className="assistant-capabilities"><span>{data.leads.length} leads</span><span>{data.properties.length} listings</span><span>{data.tasks.filter(t=>!t.done).length} open tasks</span></div>{!apiKey&&<button className="assistant-connect" onClick={onSettings}>{demo?'Explore AI options':'Connect live AI'}<ArrowUpRight size={14}/></button>}</div>}
      {messages.map(message=><article className={'assistant-message '+message.role+(message.error?' has-error':'')} key={message.id}><div className="assistant-message-label">{message.role==='user'?'You':message.error?'Assistant':message.provider||'Assistant'}{message.role==='assistant'&&!message.error&&<button className="icon-button" aria-label="Copy response" onClick={()=>void copy(message.text,message.id)}>{copied===message.id?<Check size={13}/>:<Copy size={13}/>}</button>}</div><div className="assistant-message-text">{message.text}</div>
        {message.draft&&<DraftCard message={message} leads={data.leads} busy={busy} copied={copied===message.id+'draft'} onCopy={()=>void copy('Subject: '+message.draft!.subject+'\n\n'+message.draft!.body,message.id+'draft')} onEdit={draft=>setMessages(list=>list.map(item=>item.id===message.id?{...item,draft}:item))} onSave={()=>void apply(message,'draft')}/>}
        {message.choices&&<div className="assistant-reply-choices">{message.choices.map(choice=><button key={choice.label} disabled={thinking} onClick={()=>void send(choice.prompt)}>{choice.label}<ArrowUpRight size={11}/></button>)}</div>}
        {message.proposal&&<div className="assistant-proposal"><strong>{names.get(message.proposal.leadId)||'Lead'}</strong><p>{message.proposal.type==='task'?`${message.proposal.title} · ${dueLabel(message.proposal.dueDate||day())}`:`Move to ${message.proposal.stage}`}</p><button className="button primary" disabled={busy||message.actioned||message.proposalApplied} onClick={()=>void apply(message,'proposal')}>{message.actioned||message.proposalApplied?<><Check size={13}/>Applied</>:'Confirm change'}</button></div>}
        {message.error&&message.retry&&<div className="assistant-error-actions"><button className="assistant-retry" disabled={thinking} onClick={()=>void send(message.retry)}><RotateCcw size={13}/>Retry</button><button className="assistant-retry" disabled={thinking} onClick={()=>void send(message.retry,true)}><Sparkles size={13}/>Use built-in tools</button></div>}
      </article>)}
      {thinking&&<div className="assistant-thinking"><span/><span/><span/>Working…<button onClick={stop} aria-label="Stop response"><Square size={12}/></button></div>}
    </div>
    <div className="assistant-bottom"><div className="assistant-suggestions">{quickPrompts.map(([label,prompt])=><button key={label} disabled={thinking} onClick={()=>void send(prompt)}>{label}</button>)}</div>
      <form className="assistant-composer" onSubmit={e=>{e.preventDefault();void send();}}><textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} maxLength={4000} rows={3} placeholder="Ask a question or describe a task…" aria-label="Message assistant" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/><div className="assistant-compose-tools"><select value={tone} onChange={e=>setTone(e.target.value)} aria-label="Email tone">{['Professional','Warm','Concise'].map(value=><option key={value}>{value}</option>)}</select><button type="button" className={'icon-button mic-button '+(listening?'listening':'')} onClick={startVoice} disabled={thinking} aria-label={listening?'Stop microphone':'Start microphone'} aria-pressed={listening} title={speechSupported?'Dictate your message':'Check voice input availability'}>{listening?<MicOff size={18}/>:<Mic size={18}/>}</button>{thinking?<button type="button" className="assistant-send" onClick={stop} aria-label="Stop response"><Square size={15}/></button>:<button className="assistant-send" disabled={!input.trim()||listening} aria-label="Send message"><Send size={16}/></button>}</div></form>
      {listening&&<p className="assistant-voice-status" role="status">{interim||'Listening… tap the microphone to finish.'}</p>}{speechError&&<div className="assistant-inline-error" role="alert"><span>{speechError}</span><button aria-label="Dismiss voice message" onClick={()=>setSpeechError('')}><X size={13}/></button></div>}
      <div className="assistant-mode-row">{apiKey&&!demo?<select value={preferBuiltIn?'builtin':'live'} onChange={e=>setPreferBuiltIn(e.target.value==='builtin')} aria-label="Assistant mode"><option value="live">{provider==='gemini'?'Gemini':'Groq'} AI</option><option value="builtin">Built-in tools</option></select>:<span>Built-in tools</span>}<p className="assistant-footnote">{listening?'Review your transcript.':'Review before saving.'}</p></div>
    </div>
  </aside></>;
}

function DraftCard({message,leads,busy,copied,onCopy,onEdit,onSave}:{message:AssistantMessage;leads:Workspace['leads'];busy:boolean;copied:boolean;onCopy:()=>void;onEdit:(draft:NonNullable<AssistantMessage['draft']>)=>void;onSave:()=>void}){
  const [editing,setEditing]=useState(false),draft=message.draft!;
  const saved=message.actioned||message.draftSaved,recipient=leads.find(l=>l.id===draft.leadId);
  return <div className="assistant-draft"><div className="assistant-draft-heading"><span><Mail size={13}/>Email draft</span><button className="icon-button" aria-label={editing?'Finish editing email':'Edit email draft'} onClick={()=>setEditing(v=>!v)} disabled={saved}>{editing?<Check size={14}/>:<Pencil size={14}/>}</button></div>
    {!recipient&&!saved&&<label className="assistant-recipient">Recipient<select value={draft.leadId} onChange={e=>{const lead=leads.find(l=>l.id===e.target.value);onEdit({...draft,leadId:e.target.value,body:lead?draft.body.replaceAll('[Recipient Name]',lead.name.split(' ')[0]).replaceAll('[First Name]',lead.name.split(' ')[0]):draft.body});}} aria-label="Draft recipient"><option value="">General email · Copy only</option>{leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}
    {recipient&&<small className="assistant-draft-to">For {recipient.name}</small>}
    {editing?<div className="assistant-draft-editor"><label>Subject<input aria-label="Edit email subject" value={draft.subject} maxLength={200} onChange={e=>onEdit({...draft,subject:e.target.value})}/></label><label>Message<textarea aria-label="Edit email body" rows={9} value={draft.body} maxLength={10000} onChange={e=>onEdit({...draft,body:e.target.value})}/></label></div>:<><strong>{draft.subject}</strong><p>{draft.body}</p></>}
    <div className="assistant-draft-actions"><button className="button primary" disabled={busy||saved||!recipient||!draft.subject.trim()||!draft.body.trim()} onClick={onSave}>{saved?<><Check size={13}/>Saved</>:<><Plus size={13}/>Save draft</>}</button><button className="button secondary" onClick={onCopy}>{copied?<Check size={13}/>:<Copy size={13}/>} {copied?'Copied':'Copy'}</button></div>
    {!recipient&&!saved&&<small className="assistant-draft-hint">Choose a lead to save, or copy this email.</small>}
  </div>;
}
