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
React, TypeScript, TanStack Start/Router, Vite, Tailwind CSS, Supabase.

## Source transfer
This repository contains the text source files recovered from the Lovable project "Task Mind Dashboard" (project ID: c2640768-96ae-4103-911a-59b4394ea1ff). The binary favicon and secret `.env` file were intentionally not copied.

## Environment configuration
Configure these variables in your local environment or deployment settings; never commit actual secret values:
- `SUPABASE_PROJECT_ID`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`

## Development
Use the package manager and scripts defined in package.json:
- `bun install --frozen-lockfile`
- `bun run build`
- `bun run test`

A GitHub Actions workflow has been added to attempt build and test checks on pushes to `main`. Source transfer is not the same as a successful build or an installable Android APK; those still require verification.
