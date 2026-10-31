'use client';
import { useState } from 'react';
import { ArrowRight, ArrowUpRight, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { AIProvider } from '@/lib/ai-provider';
export default function AIConnection({connected,provider,model,demo,onConnected,onDisconnect,onOpen}:{connected:boolean;provider:AIProvider;model:string;demo:boolean;onConnected:(key:string,provider:AIProvider,model:string)=>void;onDisconnect:()=>void;onOpen:()=>void}){
  const [choice,setChoice]=useState<AIProvider>(provider),[key,setKey]=useState(''),[visible,setVisible]=useState(false),[checking,setChecking]=useState(false),[error,setError]=useState('');
  const title=choice==='gemini'?'Google Gemini':'Groq',link=choice==='gemini'?'https://aistudio.google.com/apikey':'https://console.groq.com/keys';
  async function connect(){
    if(!key.trim()){setError('Paste your '+title+' API key first.');return;}
    setChecking(true);setError('');
    try{
      const response=await fetch('/api/ai/connect',{method:'POST',headers:{'x-ai-key':key.trim(),'x-ai-provider':choice},signal:AbortSignal.timeout(55000)});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not connect. Try again.');
      onConnected(key.trim(),choice,result.model);setKey('');
    }catch(e){setError(e instanceof Error&&e.name==='TimeoutError'?'The connection check timed out. Try again.':e instanceof Error?e.message:'Connection failed. Try again.');}
    finally{setChecking(false);}
  }
  return <section className="panel ai-settings">
    <div className="integration-title"><span className="integration-logo gemini"><Sparkles size={26}/></span><div><h2>AI assistant</h2><p>Write emails. Find answers. Keep work moving.</p></div><span className={'connection-badge '+(connected?'connected':'')}>{connected?'Live AI connected':'Built-in ready'}</span></div>
    <div className="builtin-ready"><span><CheckCircle2 size={17}/><strong>Useful from the first message</strong><small>Email templates, lead summaries, tasks, and listing matches work without a key.</small></span><button className="button secondary" onClick={onOpen}>Open assistant<ArrowUpRight size={14}/></button></div>
    {connected?<div className="connected-state"><span><CheckCircle2 size={19}/><strong>{provider==='gemini'?'Gemini':'Groq'} · {model}</strong><small>Verified with a real response · This tab only</small></span><button className="button secondary" onClick={onDisconnect}>Disconnect</button></div>:<>
      <p className="integration-description">Connect a free-tier provider for natural conversations and custom email writing. Usage limits depend on your provider account.</p>
      <div className="ai-provider-options" aria-label="AI provider">{(['gemini','groq'] as const).map(p=><button className={choice===p?'chosen':''} key={p} aria-pressed={choice===p} disabled={checking} onClick={()=>{setChoice(p);setKey('');setError('');}}><span className="provider-mark">{p==='gemini'?<Sparkles size={19}/>:<span>g</span>}</span><span><strong>{p==='gemini'?'Google Gemini':'Groq'}</strong><small>{p==='gemini'?'Flash-Lite · Free tier available':'Fast open models · Free plan'}</small></span>{choice===p&&<CheckCircle2 size={16}/>}</button>)}</div>
      <div className="ai-connect-help"><a href={link} target="_blank" rel="noreferrer">Get a {title} key<ArrowUpRight size={13}/></a><span>Automatic model selection · Generation verified</span></div>
      {demo?<div className="ai-demo-notice"><p>Built-in tools are active in the demo. Sign in to connect your own AI key.</p><a className="button secondary" href="/login">Sign in<ArrowRight size={14}/></a></div>:<form onSubmit={e=>{e.preventDefault();void connect();}}><label className="key-label" htmlFor="ai-api-key">{title} API key</label><div className="key-input"><KeyRound size={17}/><input id="ai-api-key" type={visible?'text':'password'} autoComplete="off" spellCheck={false} value={key} maxLength={256} disabled={checking} onChange={e=>{setKey(e.target.value);setError('');}} placeholder={choice==='gemini'?'Paste your Google AI Studio key':'Paste your Groq key'} aria-describedby={error?'ai-connection-error':'ai-privacy'}/><button type="button" className="icon-button" aria-label={visible?'Hide API key':'Show API key'} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={16}/>:<Eye size={16}/>}</button><button className="button primary" disabled={checking}>{checking?<><RefreshCw size={14} className="spin"/>Checking models…</>:<>Connect<ArrowRight size={14}/></>}</button></div>
      {error&&<div className="ai-connection-error" id="ai-connection-error" role="alert"><span>{error}</span><button type="button" className="icon-button" aria-label="Dismiss connection error" onClick={()=>setError('')}><X size={15}/></button></div>}
      <p className="key-note" id="ai-privacy"><LockKeyhole size={13}/>By connecting, you allow workspace summaries and chat to be sent to {title}. Contacts are masked. Your key stays in this tab’s session storage; disconnect clears it.</p></form>}
    </>}
    <div className="notice compact"><ShieldCheck size={16}/><span>Review every email and proposed change. Nothing is sent automatically.</span></div>
  </section>;
}
