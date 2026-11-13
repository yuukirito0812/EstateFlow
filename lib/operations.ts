import { z } from 'zod';

const label = (max = 200) => z.string().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const projectStatuses = ['Planning','In Progress','At Risk','On Hold','Completed'] as const;
export const taskStatuses = ['Not Started','In Progress','Blocked','Completed'] as const;
export const priorities = ['Low','Medium','High'] as const;
export const contactStages = ['New','Contacted','Documents Pending','Active','Closed'] as const;

export const operationsSchema = z.object({
  projects: z.array(z.object({
    id: label(50), title: label(160).min(1), city: label(80), workstream: label(100),
    owner: label(90), status: z.enum(projectStatuses), priority: z.enum(priorities),
    start: isoDate, due: isoDate, progress: z.number().int().min(0).max(100),
    milestone: label(200), notes: label(2000)
  })).max(200),
  contacts: z.array(z.object({
    id: label(50), name: label(120).min(1), organisation: label(150),
    role: label(80), city: label(80), projectId: label(50),
    channel: label(40), stage: z.enum(contactStages), followUp: isoDate.or(z.literal('')),
    owner: label(90), email: label(254), notes: label(2000)
  })).max(1000),
  tasks: z.array(z.object({
    id: label(50), projectId: label(50), title: label(200).min(1), category: label(90),
    owner: label(90), priority: z.enum(priorities), status: z.enum(taskStatuses),
    due: isoDate, blocker: label(600), nextAction: label(500)
  })).max(2000)
});
export type Operations = z.infer<typeof operationsSchema>;
export type OpsProject = Operations['projects'][number];
export type OpsContact = Operations['contacts'][number];
export type OpsTask = Operations['tasks'][number];
export const emptyOperations = (): Operations => ({projects:[],contacts:[],tasks:[]});

export function projectHealth(project: OpsProject, today: string) {
  if (project.status === 'Completed') return 'Complete';
  if (project.due < today) return 'Overdue';
  if (project.status === 'At Risk') return 'At Risk';
  const days = Math.round((Date.parse(project.due+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000);
  return days <= 7 ? 'Due Soon' : 'On Track';
}
export function taskHealth(task: OpsTask, today: string) {
  if (task.status === 'Completed') return 'Complete';
  if (task.status === 'Blocked') return 'Blocked';
  if (task.due < today) return 'Overdue';
  if (task.due === today) return 'Due Today';
  return 'Scheduled';
}
export function contactHealth(contact: OpsContact, today: string) {
  if (contact.stage === 'Closed') return 'Closed';
  if (!contact.followUp) return 'Missing date';
  if (contact.followUp < today) return 'Overdue';
  if (contact.followUp === today) return 'Due Today';
  return 'Scheduled';
}
export function qualityIssues(data: Operations) {
  const issues: {id:string;kind:string;detail:string}[] = [];
  const projectIds = new Set(data.projects.map(p=>p.id));
  const emailSeen = new Map<string,string>();
  for (const contact of data.contacts) {
    if (!projectIds.has(contact.projectId)) issues.push({id:contact.id,kind:'CRM link',detail:'Project '+contact.projectId+' not found'});
    if (contact.stage !== 'Closed' && !contact.followUp) issues.push({id:contact.id,kind:'Follow-up',detail:'Open contact needs a follow-up date'});
    if (contact.email) {
      const email = contact.email.trim().toLowerCase();
      if (emailSeen.has(email)) issues.push({id:contact.id,kind:'Duplicate email',detail:'Also used by '+emailSeen.get(email)});
      else emailSeen.set(email,contact.id);
    }
  }
  for (const task of data.tasks) if (!projectIds.has(task.projectId)) issues.push({id:task.id,kind:'Task link',detail:'Project '+task.projectId+' not found'});
  for (const project of data.projects) {
    if (project.status === 'Completed' && project.progress !== 100) issues.push({id:project.id,kind:'Progress',detail:'Completed project should be 100%'});
  }
  return issues;
}

// Realistic fictional portfolio exercise transcribed from the sample tracker.
// Names, emails, organisations and business activities are not actual clients.
const rows: Array<[string,string,string,string,string,OpsProject['status'],OpsProject['priority'],string,string,number,string,string]> = [
 ['P-1001','Bondi Listing Pack','Sydney','Listing Preparation','Coordinator A','In Progress','High','2026-10-27','2026-11-18',70,'Approve photography','Waiting for image sign-off'],
 ['P-1002','Parramatta Vendor Handover','Sydney','Vendor Coordination','Project Manager','At Risk','High','2026-11-01','2026-11-12',55,'Confirm trades schedule','Vendor confirmation outstanding'],
 ['P-1003','Southbank Lease Documents','Melbourne','Lease Administration','Coordinator B','In Progress','Medium','2026-10-29','2026-11-21',50,'Review lease amendment','Legal review queued'],
 ['P-1004','New Farm Property Onboarding','Brisbane','Property Onboarding','Coordinator A','In Progress','High','2026-11-04','2026-11-19',60,'Receive owner ID','Identity document pending'],
 ['P-1005','Fremantle Records Clean-up','Perth','Data Quality','Coordinator C','Completed','Low','2026-10-16','2026-11-07',100,'Archive final records','Closed and verified'],
 ['P-1006','Richmond Inspection Pack','Melbourne','Compliance','Coordinator B','Planning','Medium','2026-11-09','2026-11-25',15,'Book inspection','Supplier options requested'],
 ['P-1007','Chatswood Buyer CRM Import','Sydney','CRM Data Entry','Coordinator C','Completed','Medium','2026-10-20','2026-11-05',100,'Confirm final reconciliation','Duplicate checks passed'],
 ['P-1008','West End Maintenance Register','Brisbane','Maintenance','Coordinator A','In Progress','Medium','2026-11-03','2026-11-15',75,'Approve repair quotation','Approval required'],
 ['P-1009','Subiaco Tenant Follow-ups','Perth','Lease Administration','Coordinator C','On Hold','Medium','2026-10-31','2026-11-24',30,'Receive tenant response','Awaiting reply'],
 ['P-1010','Docklands Listing Launch','Melbourne','Listing Preparation','Coordinator B','At Risk','High','2026-11-02','2026-11-16',65,'Resolve missing floorplan','Critical marketing asset missing'],
 ['P-1011','Manly Vendor Scheduling','Sydney','Vendor Coordination','Coordinator A','In Progress','Medium','2026-11-06','2026-11-22',40,'Confirm access window','Access requests sent'],
 ['P-1012','Fortitude Valley Lease Audit','Brisbane','Data Quality','Coordinator C','Planning','Low','2026-11-10','2026-11-28',10,'Review contract index','Initial audit underway'],
 ['P-1013','Carlton Property Handover','Melbourne','Property Onboarding','Coordinator B','Completed','Medium','2026-10-14','2026-11-04',100,'Archive handover file','Owner confirmation recorded'],
 ['P-1014','Northbridge Owner Documentation','Perth','Compliance','Project Manager','At Risk','High','2026-11-03','2026-11-11',45,'Obtain compliance certificate','Escalated to owner'],
 ['P-1015','Surry Hills Open Home Setup','Sydney','Listing Preparation','Coordinator A','Planning','Medium','2026-11-08','2026-11-30',20,'Approve viewing schedule','Calendar options prepared'],
 ['P-1016','Woolloongabba CRM Reconciliation','Brisbane','CRM Data Entry','Coordinator C','In Progress','High','2026-11-07','2026-11-20',65,'Review missing follow-up dates','Data exception noted']
];
const names = ['Isla Bennett','Oliver Hughes','Mia Clarke','Noah Wilson','Amelia Taylor','Jack Morgan','Charlotte Evans','Leo Anderson','Grace Collins','Henry Parker','Sophie Turner','Ethan Brooks','Ruby Foster','Lucas Reed','Ava Mitchell','William Hayes','Ella Murphy','Liam Carter','Chloe Martin','Oscar Price','Harper Bell','Max Cooper','Zoe Ward','Felix Scott','Emily Walsh','Hugo Ross','Lily James','Archer King'];
const stages: OpsContact['stage'][] = ['New','Documents Pending','Closed','Contacted','Active','New','Documents Pending','Closed','Active','Active','New','Documents Pending','Closed','Contacted','Active','New','Documents Pending','Closed','Contacted','Active','New','Documents Pending','Closed','Contacted','Active','New','Documents Pending','Closed'];
const followups = ['2026-11-12','2026-11-13','','2026-11-15','2026-11-17','2026-11-20','2026-11-10','','','2026-11-14','2026-11-15','2026-11-17','','2026-11-10','2026-11-12','2026-11-13','2026-11-14','','2026-11-17','2026-11-20','','2026-11-12','','2026-11-14','2026-11-15','2026-11-17','2026-11-20',''];
const taskDue: string[][] = [
 ['2026-11-09','2026-11-12','2026-11-15'],['2026-11-03','2026-11-06','2026-11-11'],['2026-11-12','2026-11-15','2026-11-18'],['2026-11-10','2026-11-13','2026-11-16'],
 ['2026-10-29','2026-11-01','2026-11-04'],['2026-11-16','2026-11-19','2026-11-22'],['2026-10-27','2026-10-30','2026-11-02'],['2026-11-06','2026-11-09','2026-11-12'],
 ['2026-11-15','2026-11-18','2026-11-21'],['2026-11-07','2026-11-10','2026-11-15'],['2026-11-13','2026-11-16','2026-11-19'],['2026-11-19','2026-11-22','2026-11-25'],
 ['2026-10-26','2026-10-29','2026-11-01'],['2026-11-02','2026-11-05','2026-11-10'],['2026-11-21','2026-11-24','2026-11-27'],['2026-11-11','2026-11-14','2026-11-17']
];
const taskNames = ['Verify property details','Request supporting documents','Update CRM and project record'] as const;
const taskCats = ['Administration','Client Follow-up','CRM'] as const;

export function sampleOperations(): Operations {
  const projects: OpsProject[] = rows.map(([id,title,city,workstream,owner,status,priority,start,due,progress,milestone,notes])=>({id,title,city,workstream,owner,status,priority,start,due,progress,milestone,notes}));
  const contacts: OpsContact[] = names.map((name,i)=> {
    const project = projects[i%16];
    const role = ['Owner','Agent','Vendor','Tenant'][i%4];
    const organisation = ['Harbourline Property Services','Cedarstone Realty','Southside Trades','Bayview Holdings','Westbridge Property Group','UrbanKey Realty'][i%6]+' (sample)';
    return {id:'C-'+String(i+1).padStart(3,'0'),name,organisation,role,city:project.city,projectId:project.id,
      channel:['Phone','Portal','Email'][i%3],stage:stages[i],followUp:followups[i],
      owner:['Coordinator B','Coordinator C','Coordinator A'][i%3],
      email: i===25 ? 'sophie.turner@example.com' : name.toLowerCase().replaceAll(' ','.')+'@example.com',
      notes:'Fictional '+role.toLowerCase()+' contact associated with '+project.title+'.'};
  });
  const tasks: OpsTask[] = projects.flatMap((project,i)=>taskNames.map((title,k)=>{
    const complete=project.status==='Completed';
    const status:OpsTask['status'] = complete?'Completed':k===0?(project.status==='At Risk'?'Blocked':'Completed'):k===1?'In Progress':'Not Started';
    return {id:'T-'+String(i*3+k+1).padStart(3,'0'),projectId:project.id,title,category:taskCats[k],owner:project.owner,
      priority:project.priority,status,due:taskDue[i][k],
      blocker:status==='Blocked'?'Awaiting vendor/owner response':k===1&&(i%3===0||project.status==='At Risk')?'Document not received':'',
      nextAction:k===0?'Confirm status in CRM':k===1?'Request update from owner':'Reconcile tracker and CRM records'};
  }));
  return {projects,contacts,tasks};
}
