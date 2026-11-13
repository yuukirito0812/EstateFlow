'use client';
import { useMemo,useState } from 'react';
import { Activity,AlertTriangle,ArrowUpRight,Check,CheckCircle2,ClipboardList,Download,FileSpreadsheet,Filter,Plus,Search,ShieldCheck,Trash2,Users,X } from 'lucide-react';
import { day } from '@/lib/domain';
import { contactHealth,contactStages,emptyOperations,operationsSchema,priorities,projectHealth,projectStatuses,qualityIssues,sampleOperations,taskHealth,taskStatuses,type Operations,type OpsProject,type OpsContact,type OpsTask } from '@/lib/operations';
import './operations.css';

type Panel='Summary'|'Projects'|'CRM'|'Tasks'|'Data Quality';
type EditState={kind:'project';item:OpsProject}|{kind:'contact';item:OpsContact}|{kind:'task';item:OpsTask};
const tabs:Panel[]=['Summary','Projects','CRM','Tasks','Data Quality'];
const protect=(v:unknown)=>{const s=String(v??'');return '"'+(/^[=+\-@]/.test(s)?"'":'')+s.replaceAll('"','""')+'"';};
function csvDownload(name:string,columns:string[],rows:unknown[][]){
  const output=[columns,...rows].map(row=>row.map(protect).join(',')).join('\r\n');
  saveFile(name,output,'text/csv;charset=utf-8');
}
function saveFile(name:string,contents:string,type='text/plain'){
  const url=URL.createObjectURL(new Blob([contents],{type}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const readable=(date:string)=>date?new Intl.DateTimeFormat('en-AU',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')):'Not set';
function nextKey(prefix:string,items:{id:string}[]){
  const max=items.reduce((n,i)=>Math.max(n,Number(i.id.replace(/\D/g,''))||0),0);
  return prefix+String(max+1).padStart(prefix==='P-'?4:3,'0');
}
const inputClass='ops-input';
const badge=(text:string)=><span className={'ops-badge ops-'+text.toLowerCase().replace(/[^a-z]+/g,'-')}>{text}</span>;

export default function OperationsBoard({value,onChange,demo}:{value:Operations;onChange:(next:Operations)=>Promise<boolean>;demo:boolean}){
  const [tab,setTab]=useState<Panel>('Summary');
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('All');
  const [editing,setEditing]=useState<EditState|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const today=day();
  const issues=useMemo(()=>qualityIssues(value),[value]);
  const active=value.projects.filter(p=>p.status!=='Completed');
  const overdueProjects=active.filter(p=>p.due<today);
  const overdueTasks=value.tasks.filter(t=>taskHealth(t,today)==='Overdue');
  const flaggedContacts=value.contacts.filter(c=>['Overdue','Due Today','Missing date'].includes(contactHealth(c,today)));
  const blocked=value.tasks.filter(t=>t.status==='Blocked');
  const completedTasks=value.tasks.filter(t=>t.status==='Completed').length;
  const term=search.trim().toLowerCase();
  const filteredProjects=value.projects.filter(p=>(!term||[p.id,p.title,p.city,p.owner,p.workstream].join(' ').toLowerCase().includes(term))&&(filter==='All'||p.status===filter)).sort((a,b)=>a.due.localeCompare(b.due));
  const filteredContacts=value.contacts.filter(c=>(!term||[c.id,c.name,c.organisation,c.projectId,c.email].join(' ').toLowerCase().includes(term))&&(filter==='All'||c.stage===filter));
  const filteredTasks=value.tasks.filter(t=>(!term||[t.id,t.title,t.projectId,t.owner].join(' ').toLowerCase().includes(term))&&(filter==='All'||t.status===filter)).sort((a,b)=>a.due.localeCompare(b.due));
  const projectName=(id:string)=>value.projects.find(p=>p.id===id)?.title||'Unlinked project';
  async function commit(next:Operations) {setBusy(true);try{return await onChange(next);}finally{setBusy(false);}}
  function startProject(item?:OpsProject){setError('');setEditing({kind:'project',item:item?{...item}:{id:nextKey('P-',value.projects),title:'',city:'Sydney',workstream:'Administration',owner:'Coordinator A',status:'Planning',priority:'Medium',start:today,due:today,progress:0,milestone:'',notes:''}});}
  function startContact(item?:OpsContact){setError('');setEditing({kind:'contact',item:item?{...item}:{id:nextKey('C-',value.contacts),name:'',organisation:'',role:'Owner',city:'Sydney',projectId:value.projects[0]?.id||'',channel:'Email',stage:'New',followUp:today,owner:'Coordinator A',email:'',notes:''}});}
  function startTask(item?:OpsTask){setError('');setEditing({kind:'task',item:item?{...item}:{id:nextKey('T-',value.tasks),projectId:value.projects[0]?.id||'',title:'',category:'Administration',owner:'Coordinator A',priority:'Medium',status:'Not Started',due:today,blocker:'',nextAction:''}});}
  async function submit(){
    if(!editing)return;
    const item=editing.item;
    if(('title' in item && !item.title.trim())||('name' in item && !item.name.trim())){setError('Please enter a name or title.');return;}
    if(('projectId' in item)&&(!item.projectId||!value.projects.some(p=>p.id===item.projectId))){setError('Choose a valid linked project.');return;}
    let next:Operations;
    if(editing.kind==='project'){const found=value.projects.some(p=>p.id===item.id);next={...value,projects:found?value.projects.map(p=>p.id===item.id?item:p):[...value.projects,item]};}
    else if(editing.kind==='contact'){const found=value.contacts.some(c=>c.id===item.id);next={...value,contacts:found?value.contacts.map(c=>c.id===item.id?item:c):[...value.contacts,item]};}
    else{const found=value.tasks.some(t=>t.id===item.id);next={...value,tasks:found?value.tasks.map(t=>t.id===item.id?item:t):[...value.tasks,item]};}
    const check=operationsSchema.safeParse(next);
    if(!check.success){setError('Check the dates and field lengths.');return;}
    if(await commit(check.data)){setEditing(null);setError('');}
  }
  async function remove(){
    if(!editing)return;
    const item=editing.item;
    if(!window.confirm('Permanently remove '+item.id+'?'))return;
    if(editing.kind==='project'&&(value.contacts.some(c=>c.projectId===item.id)||value.tasks.some(t=>t.projectId===item.id))){setError('This project has linked tasks or contacts. Reassign those records before deleting.');return;}
    const next=editing.kind==='project'?{...value,projects:value.projects.filter(p=>p.id!==item.id)}:editing.kind==='contact'?{...value,contacts:value.contacts.filter(c=>c.id!==item.id)}:{...value,tasks:value.tasks.filter(t=>t.id!==item.id)};
    if(await commit(next))setEditing(null);
  }
  async function loadSample(){if(value.projects.length||value.contacts.length||value.tasks.length)return;if(await commit(sampleOperations()))setTab('Summary');}
  function exportReport(){
    const report=[
      'ESTATEFLOW — OPERATIONS DAILY REPORT','As of: '+today,'PORTFOLIO DEMO · SYNTHETIC DATA ONLY','',
      'Projects: '+value.projects.length,'Open projects: '+active.length,'Overdue projects: '+overdueProjects.length,
      'Open tasks: '+(value.tasks.length-completedTasks),'Overdue tasks: '+overdueTasks.length,
      'Blocked tasks: '+blocked.length,'CRM follow-ups requiring attention: '+flaggedContacts.length,'Data-quality exceptions: '+issues.length,'',
      'PRIORITY PROJECTS',
      ...value.projects.filter(p=>['Overdue','At Risk','Due Soon'].includes(projectHealth(p,today))).map(p=>p.id+' | '+p.title+' | '+projectHealth(p,today)+' | '+p.milestone),
      '','OVERDUE TASKS',
      ...overdueTasks.map(t=>t.id+' | '+projectName(t.projectId)+' | '+t.title+' | Due: '+t.due+' | '+t.nextAction),
      '','CRM FOLLOW-UPS',
      ...flaggedContacts.map(c=>c.id+' | '+c.name+' | '+projectName(c.projectId)+' | '+contactHealth(c,today)+' | '+(c.followUp||'No date')),
      '','DATA QUALITY',...issues.map(i=>i.id+' | '+i.kind+' | '+i.detail)
    ];
    saveFile('EstateFlow_Operations_Daily_Report_'+today+'.txt',report.join('\n'));
  }
  function exportTab(){
    if(tab==='Projects')csvDownload('EstateFlow_Projects_'+today+'.csv',['Project ID','Project','City','Workstream','Owner','Status','Priority','Start','Due','Progress','Next Milestone','Notes'],value.projects.map(p=>[p.id,p.title,p.city,p.workstream,p.owner,p.status,p.priority,p.start,p.due,p.progress,p.milestone,p.notes]));
    else if(tab==='CRM')csvDownload('EstateFlow_CRM_'+today+'.csv',['Contact ID','Name','Organisation','Role','City','Project ID','Channel','Stage','Follow-up','Owner','Email','Notes'],value.contacts.map(c=>[c.id,c.name,c.organisation,c.role,c.city,c.projectId,c.channel,c.stage,c.followUp,c.owner,c.email,c.notes]));
    else if(tab==='Tasks')csvDownload('EstateFlow_Tasks_'+today+'.csv',['Task ID','Project ID','Task','Category','Owner','Priority','Status','Due','Blocker','Next Action'],value.tasks.map(t=>[t.id,t.projectId,t.title,t.category,t.owner,t.priority,t.status,t.due,t.blocker,t.nextAction]));
    else exportReport();
  }
  return <div className="ops">
    <div className="ops-intro"><div><span className="ops-eyebrow">AUSTRALIAN REAL ESTATE · PROJECT ADMINISTRATION</span><h2>Project operations center</h2><p>Track delivery, CRM relationships, follow-ups and exceptions in one connected workspace.</p></div><button className="button secondary" onClick={exportReport}><Download size={15}/>Download daily report</button></div>
    <div className="ops-demo-warning"><ShieldCheck size={16}/><span><strong>Portfolio demonstration data.</strong> These are realistic fictional records—not actual customers, employers or transactions. {demo?'Changes in the public demo are temporary.':'Changes to this area are saved in your account workspace.'}</span></div>
    {!value.projects.length&&!value.contacts.length&&!value.tasks.length?<section className="ops-empty"><FileSpreadsheet size={30}/><h3>Start your project operations portfolio</h3><p>Load the original 16 sample Australian projects, 28 fictional CRM contacts and 48 linked tasks. Your other EstateFlow records will stay untouched.</p><button className="button primary" disabled={busy} onClick={()=>void loadSample()}><Plus size={15}/>Import sample portfolio</button></section>:<>
      <div className="ops-kpis">
        <article><span><ClipboardList size={17}/> Projects</span><strong>{value.projects.length}</strong><small>{active.length} active work items</small></article>
        <article><span><AlertTriangle size={17}/> Overdue projects</span><strong>{overdueProjects.length}</strong><small>Past target date</small></article>
        <article><span><Activity size={17}/> Open tasks</span><strong>{value.tasks.length-completedTasks}</strong><small>{overdueTasks.length} overdue · {blocked.length} blocked</small></article>
        <article><span><Users size={17}/> CRM follow-ups</span><strong>{flaggedContacts.length}</strong><small>{value.contacts.length} linked contact records</small></article>
      </div>
      <div className="ops-tabs" role="tablist" aria-label="Operations navigation">{tabs.map(x=><button key={x} type="button" role="tab" aria-selected={tab===x} className={tab===x?'active':''} onClick={()=>{setTab(x);setSearch('');setFilter('All');}}>{x}{x==='Data Quality'&&issues.length>0&&<span className="ops-issue-count">{issues.length}</span>}</button>)}</div>
      {tab==='Summary'&&<div className="ops-summary-grid">
        <section className="ops-panel"><header><h3>Delivery priorities</h3><span>Live from project records</span></header><div className="ops-cards">{value.projects.filter(p=>p.status!=='Completed').sort((a,b)=>a.due.localeCompare(b.due)).slice(0,6).map(p=><button className="ops-priority" key={p.id} onClick={()=>{setTab('Projects');setSearch(p.id);}}><div><strong>{p.title}</strong><small>{p.city} · {p.id} · Due {readable(p.due)}</small></div>{badge(projectHealth(p,today))}<ArrowUpRight size={15}/></button>)}</div></section>
        <section className="ops-panel"><header><h3>Manager's daily briefing</h3><span>Generated from current data</span></header><div className="ops-brief"><p><strong>{overdueProjects.length} project deadlines</strong> have passed and need review. {blocked.length} task{blocked.length===1?' is':'s are'} blocked awaiting action.</p><p><strong>{flaggedContacts.length} CRM contacts</strong> need follow-up attention, including missing dates and outstanding reminders.</p><p><strong>{issues.length} quality exceptions</strong> are logged for reconciliation before handover or reporting.</p><button className="button secondary" onClick={exportReport}><Download size={14}/>Export full briefing</button></div></section>
        <section className="ops-panel"><header><h3>Task completion</h3><span>{completedTasks} of {value.tasks.length} tasks</span></header><div className="ops-progress"><i style={{width:(100*completedTasks/Math.max(1,value.tasks.length))+'%'}}/></div><p className="ops-footnote">{Math.round(100*completedTasks/Math.max(1,value.tasks.length))}% marked completed. Updating a task's status immediately changes this report.</p></section>
        <section className="ops-panel"><header><h3>Project status distribution</h3><span>Current portfolio</span></header><div className="ops-status-bars">{projectStatuses.map(status=><div key={status}><span>{status}</span><div><i style={{width:(100*value.projects.filter(p=>p.status===status).length/Math.max(1,value.projects.length))+'%'}}/></div><strong>{value.projects.filter(p=>p.status===status).length}</strong></div>)}</div></section>
      </div>}
      {tab!=='Summary'&&<div className="ops-toolbar"><label><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search records, names or project IDs" aria-label="Search operations records"/></label>{tab!=='Data Quality'&&<label className="ops-filter"><Filter size={15}/><select value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filter by status"><option value="All">All statuses</option>{(tab==='Projects'?projectStatuses:tab==='CRM'?contactStages:taskStatuses).map(status=><option key={status}>{status}</option>)}</select></label>}<button className="button secondary" onClick={exportTab}><Download size={14}/>Export {tab==='Data Quality'?'report':'CSV'}</button>{tab==='Projects'&&<button className="button primary" onClick={()=>startProject()}><Plus size={15}/>Project</button>}{tab==='CRM'&&<button className="button primary" onClick={()=>startContact()}><Plus size={15}/>Contact</button>}{tab==='Tasks'&&<button className="button primary" onClick={()=>startTask()}><Plus size={15}/>Task</button>}</div>}
      {tab==='Projects'&&<section className="ops-panel ops-table-wrap"><div className="ops-scroll"><table><thead><tr><th>Project / location</th><th>Owner</th><th>Priority</th><th>Status</th><th>Target date</th><th>Progress</th><th>Health</th><th></th></tr></thead><tbody>{filteredProjects.map(p=><tr key={p.id}><td><strong>{p.title}</strong><small>{p.id} · {p.city} · {p.workstream}</small></td><td>{p.owner}</td><td>{badge(p.priority)}</td><td><select aria-label={'Status for '+p.title} value={p.status} disabled={busy} onChange={e=>void commit({...value,projects:value.projects.map(x=>x.id===p.id?{...x,status:e.target.value as OpsProject['status'],progress:e.target.value==='Completed'?100:x.progress}:x)})}>{projectStatuses.map(s=><option key={s}>{s}</option>)}</select></td><td>{readable(p.due)}</td><td><span className="ops-percent">{p.progress}%</span><div className="ops-mini-progress"><i style={{width:p.progress+'%'}}/></div></td><td>{badge(projectHealth(p,today))}</td><td><button className="ops-edit" onClick={()=>startProject(p)}>Edit</button></td></tr>)}</tbody></table></div>{filteredProjects.length===0&&<p className="ops-no-results">No projects match your search.</p>}</section>}
      {tab==='CRM'&&<section className="ops-panel ops-table-wrap"><div className="ops-scroll"><table><thead><tr><th>Contact</th><th>Organisation</th><th>Linked project</th><th>Stage</th><th>Follow-up</th><th>Health</th><th></th></tr></thead><tbody>{filteredContacts.map(c=><tr key={c.id}><td><strong>{c.name}</strong><small>{c.id} · {c.role} · {c.email}</small></td><td>{c.organisation}</td><td><strong className="ops-small-name">{projectName(c.projectId)}</strong><small>{c.projectId}</small></td><td><select aria-label={'Stage for '+c.name} value={c.stage} disabled={busy} onChange={e=>void commit({...value,contacts:value.contacts.map(x=>x.id===c.id?{...x,stage:e.target.value as OpsContact['stage']}:x)})}>{contactStages.map(s=><option key={s}>{s}</option>)}</select></td><td>{readable(c.followUp)}</td><td>{badge(contactHealth(c,today))}</td><td><button className="ops-edit" onClick={()=>startContact(c)}>Edit</button></td></tr>)}</tbody></table></div>{filteredContacts.length===0&&<p className="ops-no-results">No contacts match your search.</p>}</section>}
      {tab==='Tasks'&&<section className="ops-panel ops-table-wrap"><div className="ops-scroll"><table><thead><tr><th>Task / project</th><th>Assigned</th><th>Priority</th><th>Status</th><th>Due</th><th>Health</th><th></th></tr></thead><tbody>{filteredTasks.map(t=><tr key={t.id}><td><strong>{t.title}</strong><small>{t.id} · {projectName(t.projectId)}</small>{t.blocker&&<small className="ops-blocker">Blocker: {t.blocker}</small>}</td><td>{t.owner}</td><td>{badge(t.priority)}</td><td><select aria-label={'Status for '+t.title+' '+t.id} value={t.status} disabled={busy} onChange={e=>void commit({...value,tasks:value.tasks.map(x=>x.id===t.id?{...x,status:e.target.value as OpsTask['status']}:x)})}>{taskStatuses.map(s=><option key={s}>{s}</option>)}</select></td><td>{readable(t.due)}</td><td>{badge(taskHealth(t,today))}</td><td><button className="ops-edit" onClick={()=>startTask(t)}>Edit</button></td></tr>)}</tbody></table></div>{filteredTasks.length===0&&<p className="ops-no-results">No tasks match your search.</p>}</section>}
      {tab==='Data Quality'&&<section className="ops-panel"><header><h3>Data quality checks</h3><span>Duplicate emails · missing follow-up dates · broken project links</span></header>{issues.length===0?<p className="ops-all-good"><CheckCircle2 size={18}/>No active data exceptions detected.</p>:<div className="ops-issues">{issues.filter(i=>!term||[i.id,i.kind,i.detail].join(' ').toLowerCase().includes(term)).map((i,idx)=><div key={i.id+'-'+idx}><AlertTriangle size={15}/><strong>{i.id}</strong>{badge(i.kind)}<span>{i.detail}</span></div>)}</div>}<p className="ops-footnote">This report updates whenever you edit linked records. The sample intentionally includes quality issues to demonstrate auditing.</p></section>}
    </>}
    {editing&&<div className="ops-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null);}}><div className="ops-modal" role="dialog" aria-modal="true" aria-label={'Edit '+editing.kind}><header><div><span className="ops-eyebrow">OPERATIONS RECORD</span><h3>{editing.kind==='project'?'Project details':editing.kind==='contact'?'CRM contact':'Task details'}</h3><small>{editing.item.id}</small></div><button className="ops-close" onClick={()=>setEditing(null)} aria-label="Close editor"><X size={18}/></button></header>
    <div className="ops-fields">
      {editing.kind==='project'&&<>
        <Field label="Project / work item"><input className={inputClass} value={editing.item.title} onChange={e=>setEditing({...editing,item:{...editing.item,title:e.target.value}})}/></Field>
        <Field label="City"><input className={inputClass} value={editing.item.city} onChange={e=>setEditing({...editing,item:{...editing.item,city:e.target.value}})}/></Field>
        <Field label="Workstream"><input className={inputClass} value={editing.item.workstream} onChange={e=>setEditing({...editing,item:{...editing.item,workstream:e.target.value}})}/></Field>
        <Field label="Responsible"><input className={inputClass} value={editing.item.owner} onChange={e=>setEditing({...editing,item:{...editing.item,owner:e.target.value}})}/></Field>
        <Field label="Status"><select value={editing.item.status} onChange={e=>setEditing({...editing,item:{...editing.item,status:e.target.value as OpsProject['status']}})}>{projectStatuses.map(s=><option key={s}>{s}</option>)}</select></Field>
        <Field label="Priority"><select value={editing.item.priority} onChange={e=>setEditing({...editing,item:{...editing.item,priority:e.target.value as OpsProject['priority']}})}>{priorities.map(s=><option key={s}>{s}</option>)}</select></Field>
        <Field label="Start date"><input type="date" value={editing.item.start} onChange={e=>setEditing({...editing,item:{...editing.item,start:e.target.value}})}/></Field>
        <Field label="Target date"><input type="date" value={editing.item.due} onChange={e=>setEditing({...editing,item:{...editing.item,due:e.target.value}})}/></Field>
        <Field label="Progress %"><input type="number" min="0" max="100" value={editing.item.progress} onChange={e=>setEditing({...editing,item:{...editing.item,progress:Number(e.target.value)}})}/></Field>
        <Field label="Next milestone"><input value={editing.item.milestone} onChange={e=>setEditing({...editing,item:{...editing.item,milestone:e.target.value}})}/></Field>
        <Field label="Management notes" wide><textarea rows={3} value={editing.item.notes} onChange={e=>setEditing({...editing,item:{...editing.item,notes:e.target.value}})}/></Field>
      </>}
      {editing.kind==='contact'&&<>
        <Field label="Contact name"><input value={editing.item.name} onChange={e=>setEditing({...editing,item:{...editing.item,name:e.target.value}})}/></Field>
        <Field label="Organisation"><input value={editing.item.organisation} onChange={e=>setEditing({...editing,item:{...editing.item,organisation:e.target.value}})}/></Field>
        <Field label="Email"><input type="email" value={editing.item.email} onChange={e=>setEditing({...editing,item:{...editing.item,email:e.target.value}})}/></Field>
        <Field label="Contact type"><input value={editing.item.role} onChange={e=>setEditing({...editing,item:{...editing.item,role:e.target.value}})}/></Field>
        <Field label="City"><input value={editing.item.city} onChange={e=>setEditing({...editing,item:{...editing.item,city:e.target.value}})}/></Field>
        <Field label="Linked project"><select value={editing.item.projectId} onChange={e=>setEditing({...editing,item:{...editing.item,projectId:e.target.value}})}>{value.projects.map(p=><option key={p.id} value={p.id}>{p.id} — {p.title}</option>)}</select></Field>
        <Field label="Channel"><select value={editing.item.channel} onChange={e=>setEditing({...editing,item:{...editing.item,channel:e.target.value}})}>{['Email','Phone','Portal','Referral','Website'].map(c=><option key={c}>{c}</option>)}</select></Field>
        <Field label="Pipeline stage"><select value={editing.item.stage} onChange={e=>setEditing({...editing,item:{...editing.item,stage:e.target.value as OpsContact['stage']}})}>{contactStages.map(s=><option key={s}>{s}</option>)}</select></Field>
        <Field label="Next follow-up"><input type="date" value={editing.item.followUp} onChange={e=>setEditing({...editing,item:{...editing.item,followUp:e.target.value}})}/></Field>
        <Field label="Assigned to"><input value={editing.item.owner} onChange={e=>setEditing({...editing,item:{...editing.item,owner:e.target.value}})}/></Field>
        <Field label="Notes" wide><textarea rows={3} value={editing.item.notes} onChange={e=>setEditing({...editing,item:{...editing.item,notes:e.target.value}})}/></Field>
      </>}
      {editing.kind==='task'&&<>
        <Field label="Task title"><input value={editing.item.title} onChange={e=>setEditing({...editing,item:{...editing.item,title:e.target.value}})}/></Field>
        <Field label="Linked project"><select value={editing.item.projectId} onChange={e=>setEditing({...editing,item:{...editing.item,projectId:e.target.value}})}>{value.projects.map(p=><option key={p.id} value={p.id}>{p.id} — {p.title}</option>)}</select></Field>
        <Field label="Category"><input value={editing.item.category} onChange={e=>setEditing({...editing,item:{...editing.item,category:e.target.value}})}/></Field>
        <Field label="Assigned to"><input value={editing.item.owner} onChange={e=>setEditing({...editing,item:{...editing.item,owner:e.target.value}})}/></Field>
        <Field label="Priority"><select value={editing.item.priority} onChange={e=>setEditing({...editing,item:{...editing.item,priority:e.target.value as OpsTask['priority']}})}>{priorities.map(s=><option key={s}>{s}</option>)}</select></Field>
        <Field label="Status"><select value={editing.item.status} onChange={e=>setEditing({...editing,item:{...editing.item,status:e.target.value as OpsTask['status']}})}>{taskStatuses.map(s=><option key={s}>{s}</option>)}</select></Field>
        <Field label="Due date"><input type="date" value={editing.item.due} onChange={e=>setEditing({...editing,item:{...editing.item,due:e.target.value}})}/></Field>
        <Field label="Blocker / dependency"><input value={editing.item.blocker} onChange={e=>setEditing({...editing,item:{...editing.item,blocker:e.target.value}})}/></Field>
        <Field label="Next action" wide><textarea rows={2} value={editing.item.nextAction} onChange={e=>setEditing({...editing,item:{...editing.item,nextAction:e.target.value}})}/></Field>
      </>}
    </div>
    {error&&<p className="ops-error">{error}</p>}
    <footer><button className="button secondary" onClick={()=>setEditing(null)}>Cancel</button><button className="button secondary ops-delete" disabled={busy} onClick={()=>void remove()}><Trash2 size={14}/>Delete</button><button className="button primary" disabled={busy} onClick={()=>void submit()}><Check size={15}/>{busy?'Saving…':'Save record'}</button></footer></div></div>}
  </div>;
}
function Field({label,children,wide=false}:{label:string;children:React.ReactNode;wide?:boolean}){return <label className={'ops-field'+(wide?' wide':'')}><span>{label}</span>{children}</label>;}
