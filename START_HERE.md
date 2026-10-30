# Start here — upload EstateFlow

This ZIP contains the complete authored source for **one website project**: frontend, backend API routes, AI integration, illustrations, database migration, tests, and setup files. Use one GitHub repository named `estateflow`.

## 1. Extract the ZIP

On Windows, right-click the downloaded ZIP and choose **Extract All**. Open the extracted `estateflow` folder. You should see `package.json`, `README.md`, `app`, `lib`, and `public`.

## 2. Upload the files to GitHub

Create your `estateflow` repository. Use its file-upload option and upload **all contents inside the extracted `estateflow` folder**, keeping their subfolders.

The important result is:

- `package.json` is directly in the repository root.
- `app`, `lib`, `public`, `supabase`, and `tests` are folders in that same root.
- `.gitignore`, `.env.example`, and `.github` are included too. Enable hidden-file display if your computer hides them.

Commit the upload. Extract the ZIP before uploading the application's source. An extra outer `estateflow` folder would move `package.json` one level deeper and require a different Vercel root-directory setting.

## 3. Deploy with Vercel

Import the GitHub repository into Vercel using **Next.js** and **Node.js 22.x**. Use `npm run build` as the build command and keep the normal Next.js output settings.

Set these two environment variables for Production and any Preview environment you plan to use:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fcwrcxywakrwkixvewoq.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The enabled publishable key from the EstateFlow Supabase project's API key settings |

Use the publishable key. This application does not require a database password or service-role key. Environment values are configured separately and are not included in the ZIP.

Deploy and inspect the build result. The full production build still needs to pass on Vercel before this standalone edition is considered verified.

## 4. Finish Supabase sign-in setup

The EstateFlow database is already prepared in project `fcwrcxywakrwkixvewoq`. The migration in `supabase/migrations/` is included for reference and for new projects; do not apply it again to this existing project.

After deployment, set Supabase Auth's Site URL to your actual Vercel production origin. Add your exact production URLs ending in `/auth/callback` and `/auth/confirm` to the allowed redirects. Then create an account, confirm its email, sign in, add a lead, and reload to verify persistence.

Full setup and release checks are in [README.md](README.md) and [DEPLOYMENT.md](DEPLOYMENT.md).

## 5. Connect AI when ready

Open your deployed site, sign in, and open **Integrations → Gemini AI**. Connect your Google AI Studio key there. Keep keys out of GitHub and chat messages. Until connected, the app uses clearly labeled templates. Google's free-tier availability, quotas, and terms apply.

For a portfolio walkthrough without an account, visit `/demo` on your deployed website. Its fictional records reset on reload.

## What is intentionally outside the ZIP?

Only generated dependencies/builds, Git metadata, credentials, and local environment values are excluded. `npm install` restores dependencies; Vercel builds the website. After the first successful dependency installation, commit the generated `package-lock.json`.
