import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get('token_hash');
  if (token_hash && url.searchParams.get('type') === 'email') {
    const client = await createClient();
    const { error } = await client.auth.verifyOtp({ token_hash, type: 'email' });
    if (!error) return NextResponse.redirect(new URL('/', url.origin));
  }
  return NextResponse.redirect(new URL('/login?error=confirmation', url.origin));
}
