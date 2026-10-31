'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, ChevronRight, LogOut, Settings2, Sparkles, X } from 'lucide-react';
import { Avatar } from './components';
import { getNotifications } from '@/lib/notifications';
import type { Workspace } from '@/lib/domain';

export default function WorkspaceToolbar({data,today,demo,busy,aiOpen,onAI,onRead,onNavigate}:{data:Workspace;today:string;demo:boolean;busy:boolean;aiOpen:boolean;onAI:()=>void;onRead:(keys:string[])=>Promise<boolean>;onNavigate:(view:'Integrations'|'Follow-ups'|'Leads',leadId?:string)=>void}) {
  const [panel,setPanel]=useState<'notifications'|'profile'|null>(null);
  const [limit,setLimit]=useState(20),[signingOut,setSigningOut]=useState(false),[error,setError]=useState('');
  const root=useRef<HTMLDivElement>(null);
  const items=useMemo(()=>getNotifications(data,today),[data,today]);
  const unread=items.filter(item=>!item.read).length;
  useEffect(()=>{if(!panel)return;function close(e:PointerEvent){if(!root.current?.contains(e.target as Node))setPanel(null);}function escape(e:KeyboardEvent){if(e.key==='Escape')setPanel(null);}document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};},[panel]);
  async function openNotifications(){if(panel==='notifications'){setPanel(null);return;}setLimit(20);setPanel('notifications');const keys=items.slice(0,20).filter(item=>!item.read).map(item=>item.key);if(keys.length)await onRead(keys);}
  async function signOut(){setSigningOut(true);setError('');try{const response=await fetch('/api/auth/signout',{method:'POST'});if(!response.ok)throw new Error('Sign-out failed. Try again.');for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i);if(key?.startsWith('estateflow-'))sessionStorage.removeItem(key);}window.location.assign('/login');}catch(e){setError(e instanceof Error?e.message:'Sign-out failed.');setSigningOut(false);}}
  return <div className="workspace-toolbar" ref={root}>

    <div className="notification-wrap"><button className="icon-button bell-button" onClick={()=>void openNotifications()} aria-label={`Notifications${unread?`, ${unread} unread`:''}`} aria-expanded={panel==='notifications'} title="Notifications"><Bell size={18}/>{unread>0&&<span className="unread-count">{unread>99?'99+':unread}</span>}</button>
    {panel==='notifications'&&<section className="notification-panel" aria-label="Notifications"><header className="notification-heading"><div><h3>Notifications</h3><p>{unread?`${unread} unread`:'All read'}</p></div><button className="icon-button" onClick={()=>setPanel(null)} aria-label="Close notifications"><X size={16}/></button></header>
      <div className="notification-actions"><span>Viewing marks reminders as read</span><button disabled={busy||!unread} onClick={()=>void onRead(items.filter(item=>!item.read).map(item=>item.key))}><CheckCheck size={14}/>Read all</button></div>
      <div className="notification-list">{items.slice(0,limit).map(item=><button className={'notification-item '+(item.read?'read':'unread')} key={item.key} onClick={()=>{if(!item.read)void onRead([item.key]);onNavigate(item.target,item.target==='Leads'?item.leadId:undefined);setPanel(null);}}><span className="notification-marker"/><span><strong>{item.title}</strong><small>{item.detail}</small></span><ChevronRight size={14}/></button>)}{!items.length&&<div className="notification-empty"><CheckCheck size={24}/><strong>You're up to date</strong><p>No follow-ups are due.</p></div>}</div>
      {items.length>limit&&<button className="notification-more" onClick={()=>{setLimit(n=>n+20);void onRead(items.slice(limit,limit+20).filter(item=>!item.read).map(item=>item.key));}}>Show more</button>}
      <button className="notification-more" onClick={()=>{onNavigate('Follow-ups');setPanel(null);}}>Open follow-ups<ChevronRight size={14}/></button>
    </section>}</div>
    <button className="profile-trigger" onClick={()=>setPanel(p=>p==='profile'?null:'profile')} aria-label="Open profile menu" aria-expanded={panel==='profile'}><Avatar name={data.settings.name||'Workspace'} small/></button>
    {panel==='profile'&&<section className="profile-menu" aria-label="Profile menu"><div className="profile-menu-heading"><strong>{data.settings.name||'Workspace owner'}</strong><small>{demo?'Demo workspace':data.settings.email||'Workspace owner'}</small></div><button onClick={()=>{onNavigate('Integrations');setPanel(null);}}><Settings2 size={16}/>Settings</button>{demo?<a href="/login"><LogOut size={16}/>Sign in</a>:<button onClick={()=>void signOut()} disabled={signingOut}><LogOut size={16}/>{signingOut?'Signing out…':'Sign out'}</button>}{error&&<p role="alert">{error}</p>}</section>}
  </div>;
}
