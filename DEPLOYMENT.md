# Deployment status

Updated on 30 October 2026.

**Live app:** https://estateflow-rose.vercel.app/ · **Portfolio demo:** https://estateflow-rose.vercel.app/demo

| Service | Role | Status |
| --- | --- | --- |
| Existing Sites | Original private EstateFlow application | Available at https://estateflow-carl.saltyberry128.chatgpt.site/ |
| GitHub | Standalone source and change history | Complete source uploaded at https://github.com/yuukirito0812/EstateFlow |
| Vercel | Next.js hosting | Production deployment ready; GitHub linked, Node.js 22, Supabase production environment configured |
| Supabase | Account sign-in and persistent records | Project created, schema applied, database tests passed |

## Exact provider identifiers

- GitHub account: `yuukirito0812`
- Repository: `yuukirito0812/EstateFlow`, production branch `main`.
- Vercel team: `team_hkEK6ju9lWrvGQVOjSGnDGh0`, slug `cz-95a8`.
- Vercel project: `prj_j0DnA2ZuaL0hu1dW1KjvsGFfroDZ`, name `estateflow`.
- Supabase organization: `vixsbcmkwodfpdcuebof`.
- Supabase project: `fcwrcxywakrwkixvewoq`, name `EstateFlow`, region `ap-southeast-1`.
- Applied migration: `20261030083954_estateflow_workspace_and_ai_quota.sql`.

## Remaining release work

1. In Supabase → Authentication → URL Configuration, set the Site URL to `https://estateflow-rose.vercel.app` and add these redirect URLs:

   - `https://estateflow-rose.vercel.app/auth/callback`
   - `https://estateflow-rose.vercel.app/auth/confirm`

   This dashboard setting remains pending because the browser requires owner sign-in. The production database and public environment values are already configured.
2. Test sign-up → email confirmation → sign-in → save → reload → sign-out. The anonymous workspace API correctly requires sign-in; a complete signed-in browser flow has not been tested.
3. Connect Gemini using a session key in the saved workspace if desired. No live AI key was supplied during setup.

The deployed `/demo`, property illustrations, and rules-based matching were verified. GitHub Actions tests/build and the Vercel production build passed.

No Netlify project, paid plan, domain purchase, extra database, email-sending service, or automatic message delivery is necessary for this stack.
