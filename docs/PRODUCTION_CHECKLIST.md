# OPS Alpha · 生产环境检查清单

> 最近检查：2026-05-19 · 服务器 `188.239.8.157`

## 环境变量（`/opt/ops-alpha/.env.production`）

| 变量 | 状态 |
|------|------|
| `PAYMENT_MODE` | `live` |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | 已配置 |
| `FINNHUB_API_KEY` | 已配置 |
| `POLYGON_API_KEY` | Massive Options Developer（末日期权数据源，仅服务器 `.env.production`） |
| `GUMROAD_*` | 已配置 |
| `OPENAI_*` | 已配置 |
| `CRON_SECRET` | 已配置 |

## Cron（`crontab -l`）

| 任务 | 频率 |
|------|------|
| `ops-alpha-daily-briefing.sh` | 每天 08:30 |
| `ops-alpha-daily-content.sh` | 每 6h + 每天 09:30 |
| `ops-alpha-daily-news.sh` | 每 4h |
| `ops-alpha-earnings-cron.sh` | 每 4h |
| `ops-alpha-alerts-check.sh` | 每 15min |
| `/api/cron/ratings` | 每天 03:00 |
| `ops-alpha-snapshot-ratings.sh` | 每天 16:30（美东收盘后，安装脚本新增） |

日志：`/var/log/ops-alpha-*.log`

## 部署后验收

```bash
./scripts/deploy.sh
curl -sI https://opscapital.com/alpha | head -1
curl -sI https://opscapital.com/pricing | head -1
```

## 首次安装 cron

```bash
./scripts/install-cron.sh
```
