'use client';
import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '../components';
import { ArrowRight, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage(''); setFailed(false);
    try {
      const client = createClient();
      const result = mode === 'login'
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + '/auth/callback' } });
      if (result.error) throw result.error;
      setPassword('');
      if (result.data.session) { window.location.assign('/'); return; }
      setMessage('Check your confirmation email. Confirm your account, then return here to sign in.');
      setMode('login');
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : 'Sign-in could not be completed. Please retry.');
    } finally { setBusy(false); }
  }
  return <main className="auth-page">
    <section className="auth-story"><a href="/demo" aria-label="EstateFlow demo"><Logo /></a>
      <div><span className="auth-eyebrow"><Sparkles size={15} /> A LITTLE CLARITY. A LOT OF POSSIBILITY.</span>
        <h1>Good relationships<br />start with a<br /><em>thoughtful follow-up.</em></h1>
        <p>Your leads, next steps, and reviewed drafts, together in one calm workspace.</p>
        <div className="auth-feature"><ShieldCheck size={20} /><span>Private records. Human-approved AI.<br /><small>You stay in control of every conversation.</small></span></div>
      </div><small>Designed & built by Carl Vincent Zabala · Portfolio project</small>
    </section>
    <section className="auth-form-side"><div className="auth-card"><span className="page-eyebrow">YOUR REAL ESTATE WORKSPACE</span>
      <h2>{mode === 'login' ? 'Welcome back.' : 'Make room for better follow-ups.'}</h2>
      <p>{mode === 'login' ? 'Sign in to pick up where you left off.' : 'Create your own private workspace.'}</p>
      <form onSubmit={submit}>
        <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
        <label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>
        {message && <div className={'auth-message ' + (failed ? 'error' : '')} role="status"><AlertCircle size={16} />{message}</div>}
        <button className="button primary full-width" disabled={busy}>{busy ? 'One moment…' : mode === 'login' ? 'Open my workspace' : 'Create workspace'}<ArrowRight size={16} /></button>
      </form>
      <p className="auth-switch">{mode === 'login' ? 'New to EstateFlow?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(''); }}>{mode === 'login' ? 'Create a workspace' : 'Sign in'}</button></p>
      <div className="auth-divider"><span>JUST EXPLORING?</span></div>
      <a className="button secondary full-width" href="/demo">Try the fictional-lead demo<ArrowRight size={15} /></a>
      <p className="auth-footnote">The demo resets when you reload. Saved workspaces require sign-in. Use fictional records for portfolio walkthroughs.</p>
    </div></section>
  </main>;
}
