# EstateFlow

**Live app:** [estateflow-rose.vercel.app](https://estateflow-rose.vercel.app/) · **[Portfolio demo](https://estateflow-rose.vercel.app/demo)**

**Uploading this project yourself? Start with [START_HERE.md](START_HERE.md).** It explains which files to upload and how to configure Vercel and Supabase.

A real estate lead and follow-up workspace by Carl Vincent Zabala. This standalone edition uses **Next.js + Supabase** and is prepared for **Vercel** hosting. It preserves the original app's lead tracker, draggable pipeline, tasks/calendar, property matching, reports, CSV import/export, backups and reviewed email drafts.

## What is connected

- Supabase project `fcwrcxywakrwkixvewoq` in Singapore is provisioned. The workspace schema is applied and its access controls were tested.
- Supabase Auth provides email/password sign-in. Database row policies isolate records by the verified account ID.
- Google Gemini can be connected using a user-supplied session key in Integrations. Keys stay in browser memory and are forwarded through the server; they are not written to the database or local storage. No shared server AI key is used.
- `/demo` uses fictional records in browser memory. It resets on reload and cannot connect live AI. `/` requires sign-in and saves to Supabase.
- Gmail compose links support reviewed, manually sent messages. Inbox sync and unattended daily email delivery are not connected.

The standalone edition is deployed on Vercel and linked to this repository's `main` branch. GitHub Actions and the Vercel production build passed. Email confirmation return URLs still need the final Supabase dashboard configuration listed in `DEPLOYMENT.md`.

## Local setup

Use Node.js 22.

```sh
npm install
cp .env.example .env.local
npm run dev
```

Fill the two public Supabase variables in `.env.local`. Use a **publishable** key, never a service-role or secret key. Environment files are ignored by Git. A local `.env.local` is already prepared in the working checkout; it is deliberately excluded from downloads and uploads.

```sh
npm run typecheck
npm test
npm run build
```

Dependency installation, tests, and the production build were verified in GitHub Actions; the production build also passed on Vercel. Generate and commit the package lock after the first successful local `npm install`.

## Vercel setup

1. Import the EstateFlow GitHub repository into Vercel, or deploy this source with the connected Vercel app.
2. Use the **Next.js** preset and Node.js **22.x**; the repository root is the app root.
3. Set `NEXT_PUBLIC_SUPABASE_URL` to `https://fcwrcxywakrwkixvewoq.supabase.co`.
4. Set `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to this project's enabled publishable key from the Supabase dashboard. The existing deployment has both variables configured for Production. Use a separate backend for previews that must stay isolated from production data.
5. Deploy and verify the build succeeds before sharing the URL.
6. In Supabase → Authentication → URL Configuration, set **Site URL** to the deployed production origin. Add `<production-origin>/auth/callback` and `<production-origin>/auth/confirm` as redirect URLs. Add `http://localhost:4173/auth/callback` only if local auth testing is needed. Avoid broad preview-domain wildcards.
7. Create an account, confirm its email, sign in, add a lead, reload and verify the lead persists. Check a second account cannot see it. Email confirmation and an actual signed-in browser flow remain to be verified.

The original private ChatGPT-hosted EstateFlow site remains separate. To transfer records, export a JSON backup from the original app and restore it after signing in to this edition. The public demo never loads saved account records.

## Database

The applied migration is under `supabase/migrations/`. Do not re-run it against this existing project. New projects can apply it with the Supabase migration tooling. It creates:

- `public.workspaces`: account-owned JSON records with revision comparison for concurrent saves.
- `public.save_workspace`: an invoker function that derives the account from `auth.uid()` and atomically compares the expected revision.
- `estateflow_private.ai_quota`: a private, unexposed rate-limit table.
- `public.consume_ai_quota`: an invoker wrapper around a private function that derives the authenticated caller, allowing eight AI requests per minute. Direct table access is revoked.

No application service-role credential or database password is required. The private quota table intentionally has RLS with no direct-access policy; the Supabase advisor reports this as an informational item, and direct access was verified blocked.

## AI and review

In a saved workspace, open Integrations → Gemini AI, create a Google AI Studio key in a suitable project, then connect. Google's model availability, quotas, free-tier eligibility and data-use terms apply. The key is cleared on reload. No live key was supplied during implementation, so provider generation has not been tested.

AI context excludes names, emails, phone numbers and free-text notes. The server also redacts contact patterns and known lead names from prompts. Use fictional, non-confidential records for portfolio walkthroughs. AI task/stage changes remain proposals until confirmed. Drafts require review and approval before opening Gmail; the application never sends an email itself.

## Verification recorded

- All 19 initial TypeScript/TSX files passed syntax transpilation.
- Live Supabase transaction checks passed: first save, update, stale-revision rejection, invalid first revision rejection, account isolation, cross-account insert blocked, private quota access blocked, and the ninth AI request rejected. Fixtures were rolled back; no QA records remain.
- Local domain checks cover fictional seed independence, template privacy, closed-lead follow-up behavior and invalid workspace rejection.
- Dependency installation, local tests, and the production build passed in GitHub Actions and on Vercel. The deployed login page, fictional demo, property illustrations/matching, and anonymous workspace access protection were verified.
- Live email confirmation, browser-authenticated persistence, and live Gemini generation remain release checks. The Supabase dashboard requires owner sign-in to update the email confirmation return URLs.

See `DEPLOYMENT.md` for exact provider IDs and current upload status.
