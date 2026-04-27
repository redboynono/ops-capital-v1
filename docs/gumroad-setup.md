# Gumroad 接入指南（中国大陆卖家友好）

> 适用范围：把 OPS Alpha 的支付通道从 mock 切到 Gumroad 真实收款。
> 所需材料：**中国护照**（Gumroad KYC，非强制上传）+ 一个可收美元账户（PayPal / Payoneer / Wise）。

> Gumroad 支持中国大陆卖家注册和出款，费率 10%（比 Stripe 高，但零实体要求）。
> 等 HK 公司到位可无痛切 Stripe（`gateways.ts` 架构为此预留了接口）。

---

## 1. 注册 Gumroad 卖家账号

1. https://gumroad.com/signup
2. 用 Google 登录或邮箱注册
3. **国家选择 China**（非常重要 —— 不要选美国，否则触发 SSN 强制流程）
4. 进入 Dashboard

> 如果 onboarding 过程中弹出 `社会保障号码后 4 位 / W-9` 表单：**关掉**那个标签页，不要填。后期到 Settings → Payments → Tax information 切换成 W-8BEN 即可。

---

## 2. 创建 3 个 Membership 产品

Dashboard → **Products** → **New product** → 选 **Membership**。

逐个创建：

| 套餐 | Name | Recurrence | Price | Suggested price |
|---|---|---|---|---|
| 月度 | `OPS Alpha · 月度会员` | Monthly | `$9.99` | 固定价（关掉 Pay what you want） |
| 季度 | `OPS Alpha · 季度会员` | Every 3 months | `$24.99` | 固定价 |
| 年度 | `OPS Alpha · 年度会员` | Yearly | `$87.99` | 固定价 |

**每个产品必须 Publish** 才能被用户购买。

**Content** 字段可留空或填 `查看 https://opscapital.com/dashboard`（Gumroad 会在购买后把这段发到用户邮箱，作为 fallback 入口）。

创建后每个产品有一个 **permalink**（URL 末尾的 6-7 位短码，形如 `phjcef`）。记下 3 个 permalink。

---

## 3. 设置 Ping URL（Webhook）

Settings → **Advanced** → **Ping** 区块 → 填：

```
https://opscapital.com/api/pay/notify/gumroad
```

点 Save。Gumroad 会在每个销售事件（首次购买 + 每次订阅续费 + 退款）POST 到这个 URL。

> Gumroad Ping **没有原生签名**。我们的 webhook 用「sale_id 反查 API」方式验证真伪 —— 只有真实销售才能被我们的 access token 查到。

---

## 4. 创建 API Access Token

`gumroad.com/api` → **Create application**：

- **Application name**: `opscapital`
- **Redirect URI**: `https://opscapital.com/api/pay/notify/gumroad`（OAuth 用，我们不走 OAuth 可随便填）
- 提交后页面会显示 **Access Token** —— **这个值只显示一次**，立刻复制到安全位置

> ⚠️ 如果 Access Token 不小心暴露，回到 `gumroad.com/api` 点 `Revoke access` 后重新创建应用。

---

## 5. 拿到 Seller ID（可选但推荐）

用于 webhook 验签的额外一层校验。三种方式拿：

1. Dashboard → **Settings → Profile** → 下滚找到 `User ID` 或 `Seller ID`
2. Ping 首次触发时，查服务器日志里 payload 的 `seller_id` 字段
3. 调 API：
   ```bash
   curl -H "Authorization: Bearer <YOUR_TOKEN>" https://api.gumroad.com/v2/user
   ```
   返回 JSON 里的 `user.id`

---

## 6. 服务器配置

在 `/data/ops-alpha/.env` 末尾追加（不要提交 git）：

```bash
PAYMENT_MODE=live

GUMROAD_USERNAME=opscapital
GUMROAD_ACCESS_TOKEN=eyJ0...（步骤 4 拿到的）
GUMROAD_SELLER_ID=...（步骤 5 拿到的，可选）

GUMROAD_PERMALINK_MONTH=phjcef        # 换成月度产品的 permalink
GUMROAD_PERMALINK_QUARTER=xxxxxx      # 季度
GUMROAD_PERMALINK_YEAR=yyyyyy         # 年度
```

重启容器：

```bash
cd /data/ops-alpha && docker compose restart ops-alpha
```

---

## 7. 端到端验证

1. 访问 https://opscapital.com/pricing
2. 选月度套餐 → 点 `立即购买`
3. 应跳转到 `https://opscapital.gumroad.com/l/phjcef?wanted=true&out_trade_no=OPS...&user_id=...`
4. Gumroad 测试卡：`4242 4242 4242 4242`（任意未来日期 + 任意 CVV）
5. 付款完成 → Gumroad 异步 ping 我们的 webhook → 订单 paid + 会员生效
6. 访问 `/dashboard` 应看到订阅状态 `active` + 到期日期

> **测试模式**：Gumroad 没有独立 test/live store 切换，但有 `test_purchase` flag。用 `4242...` 卡付款时 Gumroad 自动识别为 test sale，ping 里 `test=true`，我们代码不会为 test sale 做特殊处理 —— 会像真订单一样续期会员。所以验证最好用**真实信用卡 + 小额套餐**，验证完申请退款即可。

---

## 8. 订阅生命周期事件

Gumroad Ping 会在以下场景触发：

| 场景 | ping 特征 | 我方处理 |
|---|---|---|
| 首次购买 | `is_recurring_charge=false` + 含 `url_params.out_trade_no` | 找 pending order → applyPaymentSuccess |
| 续费（每月/每季/每年） | `is_recurring_charge=true` + 同样 url_params | 合成 `GMRD-<sale_id>` → createPaidOrderAndExtend（续期）|
| 退款 | `refunded=true` | markOrderFailed（**不**回收剩余会员时长）|
| 用户取消订阅 | `subscription_ended` 事件 | 当前忽略（Gumroad 不再扣款即可，到期自然失效）|

---

## 9. 退款 & 争议

- Gumroad 7 天内用户可直接在购买邮件里点 `Refund` 自助退款
- 超过 7 天找 Gumroad 客服
- 退款发生后 Gumroad 会 ping 我们（`refunded=true`），我方标订单 failed 但保留会员到期日
  - 设计考虑：如果严格扣回，用户会"订一个月，看几天就退款"刷内容，对你不利
  - 你若要改为"退款即回收剩余会员时长"，编辑 `@src/app/api/pay/notify/gumroad/route.ts` 的 refund 分支

---

## 10. 税务 & 出款

Gumroad 是 Merchant of Record：
- 美国 sales tax / EU VAT 等由 Gumroad 收取并缴纳，你看到的只是 net payout
- Gumroad 抽成 **10%**（其中包括交易费 + 税务服务费）
- 出款方式：PayPal（推荐，中国账号可用）或 Payoneer
- 国内结汇：PayPal → 招行全币种 / 中行多币种 → 结汇到人民币

年度销售额 > $600（美国阈值）时 Gumroad 会发 W-9 / W-8BEN 表单填写请求 → **这时必须切到 W-8BEN（非美国居民）**，填身份证号或护照号即可。

---

## 速查：env 清单

| Key | 值来源 | 必填 |
|---|---|---|
| `PAYMENT_MODE` | `live` 或 `mock` | ✅ |
| `GUMROAD_USERNAME` | 你的 Gumroad 店铺 URL 前缀（`opscapital`） | ✅ |
| `GUMROAD_ACCESS_TOKEN` | gumroad.com/api 创建应用获得 | ✅ |
| `GUMROAD_SELLER_ID` | Settings → Profile | 可选 |
| `GUMROAD_PERMALINK_MONTH` | 月度产品 permalink | ✅ |
| `GUMROAD_PERMALINK_QUARTER` | 季度产品 permalink | ✅ |
| `GUMROAD_PERMALINK_YEAR` | 年度产品 permalink | ✅ |
| `NEXT_PUBLIC_BASE_URL` | `https://opscapital.com` | ✅ |
