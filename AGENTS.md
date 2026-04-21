# OPS Capital / OPS Alpha — Agent Playbook

This file is auto-loaded by coding agents (Roo Code, Cascade, Claude Code, Cursor).
Read it first. Keep it under 200 lines.

## What this project is

Two sites sharing one Next.js codebase:

| Path | Audience | Visual style | Layout |
|---|---|---|---|
| `/` | 未登录访客 / SEO | **Bridgewater**：米白 `#f5f1ea` + 黑衬线 + 金色 `#b08b57` | `src/app/page.tsx` (self-contained, no SideNav) |
| `/alpha` and all `(app)/**` | 注册用户 | **Bloomberg Terminal**：黑底 `#0a0a0d` + 琥珀 `#ff9900` + 涨绿跌红 | `src/app/(app)/layout.tsx` wraps with `.terminal` class |

`/alpha` is behind login guard (redirect to `/login?redirect=/alpha`).
`/admin/**` is guarded by `ADMIN_EMAILS` env.

## Tech stack

- **Next.js 16.2** App Router + TypeScript + Tailwind 4
- **MySQL 8** (`ops_alpha` db), schema at `mysql/init.sql`
- **AI**: MiniMax-M2.7-highspeed via OpenAI-compatible endpoint (`https://api.minimaxi.com/v1/chat/completions`)
- **Auth**: cookie session (HMAC-signed), bcrypt password hash
- **Deploy**: Docker on `root@188.239.8.157` (Singapore), Caddy → `https://opscapital.com`

## Critical files

```
src/app/page.tsx                        # Bridgewater marketing home (no SideNav)
src/app/layout.tsx                      # root layout (minimal, just <html>)
src/app/(app)/layout.tsx                # app layout: .terminal wrapper + TopBar+Ticker+SideNav+FKeys
src/app/(app)/alpha/page.tsx            # Alpha desk (login-gated)
src/app/(app)/login/page.tsx            # login/signup with ?redirect= support
src/app/api/research/generate/route.ts  # AI content generation (MiniMax)
src/app/api/auth/**                     # signin / signup / signout / forgot / reset
src/app/(app)/admin/editor/page.tsx     # admin-only AI content editor
src/components/side-nav.tsx             # dark sidebar with F-key hints
src/components/terminal-chrome.tsx      # TopBar + TickerTape + FunctionBar (client)
src/lib/auth.ts                         # getSessionUser, session signing
src/lib/admin.ts                        # isAdminEmail, requireAdmin
src/lib/mysql.ts                        # mysqlQuery helper
src/lib/posts.ts                        # post listing / detail / upsert
src/lib/ai/researchSystemPrompt.ts      # prompts for MiniMax
src/app/globals.css                     # design tokens: :root (SA/Bridgewater) + .terminal scope
mysql/init.sql                          # schema: users, posts, tickers, post_tickers, watchlist, bookmarks, reading_history + tickers seed
scripts/deploy.sh                       # rsync + docker build + restart (PRESERVES .env.production)
```

## Design tokens (globals.css)

- Root scope: cream theme used only by `/` marketing. Never touch its visuals here.
- `.terminal` scope: everything in `(app)/**`. Use Tailwind utilities that reference `var(--background)` / `var(--foreground)` / `var(--accent)` / `var(--success)` / `var(--danger)` so both themes re-skin automatically.
- For up/down numbers use `.up` / `.down` / `.flat` classes.
- For tabular data use `.mono` or inline `font-family: var(--font-mono)`.

## Do / Don't

**Do**
- Keep marketing `/` styled with inline `style={{}}` (Bridgewater colors) — independent of `.terminal` scope.
- Put all new app pages under `src/app/(app)/`. They auto-inherit Terminal theme + chrome + SideNav.
- Guard logged-in-only pages with `const user = await getSessionUser(); if (!user) redirect("/login?redirect=/your/path");`
- Guard admin pages with `const { ok } = await requireAdmin(); if (!ok) ...`
- For new AI calls reuse `/api/research/generate`'s pattern (OpenAI-compatible via `OPENAI_*` env).
- After editing, run `npm run build` locally to type-check before deploy.

**Don't**
- Don't add route groups beyond `(app)` unless introducing a genuinely new layout.
- Don't break the `.terminal` scoping (nothing inside `(app)` should hard-code light colors).
- Don't commit `.env.production` (it's server-side only).
- Don't run `rsync --delete` manually to the server — use `scripts/deploy.sh` (it excludes env files).

## Env vars (server)

```
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=https://opscapital.com
MYSQL_URL=mysql://root:<urlenc>@ops-mysql:3306/ops_alpha
SESSION_SECRET=<64+ hex>
ADMIN_EMAILS=steven.sun@opscapital.com
OPENAI_API_KEY=sk-cp-...            # MiniMax key
OPENAI_BASE_URL=https://api.minimaxi.com/v1
OPENAI_MODEL=MiniMax-M2.7-highspeed
OPENAI_MAX_TOKENS=16000
```

`.env.production` lives at `/opt/ops-alpha/.env.production` on the server. Never overwrite from local.

## Deploy workflow

From repo root locally:

```bash
./scripts/deploy.sh
```

This does: `rsync --delete --exclude .env.production` → `docker build` → `docker rm -f && docker run` → smoke test `/ /alpha /login`.

To check logs: `sshpass -p tzmm.987 ssh root@188.239.8.157 'docker logs -f --tail 100 ops-alpha'`

## Running locally

```bash
npm install
npm run dev   # http://localhost:3000 — will try to connect to MYSQL_URL in .env.local
```

Spin up local MySQL with Docker if needed:
```bash
docker run -d --name ops-mysql-dev -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=dev -e MYSQL_DATABASE=ops_alpha mysql:8.0
docker exec -i -e MYSQL_PWD=dev ops-mysql-dev mysql -uroot ops_alpha < mysql/init.sql
```

Then set `.env.local`:
```
MYSQL_URL=mysql://root:dev@127.0.0.1:3306/ops_alpha
SESSION_SECRET=dev-secret-at-least-32-chars-long
ADMIN_EMAILS=you@example.com
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.minimaxi.com/v1
OPENAI_MODEL=MiniMax-M2.7-highspeed
```

## Current TODOs / ideas

- Wire ticker tape to real market data (Finnhub / Alpha Vantage 5s polling).
- Make F1–F8 keyboard shortcuts actually work (global `keydown` listener).
- Articles/news detail pages: consider light-theme `.reader` opt-out from Terminal for long-form reading.
- Stripe / WeChat Pay for `/pricing` subscription (schema already has `subscription_status`).
- Forgot-password email delivery: currently prints to server log; wire SMTP in `src/lib/mail.ts`.
