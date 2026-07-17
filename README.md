# branderize

An AI marketing workspace that learns a company once, then coordinates the right specialists from shared brand context.

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_cVmPdHCkwwl8LsGYov8vE2v70kMS)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database environments and migrations

Neon is connected through Vercel as a single project with three database lifecycles:

- the persistent `main` branch serves Production;
- the persistent `development` branch serves local Development;
- Preview deployments receive an isolated `preview/*` branch for their Git branch.

For local development, pull the Development environment and apply the committed migrations before starting the app:

```bash
vercel env pull .env.local --environment=development --yes
pnpm db:migrate
pnpm dev
```

`lib/db/schema.ts` is the source of truth. After changing it, generate and review a migration, then commit both the schema and generated `drizzle/` files:

```bash
pnpm db:generate --name=<change-name>
pnpm db:check
```

Vercel runs `pnpm db:migrate` before every Preview and Production build. Preview pushes therefore migrate only their corresponding preview database, while merges to `main` migrate Production. Do not use `drizzle-kit push`; deployment databases are advanced only through committed migrations.

When a pull request is merged into `main`, `.github/workflows/cleanup-neon-preview.yml` deletes its `preview/*` branch immediately. The workflow expects `NEON_PROJECT_ID` as a GitHub repository variable and `NEON_API_KEY` as a GitHub Actions secret; the official Neon GitHub integration can provision both.

## Passwordless authentication

Branderize signs users in with a six-digit code sent through Resend. Configure these server-side environment variables before using the authentication flow:

```bash
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM_EMAIL="Branderize <auth@your-verified-domain.com>"
```

The sender address must belong to a domain verified in Resend. To preview the React Email template locally, run `pnpm email:preview` and open [http://localhost:3001](http://localhost:3001).

To opt into the development-only authentication bypass, create `.env.development.local` with:

```bash
LOCAL_AUTH_BYPASS=1
```

The bypass is disabled by default and never activates on Vercel. When enabled under `next dev`, authentication emails are not sent and any six-digit code is accepted.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.
