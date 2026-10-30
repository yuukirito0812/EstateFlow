import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validOrigin, json } from '@/lib/server';
export async function POST(request: Request) {
  if (!validOrigin(request)) return json({ error: 'Origin not allowed.' }, 403);
  const client = await createClient();
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) return json({ error: 'Sign-out failed. Please retry.' }, 503);
  return NextResponse.redirect(new URL('/login', request.url), 303);
}
