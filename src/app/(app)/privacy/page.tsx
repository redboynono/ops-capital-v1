export const metadata = { title: "隐私政策 · OPS Alpha" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-8 md:px-6">
      <div className="reader-mode">
      <header className="mb-5 border-b border-[#d8d0c2] pb-3">
        <span className="label-caps">Privacy</span>
        <h1 className="mt-1 text-2xl font-bold">隐私政策</h1>
        <p className="mt-1 text-[11px]" style={{ color: "#6b5c3f" }}>最后更新：2026-04-01</p>
      </header>

      <article className="prose prose-sm max-w-none">
        <h2>我们收集什么</h2>
        <ul>
          <li>账户信息：邮箱、姓名（可选）、bcrypt 哈希后的密码</li>
          <li>使用信息：阅读历史、收藏、自选股、订阅状态</li>
          <li>技术信息：会话 cookie（HMAC 签名）、访问日志（保留 30 天）</li>
        </ul>

        <h2>我们不收集</h2>
        <ul>
          <li>任何实际交易账户、持仓、资金信息</li>
          <li>身份证、手机号、银行卡（支付功能由 Stripe / 第三方处理，不经过本平台存储）</li>
          <li>精确地理位置</li>
        </ul>

        <h2>如何使用</h2>
        <p>
          数据仅用于提供服务本身（登录、个性化内容推荐、订阅鉴权）以及平台运营分析。
          我们不会将个人数据出售给第三方。
        </p>

        <h2>第三方服务</h2>
        <ul>
          <li><strong>AI 模型提供商</strong>：MiniMax、OpenAI、Google 等。发送到模型的内容不包含你的个人数据，仅包含公开标的信息。</li>
          <li><strong>邮件发送</strong>：Resend API 用于发送密码重置邮件（仅传递邮箱地址与重置链接）。</li>
          <li><strong>支付</strong>：若使用 Stripe / 微信支付 / 支付宝，支付数据直接由服务商处理，本平台仅保留订阅状态与 stripe_customer_id。</li>
        </ul>

        <h2>数据保留</h2>
        <p>
          账户删除后，相关阅读历史与收藏将在 30 天内从生产数据库清除。数据库备份保留 14 天后自动轮换。
        </p>

        <h2>Cookie</h2>
        <p>
          本平台仅使用必要的会话 Cookie（用于保持登录）。不使用第三方追踪 / 广告 Cookie。
        </p>

        <h2>联系与权利</h2>
        <p>
          你有权随时要求导出或删除账户数据。请发邮件至 <a href="mailto:privacy@opscapital.com">privacy@opscapital.com</a>。
        </p>
      </article>
      </div>
    </div>
  );
}
