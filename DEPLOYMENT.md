# Deployment status

Prepared on 30 October 2026.

| Service | Role | Status |
| --- | --- | --- |
| Existing Sites | Original private EstateFlow application | Available at https://estateflow-carl.saltyberry128.chatgpt.site/ |
| GitHub | Standalone source and change history | Complete source packaged for the owner's manual repository upload |
| Vercel | Next.js hosting | Import the uploaded GitHub repository, configure environment values, and verify the production build |
| Supabase | Account sign-in and persistent records | Project created, schema applied, database tests passed |

## Exact provider identifiers

- GitHub account: `yuukirito0812`
- Suggested repository name: `estateflow` (create a new repository; do not overwrite PESOBASE or Personal-Portfolio).
- Vercel team: `team_hkEK6ju9lWrvGQVOjSGnDGh0`, slug `cz-95a8`.
- Supabase organization: `vixsbcmkwodfpdcuebof`.
- Supabase project: `fcwrcxywakrwkixvewoq`, name `EstateFlow`, region `ap-southeast-1`.
- Applied migration: `20261030083954_estateflow_workspace_and_ai_quota.sql`.

## Remaining release work

1. Create a GitHub repository named `estateflow` and follow `START_HERE.md` to upload the extracted source.
2. Upload this exact source. Exclude `.env.local`, `node_modules`, generated builds and all credentials.
3. Import the GitHub repository into Vercel using the Next.js preset and Node.js 22.x, with `package.json` at the repository root.
4. Configure the two public Supabase environment variables in Vercel, then run and inspect the production build.
5. Set the exact deployed origin/redirect URLs in Supabase Auth and test sign-up → email confirmation → sign-in → save → reload → sign-out.
6. Verify `/demo` separately, then connect Gemini using a session key if desired.

No Netlify project, paid plan, domain purchase, extra database, email-sending service, or automatic message delivery is necessary for this stack.
