# Local tinkering and classroom deployment

Original Spaceship IDE: Chuanqi Sun, https://github.com/chuanqisun/spaceship. Preserve LICENSE and CITATION.cff when sharing this adaptation.

## Local simulator

Use Node 24, then `npm ci` and `npm run dev -- --host 127.0.0.1`. Open http://127.0.0.1:5173/. No credentials are needed for simulation. The `models` link opens the decision lab; `/report/` describes the architecture.

## Hosted access

Deploy this Vite application and its `api/` functions to Vercel. The base path defaults to `/`. Create an isolated Postgres database and configure server-only variables from `.env.example`. Enable WorkOS Magic Auth in the same environment as the client ID and API key. The custom email-code flow uses no OAuth callback.

Run migrations against an isolated development database branch first, then the production database: `npm run db:setup`. This reads `.env.local`, requires the direct DATABASE_URL_UNPOOLED, and seeds OWNER_EMAIL as the owner. It does not send invitations or set a spending allowance. Existing member roles are never promoted by rerunning setup.

Sign in at `/admin/`, set the cumulative dollar allowance, and add participant email addresses. The initial allowance is $0. The owner panel supports up to $100; use a dedicated OpenRouter API key with a corresponding provider-side limit. Adding roster entries does not send email. Participants request codes themselves. Revoking access invalidates subsequent requests; in-flight provider work may still incur charges.

Set APP_ORIGIN to the exact production origin (or comma-separated explicit trusted production origins). Use a separate database branch, WorkOS environment, and provider key for previews. For local authenticated development, use APP_ORIGIN=http://127.0.0.1:5173 and development credentials. Never copy production credentials into VITE_ variables or commit .env files.

## Verification

Run `npm test`, `npm run format`, and `npm run build`. Tests exercise session revocation, authorization, allowance accounting, rate limits, request validation, and origin checks. Browser checks should cover public simulation, sign-in, owner roster changes, budget refusal, decision results, streaming, and logout. Actual email delivery and paid provider calls require configured services and an owner-approved allowance; build success alone does not prove those flows.

## Pilot scope

One roster, owner/participant roles, global cumulative allowance, request/concurrency limits, provider cost accounting, and a decision-model comparison page. BYO keys, local inference, workshop scheduling, facilitator roles, per-person allowances, and automated data-retention policies are future work. The database stores access and request metadata, not prompts or generated text; provider services receive input content.

Deploy with `vercel --prod --scope aroughidea` after linking the intended project. The old GitHub Pages workflow is manual and simulator-only; it cannot host these API routes.

## Current deployment

Public pilot: https://spaceship.aroughidea.com/ � owner panel at `/admin/`, experiments at `/lab/`. The fallback address is https://spaceship-peach-six.vercel.app/.

The custom domain and HTTPS were verified on November 16, 2026. Both the pilot and custom origins are explicitly allowed by the production API. The existing Neon Launch installation was retained; no installation plan change was made.

## Source and attribution

This classroom adaptation is maintained at https://github.com/tj60647/spaceship, forked from https://github.com/chuanqisun/spaceship. The original history, MIT license, and Chuanqi Sun�s citation are preserved. Local `origin` points to the adaptation; `upstream` points to the original project.

The current Vercel release was uploaded directly from local source. Pushing to this fork does not by itself establish automatic Vercel deployments; configure a Git connection separately if desired.
