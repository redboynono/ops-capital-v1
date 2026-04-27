# LemonSqueezy 接入指南

> 适用范围：将 OPS Alpha 的支付通道从 mock 切到 LemonSqueezy 真实收款。
> 你需要：一本中国护照（用于 KYC）、一个能收美元的账户（Wise / Payoneer / 招行全币种皆可）。

---

## 1. 注册 LemonSqueezy Seller 账号（10 分钟）

1. 访问 https://app.lemonsqueezy.com/register
2. 注册邮箱（建议用业务邮箱，比如 `payments@opscapital.com`）
3. **Onboarding**：
   - 业务类型选 `Software / SaaS`（不是 `Digital products`，订阅产品需要 SaaS 类目）
   - 业务地址：填你国内地址即可，LemonSqueezy 不要求营业执照
   - 上传护照（国籍 China）做 KYC
   - 关联出款账户：Wise → 选 USD 账户即可
4. 提交后通常 1-2 个工作日审核通过

> ⚠️ Lemon 在中国大陆的支持情况：可正常注册和收款，出款走 Wise 完全正常。但偶有用户反馈中国 IP 注册需要邮件申诉，建议挂 HK / SG 节点完成注册。

---

## 2. 创建 Store

1. 登录后 → `Stores` → `Create a store`
2. **Store name**：`OPS Capital`（用户结账时会看到）
3. **Currency**：USD（推荐，避免汇率损失；如果你想显示 CNY 后续也能切）
4. **Tax**：先选 `Don't collect tax`，等流水大了再开
5. 拿到 **Store ID**（是个数字，记下来）→ `LEMONSQUEEZY_STORE_ID`

---

## 3. 创建 3 个 Product（每个套餐一个）

> 我们用 **One-time products**（不是 Subscriptions），符合"预付费买断"模型。

对每个套餐重复以下步骤：

### 3.1 月度会员（month）

- `Products` → `New product`
- **Name**：`OPS Alpha · 月度会员`
- **Type**：`Single payment`
- **Price**：`$9.99`（约 ¥68，按用户实际支付币种）
- **Description**：
  ```
  解锁 OPS Alpha Premium 1 个月：
  · 完整深度研报（含估值模型）
  · 每月精选荐股 OPS Picks
  · 自选股桌面 + 阅读历史
  ```
- **Thank-you URL** 留空（我们用 API 创建 checkout 时会指定）
- 创建后进入产品页 → `Variants` → 复制 **Variant ID**（数字）→ `LEMONSQUEEZY_VARIANT_MONTH`

### 3.2 季度会员（quarter）

- 同上，价格 `$24.99`（约 ¥168）
- 拿到 → `LEMONSQUEEZY_VARIANT_QUARTER`

### 3.3 年度会员（year）

- 同上，价格 `$87.99`（约 ¥588）
- 拿到 → `LEMONSQUEEZY_VARIANT_YEAR`

> 如果你想价格在前端显示 ¥ 而 Lemon 端结算 $，保持 `plans.ts` 里的 CNY 不变即可——
> 我们的 DB 记录是 CNY 元数据，Lemon 实际扣款按 variant 配置的 USD 金额。

---

## 4. 创建 API Key

1. `Settings` → `API` → `Create API key`
2. Name 填 `ops-alpha-prod`
3. 复制生成的 token（**只显示一次**）→ `LEMONSQUEEZY_API_KEY`

---

## 5. 创建 Webhook

1. `Settings` → `Webhooks` → `Create webhook`
2. **Callback URL**：`https://opscapital.com/api/pay/notify/lemon`
3. **Signing secret**：随机生成一个长字符串（建议 `openssl rand -hex 32`）→ `LEMONSQUEEZY_WEBHOOK_SECRET`
4. **Events**（必勾）：
   - ✅ `order_created`
   - ✅ `order_refunded`
   - 其他暂不需要（subscription 事件未来切到订阅模式时再开）
5. 保存

> 测试 webhook：在 Webhook 配置页有 `Send test event` 按钮，可以触发一次假事件验证签名校验。

---

## 6. 在服务器上设置 env

在服务器 `/data/ops-alpha/.env` 末尾追加（**不要提交到 git**）：

```bash
PAYMENT_MODE=live

LEMONSQUEEZY_API_KEY=eyJ0eXAi....（步骤 4 复制的）
LEMONSQUEEZY_STORE_ID=12345（步骤 2 的数字）
LEMONSQUEEZY_WEBHOOK_SECRET=（步骤 5 的随机字符串）
LEMONSQUEEZY_VARIANT_MONTH=678901
LEMONSQUEEZY_VARIANT_QUARTER=678902
LEMONSQUEEZY_VARIANT_YEAR=678903
```

然后重启容器：
```bash
cd /data/ops-alpha && docker compose restart ops-alpha
```

---

## 7. 端到端验证

1. 访问 https://opscapital.com/pricing
2. 选月度套餐 → 点 `立即购买`
3. 跳转到 LemonSqueezy 托管 checkout 页面（URL 形如 `opscapital.lemonsqueezy.com/checkout/buy/...`）
4. 用测试卡（Lemon 提供 `4242 4242 4242 4242` 测试卡，需在 store settings 启用 test mode）完成付款
5. LemonSqueezy 自动跳回 `/pay/success?out_trade_no=...`
6. 此时 webhook 异步抵达 → 订单标记 paid → 用户 `subscription_status=active`
7. 在 `/dashboard` 应能看到会员状态 + 到期日

> 如果用 test mode：在 LemonSqueezy 后台先开 `Settings` → `Test mode`，store 切到测试态时不会真实扣款。

---

## 8. 切换回 mock 模式（开发期）

```bash
# 在 .env 中
PAYMENT_MODE=mock
# 或者直接删除 PAYMENT_MODE 行（默认就是 mock）
```

重启容器后，`/pay/mock/<out_trade_no>` 页面会重新可用，前端按钮跳转的是本地 mock URL。

---

## 9. 退款流程

LemonSqueezy 后台 `Orders` → 找到订单 → `Refund` 按钮。

退款触发 `order_refunded` webhook → 我们的 handler 会把订单 `status` 改为 `failed`，但 **不会**回收用户已生效的会员时长（产品决策：避免恶意「订一个月看几天再退款」）。

如果想严格扣回时长，修改 `src/app/api/pay/notify/lemon/route.ts` 的 `order_refunded` 分支：调用一个新函数 `revokePaymentSuccess(out_trade_no)` 把对应 `duration_months` 从用户 `subscription_end_date` 倒减回去。

---

## 10. 财税

- LemonSqueezy 是 **Merchant of Record**，他们替你向各国税局缴 sales tax / VAT
- 你只需要按月在 Dashboard 看到的"Net payout"（扣除手续费 + 退款）从 Wise 提到国内卡
- 国内层面：这部分是个人外汇收入，按规定属"劳务报酬"或"特许权使用费"，年度结汇额度 $50k；超过需走 ODI 或公司化。建议年流水超 $30k 后咨询税务师

---

## 速查：env 清单

| Key | 值来源 | 必填 |
|---|---|---|
| `PAYMENT_MODE` | `live` 或 `mock` | ✅ |
| `LEMONSQUEEZY_API_KEY` | Settings → API | ✅ |
| `LEMONSQUEEZY_STORE_ID` | Stores 列表 | ✅ |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Webhook 创建时 | ✅ |
| `LEMONSQUEEZY_VARIANT_MONTH` | 月度产品 Variant | ✅ |
| `LEMONSQUEEZY_VARIANT_QUARTER` | 季度产品 Variant | ✅ |
| `LEMONSQUEEZY_VARIANT_YEAR` | 年度产品 Variant | ✅ |
| `NEXT_PUBLIC_BASE_URL` | `https://opscapital.com` | ✅ |
