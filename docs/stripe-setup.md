# Stripe Checkout 接入指南

> 文档：[Stripe Checkout](https://docs.stripe.com/payments/checkout) · [Checkout Sessions API](https://docs.stripe.com/api/checkout/sessions)

OPS Alpha 已内置 Stripe 托管收银台（`mode=payment` 一次性付款），与现有 `orders` / `applyPaymentSuccess` 流程兼容。

---

## 1. 创建 Stripe 账号

1. https://dashboard.stripe.com/register
2. 完成 Business 信息（建议用 **香港 / 新加坡实体**，Stripe 不支持中国大陆直连商户）
3. 开启 **Test mode** 先做联调

---

## 2. 获取 API 密钥

Dashboard → **Developers → API keys**

| 变量 | 说明 |
|------|------|
| `STRIPE_SECRET_KEY` | Secret key（`sk_test_...` / `sk_live_...`） |
| `STRIPE_WEBHOOK_SECRET` | Webhook 签名密钥（`whsec_...`） |

可选：`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`（预留嵌入式表单，当前 Checkout 跳转不需要）

---

## 3. 配置 Webhook

Dashboard → **Developers → Webhooks → Add endpoint**

- **Endpoint URL**：`https://opscapital.com/api/pay/notify/stripe`
- **Events**：
  - `checkout.session.completed`（必开）
  - `checkout.session.expired`（可选，标记 pending 订单失败）

复制 **Signing secret** → `STRIPE_WEBHOOK_SECRET`

### 本地调试

```bash
stripe login
stripe listen --forward-to localhost:3000/api/pay/notify/stripe
# 终端会输出 whsec_... 填入 .env.local
```

---

## 4. 生产环境变量

在 `/opt/ops-alpha/.env.production` 追加：

```bash
PAYMENT_MODE=live
PAY_PRIMARY_CHANNEL=stripe   # 不配则：有 STRIPE_SECRET_KEY 时默认 stripe

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_BASE_URL=https://opscapital.com
```

保留 Gumroad 变量可作为备选；设 `PAY_PRIMARY_CHANNEL=gumroad` 可切回。

---

## 5. 数据库迁移

```bash
docker exec -i ops-mysql mysql -uops -p<password> ops_alpha < mysql/migrations/015_pay_channel_stripe.sql
```

---

## 6. 测试流程

1. `PAYMENT_MODE=live` + `sk_test_...`
2. 登录 → `/pricing` → 点「立即购买（Stripe）」
3. 测试卡：`4242 4242 4242 4242` · 任意未来日期 · 任意 CVC
4. 支付成功 → 跳转 `/pay/success?out_trade_no=OPS...`
5. 确认 `orders.status=paid` 且用户 `subscription_end_date` 已续期

---

## 7. 与 Gumroad 对比

| | Stripe Checkout | Gumroad |
|--|-----------------|---------|
| 大陆个人卖家 | ❌ 需 HK/SG 等公司 | ✅ 支持 |
| 费率 | ~2.9% + $0.30 | ~10% |
| 自动续订 | 需另接 Subscription | ✅ Membership 内置 |
| 到账确认 | Webhook 签名验真 | sale_id 反查 API |
| UX | 专业收银台 + Apple Pay | 托管页，国内偶慢 |

当前实现为 **一次性买断 N 个月**，到期后用户需再次购买。后续可升级为 Stripe Billing Subscription。

---

## 8. 切换主通道

```bash
# 默认：配置了 STRIPE_SECRET_KEY → Stripe
PAY_PRIMARY_CHANNEL=stripe

# 强制回 Gumroad
PAY_PRIMARY_CHANNEL=gumroad
```

Mock 开发（`PAYMENT_MODE=mock`）两种通道均走 `/pay/mock/<out_trade_no>`，无需 Stripe 密钥。
