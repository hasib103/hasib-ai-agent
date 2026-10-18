# Hasib AI Agent

Mobile-first personal AI agent control panel.

## Features in this source snapshot
- Task inbox and status tracking
- Searchable memory notes UI
- Approval queue for sensitive actions
- Activity audit log and notification preferences
- Integrations management UI
- Supabase integration scaffolding

## Stack
React, TypeScript, TanStack Start/Router, Vite, Tailwind CSS, Supabase, Capacitor.

## Source transfer
This repository contains source files recovered from the Lovable project "Task Mind Dashboard" (project ID: c2640768-96ae-4103-911a-59b4394ea1ff). The binary favicon and local `.env` file are not stored in this repository.

## Environment configuration
Set these variables in your local environment or deployment settings as needed. Never commit secret values:
- `SUPABASE_PROJECT_ID`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`

A publishable key is not a service-role key. Never expose Supabase service-role keys or provider OAuth secrets in browser code.

## Development with Node.js and npm
Install Node.js 22 or later, then run:

```sh
npm install
npm run dev
```

Build and test:

```sh
npm run build
npm run test
```

There is currently no committed `package-lock.json`; `npm install` resolves dependencies and may produce one. For reproducible CI, commit the generated lockfile after verifying the build.

## Render deployment
The app's Render service currently has a dashboard build command that uses Bun. Change the service build command to `npm install && npm run build` and keep the start command as `node .output/server/index.mjs`. The service needs the required environment variables configured in Render. Free web services may sleep when idle and take time to wake.

## Android APK
The GitHub Actions workflow can be started from Actions → Build Android APK → Run workflow. On success, download the `hasib-ai-agent-android-debug` artifact from the workflow run. A successful source transfer does not by itself prove the APK or all integrations work; check the build result and test the app on the phone.

## Integrations status
The integrations UI is not proof that external services are connected. Configure OAuth clients and server-side credentials before enabling provider actions. Do not paste API keys into chat or commit them to the repository.
