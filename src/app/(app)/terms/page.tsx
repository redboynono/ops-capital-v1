export const metadata = { title: "服务条款 · OPS Alpha" };

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-8 md:px-6">
      <div className="reader-mode">
      <header className="mb-5 border-b border-[#d8d0c2] pb-3">
        <span className="label-caps">Terms</span>
        <h1 className="mt-1 text-2xl font-bold">服务条款</h1>
        <p className="mt-1 text-[11px]" style={{ color: "#6b5c3f" }}>最后更新：2026-04-01</p>
      </header>

      <article className="prose prose-sm max-w-none">
        <h2>1. 服务内容</h2>
        <p>
          OPS Alpha（“本平台”）由 OPS Capital 运营，提供 AI 辅助生成的中文投研内容、
          标的评级（OPS Rating）及行情聚合信息。
        </p>

        <h2>2. 非投资建议</h2>
        <p>
          本平台发布的所有分析、快讯、评级、目标价均为基于公开信息与模型推断的研究观点，
          <strong>不构成任何证券、基金、加密资产或衍生品的买卖建议</strong>。
          用户依据本平台内容做出的任何投资决策，风险由用户自行承担。
        </p>

        <h2>3. AI 生成内容免责</h2>
        <p>
          本平台大量内容由大语言模型（包括但不限于 MiniMax-M2、Gemini、GPT 系列）辅助生成，
          可能包含事实错误、过时数据或模型幻觉。请用户自行核实关键事实。
        </p>

        <h2>4. 订阅与付费</h2>
        <p>
          Premium 订阅按月 / 年计费。订阅期限内 Premium 内容完整可读。
          支付渠道、续费规则与退款政策将于支付功能上线后以补充条款形式披露。
        </p>

        <h2>5. 账户与数据</h2>
        <p>
          用户需自行保管账户密码。本平台使用 bcrypt 不可逆哈希存储密码，
          不会主动获取用户持仓或交易账户数据。
        </p>

        <h2>6. 内容版权</h2>
        <p>
          平台自有生成内容版权归 OPS Capital 所有。禁止未经授权的批量抓取、转载或商用。
        </p>

        <h2>7. 条款变更</h2>
        <p>
          本条款可能随服务演进进行更新，生效日期以本页顶部“最后更新”为准。重大变更将通过邮件或站内通知告知。
        </p>

        <h2>8. 联系</h2>
        <p>
          如有疑问，请联系 <a href="mailto:support@opscapital.com">support@opscapital.com</a>。
        </p>
      </article>
      </div>
    </div>
  );
}
