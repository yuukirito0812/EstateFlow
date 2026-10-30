import { redirect } from 'next/navigation';
import { identity } from '@/lib/server';
import WorkspaceApp from './workspace-app';
export const dynamic = 'force-dynamic';
export default async function Home() {
  if (!(await identity())) redirect('/login');
  return <WorkspaceApp />;
}
