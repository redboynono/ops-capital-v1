# Ops Capital V1 Environment Setup

Create /home/ops-capital-v1/.env.production with:

```bash
NEXT_PUBLIC_BASE_URL=http://117.122.240.173:3100
MYSQL_URL=mysql://ops_user:ops_password@127.0.0.1:3306/ops_capital
SESSION_SECRET=replace-with-a-long-random-secret

OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_MONTHLY=price_xxx
STRIPE_PRICE_YEARLY=price_xxx

ADMIN_EMAILS=your-admin-email@example.com

RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=Ops Capital <no-reply@your-domain.com>
```

Password reset email notes:

- If `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set,
  the forgot-password API sends real emails via Resend.
- If either one is missing,
  the API falls back to logging the reset link on the server.

Initialize MySQL schema (run once):

```bash
mysql -u root -p -h 127.0.0.1 -P 3306 -e "create database if not exists ops_capital;"
mysql -u root -p -h 127.0.0.1 -P 3306 ops_capital < /home/ops-capital-v1/mysql/init.sql
```

If the users table already exists, add reset-password columns once:

```bash
mysql -u root -p -h 127.0.0.1 -P 3306 ops_capital <<'SQL'
alter table users add column password_reset_token_hash varchar(64) null;
alter table users add column password_reset_expires_at datetime null;
SQL
```

Optional: one-time import from Supabase to MySQL:

```bash
export MYSQL_URL=mysql://ops_user:ops_password@127.0.0.1:3306/ops_capital
export SUPABASE_URL=https://YOUR_PROJECT.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
npm run migrate:supabase:mysql
```

Note: Supabase Auth password hashes are not migrated. Users should reset passwords after import.

Start with Docker:

```bash
docker build -t ops-capital-v1 /home/ops-capital-v1
docker rm -f ops-capital-v1 2>/dev/null || true
docker run -d --name ops-capital-v1 --restart unless-stopped \
  --env-file /home/ops-capital-v1/.env.production \
  -p 3100:3000 ops-capital-v1
```
