-- Migration 011 · earnings article audit
-- 二次校验：每篇 AI 生成的财报文章，跑一次 fact-check pass
-- 把每个数字断言分类为 verified / inferred / unsupported

alter table earnings_releases
  add column audit_summary varchar(160) null after last_error,
  add column audit_json mediumtext null after audit_summary;
