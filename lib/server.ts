import { createClient } from './supabase/server';
import { seedWorkspace, workspaceSchema, type Workspace } from './domain';

export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
export async function identity(_req?: Request) {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user?.id ?? null;
}
export function validOrigin(req: Request) {
  return req.headers.get('origin') === new URL(req.url).origin;
}
export async function loadWorkspace(userId: string): Promise<{ state: Workspace; revision: number }> {
  const client = await createClient();
  const { data, error } = await client.from('workspaces').select('data,revision').eq('user_id', userId).maybeSingle();
  if (error) throw new Error('Workspace read failed');
  return data ? { state: workspaceSchema.parse(data.data), revision: data.revision } : { state: seedWorkspace(), revision: 0 };
}
export async function rateLimit(_userId: string) {
  const client = await createClient();
  const { data, error } = await client.rpc('consume_ai_quota');
  return !error && data === true;
}
export function apiKey(req: Request) {
  // Keys are supplied per session. Shared server keys are intentionally unsupported.
  return req.headers.get('x-ai-key') || '';
}
