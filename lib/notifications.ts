import type { Workspace } from './domain.ts';

export type WorkspaceNotification = { key: string; title: string; detail: string; leadId: string; target: 'Follow-ups' | 'Leads'; kind: string; read: boolean };

// A rescheduled or edited reminder is a new notification. Viewing is not completion.
export function getNotifications(state: Workspace, today: string): WorkspaceNotification[] {
  const read = new Set(state.settings.notificationReads || []);
  const names = new Map(state.leads.map(lead => [lead.id, lead.name]));
  const tasks = state.tasks.filter(task => !task.done && task.due <= today)
    .sort((a,b) => (a.due+a.time).localeCompare(b.due+b.time));
  const followUps = new Map(state.leads.map(lead => [lead.id,lead.followUp]));
  const covered = new Set(state.tasks.filter(task=>task.due<=today&&(!task.done||task.due>=(followUps.get(task.leadId)||today))).map(task=>task.leadId));
  const items: WorkspaceNotification[] = tasks.map(task => {
    const key = JSON.stringify(['task',task.id,task.due,task.time,task.title]);
    return {key,title:task.title,detail:`${task.due < today ? 'Overdue' : 'Today'} · ${names.get(task.leadId) || 'Workspace'} · ${task.time || 'Anytime'}`,leadId:task.leadId,target:'Follow-ups' as const,kind:task.kind,read:read.has(key)};
  });
  for (const lead of state.leads) {
    if (!lead.followUp || lead.followUp > today || ['Won','Lost'].includes(lead.stage) || covered.has(lead.id)) continue;
    const key=JSON.stringify(['lead',lead.id,lead.followUp]);
    items.push({key,title:`Follow up with ${lead.name}`,detail:`${lead.followUp < today ? 'Overdue' : 'Today'} · ${lead.area}`,leadId:lead.id,target:'Leads',kind:'Email',read:read.has(key)});
  }
  return items;
}
