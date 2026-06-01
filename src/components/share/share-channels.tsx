"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Link2, Share2, Smartphone } from "lucide-react";
import {
  buildShareBundle,
  isMobileDevice,
  isWeChatBrowser,
  type ShareInput,
} from "@/lib/share/payload";

type Props = {
  url: string;
  data: ShareInput;
};

function ChannelButton({
  label,
  sublabel,
  onClick,
  active,
  accent,
  children,
}: {
  label: string;
  sublabel?: string;
  onClick: () => void;
  active?: boolean;
  accent?: "wechat" | "xhs" | "neutral";
  children: ReactNode;
}) {
  const ring =
    accent === "wechat"
      ? "hover:border-[#07c160]"
      : accent === "xhs"
        ? "hover:border-[#ff2442]"
        : "hover:border-accent";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-sm border border-border bg-surface-muted px-1 py-2 transition ${ring} ${
        active ? "border-accent bg-accent-soft" : ""
      }`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface">{children}</span>
      <span className="text-[11px] font-semibold text-foreground">{label}</span>
      {sublabel ? <span className="text-[9px] text-muted">{sublabel}</span> : null}
    </button>
  );
}

function WechatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#07c160"
        d="M8.5 4C4.9 4 2 6.4 2 9.3c0 1.5.8 2.9 2.1 3.9L3 17l3.4-1.1c.9.3 1.9.4 2.9.4 3.6 0 6.5-2.4 6.5-5.3S12.1 4 8.5 4zm-2.2 3.1c-.6 0-1.1-.5-1.1-1.1s.5-1.1 1.1-1.1 1.1.5 1.1 1.1-.5 1.1-1.1 1.1zm4.4 0c-.6 0-1.1-.5-1.1-1.1s.5-1.1 1.1-1.1 1.1.5 1.1 1.1-.5 1.1-1.1 1.1z"
      />
      <path
        fill="#07c160"
        d="M15.5 7c-3.1 0-5.5 2.1-5.5 4.7 0 2.5 2.4 4.6 5.5 4.6.9 0 1.7-.2 2.5-.5l2.5.8-.7-2.3c1-.8 1.6-1.9 1.6-3.1C21 9.1 18.6 7 15.5 7zm-1.8 2.5c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9zm3.6 0c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9z"
      />
    </svg>
  );
}

function XiaohongshuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#ff2442" />
      <text x="12" y="16" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">
        小红书
      </text>
    </svg>
  );
}

export function ShareChannels({ url, data }: Props) {
  const bundle = useMemo(() => buildShareBundle(data, url), [data, url]);
  const [hint, setHint] = useState<string | null>(null);
  const [showWechatQr, setShowWechatQr] = useState(false);
  const inWeChat = isWeChatBrowser();

  const flash = useCallback((msg: string) => {
    setHint(msg);
    window.setTimeout(() => setHint(null), 2800);
  }, []);

  const copyText = useCallback(
    async (text: string, okMsg: string) => {
      try {
        await navigator.clipboard.writeText(text);
        flash(okMsg);
        return true;
      } catch {
        flash("复制失败，请长按链接手动复制");
        return false;
      }
    },
    [flash],
  );

  const onWechat = useCallback(async () => {
    await copyText(bundle.wechatText, inWeChat ? "文案已复制" : "文案已复制");
    if (inWeChat) {
      flash("请点击右上角 ··· → 转发给朋友或朋友圈");
      return;
    }
    if (isMobileDevice()) {
      flash("文案已复制 · 打开微信粘贴发送，或扫码打开");
    }
    setShowWechatQr(true);
  }, [bundle.wechatText, copyText, flash, inWeChat]);

  const onXiaohongshu = useCallback(async () => {
    await copyText(
      bundle.xiaohongshuText,
      "小红书文案已复制 · 打开 App 粘贴发布，或用下方图集",
    );
  }, [bundle.xiaohongshuText, copyText]);

  const onCopyLink = useCallback(async () => {
    await copyText(bundle.url, "链接已复制");
  }, [bundle.url, copyText]);

  const onCopyAll = useCallback(async () => {
    await copyText(bundle.plainText, "全文摘要已复制");
  }, [bundle.plainText, copyText]);

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const onNativeShare = useCallback(async () => {
    if (!canNativeShare) {
      await onCopyAll();
      return;
    }
    try {
      await navigator.share({
        title: bundle.title,
        text: bundle.subtitle,
        url: bundle.url,
      });
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") await onCopyAll();
    }
  }, [bundle, canNativeShare, onCopyAll]);

  return (
    <div className="border-b border-border px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-foreground">分享到</p>
        {hint ? (
          <p className="flex items-center gap-1 text-[10px] text-[color:var(--success)]">
            <Check size={12} />
            {hint}
          </p>
        ) : null}
      </div>

      <div className="mt-2 grid grid-cols-4 gap-2">
        <ChannelButton label="微信" sublabel={inWeChat ? "转发" : "扫码"} accent="wechat" onClick={onWechat}>
          <WechatIcon />
        </ChannelButton>
        <ChannelButton label="小红书" sublabel="复制文案" accent="xhs" onClick={onXiaohongshu}>
          <XiaohongshuIcon />
        </ChannelButton>
        <ChannelButton label="复制链接" onClick={onCopyLink}>
          <Link2 size={18} className="text-muted" />
        </ChannelButton>
        <ChannelButton
          label={canNativeShare ? "更多" : "复制全文"}
          onClick={onNativeShare}
        >
          {canNativeShare ? (
            <Share2 size={18} className="text-muted" />
          ) : (
            <Copy size={18} className="text-muted" />
          )}
        </ChannelButton>
      </div>

      {showWechatQr && !inWeChat ? (
        <div className="mt-3 rounded-sm border border-border bg-surface-muted p-3">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-sm bg-white p-2">
              <QRCodeSVG value={bundle.url} size={112} level="M" includeMargin />
            </div>
            <div className="min-w-0 flex-1 text-[11px] leading-relaxed text-muted">
              <p className="flex items-center gap-1 font-semibold text-foreground">
                <Smartphone size={12} />
                微信扫码打开
              </p>
              <p className="mt-1 break-all font-mono text-[10px] text-foreground-soft">{bundle.url}</p>
              <p className="mt-2">好友在聊天中扫码即可阅读；文案已复制，可粘贴到会话里。</p>
              <button
                type="button"
                onClick={() => setShowWechatQr(false)}
                className="mt-2 text-[10px] text-accent-strong hover:underline"
              >
                收起二维码
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
