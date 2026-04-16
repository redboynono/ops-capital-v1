# Ops Capital V1 Environment Setup

Create `/home/ops-capital-v1/.env.production` with:

```bash
NEXT_PUBLIC_BASE_URL=http://117.122.240.173:3100
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_MONTHLY=price_xxx
STRIPE_PRICE_YEARLY=price_xxx

ADMIN_EMAILS=your-admin-email@example.com
```

Start with Docker:

```bash
docker build -t ops-capital-v1 /home/ops-capital-v1
docker rm -f ops-capital-v1 2>/dev/null || true
docker run -d --name ops-capital-v1 --restart unless-stopped \
  --env-file /home/ops-capital-v1/.env.production \
  -p 3100:3000 ops-capital-v1
```
