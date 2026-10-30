import { z } from 'zod';
import { workspaceSchema } from '@/lib/domain';
import { json, identity, validOrigin, loadWorkspace } from '@/lib/server';
import { createClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  const user = await identity();
  if (!user) return json({ error: 'Sign in to open your workspace.' }, 401);
  try { return json(await loadWorkspace(user)); }
  catch { return json({ error: 'Your workspace could not be loaded. Please retry.' }, 503); }
}
export async function PUT(req: Request) {
  const user = await identity();
  if (!user) return json({ error: 'Sign in to save changes.' }, 401);
  if (!validOrigin(req)) return json({ error: 'Origin not allowed.' }, 403);
  if (Number(req.headers.get('content-length') || 0) > 2e6) return json({ error: 'Workspace is too large.' }, 413);
  try {
    const payload = z.object({ state: workspaceSchema, revision: z.number().int().min(0) }).parse(await req.json());
    if (JSON.stringify(payload.state).length > 1800000) return json({ error: 'Workspace size limit reached. Export a backup and archive older records.' }, 413);
    const client = await createClient();
    const { data, error } = await client.rpc('save_workspace', { payload: payload.state, expected_revision: payload.revision });
    if (error) throw new Error('Save failed');
    if (data == null) return json({ error: 'This workspace changed in another tab. Refresh before trying again.' }, 409);
    return json({ revision: data });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: 'Check the record fields and try again.' }, 400);
    return json({ error: 'Changes were not saved. Please retry.' }, 503);
  }
}
