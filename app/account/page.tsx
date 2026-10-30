import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Logo } from '../components';
export const dynamic = 'force-dynamic';
export default async function Account() {
  const client = await createClient();
  const { data } = await client.auth.getUser();
  if (!data.user) redirect('/login');
  return <main className="account-page"><Logo /><section className="panel account-card"><span className="page-eyebrow">YOUR ACCOUNT</span><h1>Your own little corner.</h1><p>Signed in as {data.user.email}</p><p>Your workspace belongs to your account. The public demo uses fictional leads and does not read your saved records.</p><a className="button secondary" href="/">Back to workspace</a><form action="/api/auth/signout" method="post"><button className="button primary">Sign out</button></form></section></main>;
}
