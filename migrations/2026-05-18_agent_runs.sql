-- =============================================================
-- Agents · 用户运行的 Agent 记录（既是审计也是"文档架"）
-- 2026-05-18
-- =============================================================

create table if not exists agent_runs (
  id              varchar(36) primary key,
  user_id         varchar(36) not null,
  agent_id        varchar(64) not null,         -- 'dcf-valuation' / 'peer-comparison' / ...
  agent_name      varchar(128) not null,        -- 冗余存名字，方便历史显示（哪怕之后改名）
  input_kind      enum('ticker','post','freeform') not null,
  input_symbol    varchar(32) null,             -- input_kind='ticker' 时填
  input_slug      varchar(160) null,            -- input_kind='post' 时填
  input_query     varchar(500) null,            -- input_kind='freeform' 时填
  status          enum('running','ok','failed','cancelled') not null default 'running',
  output_md       mediumtext null,              -- 完整生成的 markdown
  context_len     int unsigned null,            -- 喂给 LLM 的 context 字符数（debug / 成本估算）
  output_len      int unsigned null,
  duration_ms     int unsigned null,
  error_message   varchar(1000) null,
  meta_json       json null,                    -- 自由附加（peer 列表 / 模型参数 等）
  started_at      datetime not null default current_timestamp,
  finished_at     datetime null,
  key idx_user_started (user_id, started_at desc),
  key idx_user_symbol (user_id, input_symbol, started_at desc),
  key idx_agent_started (agent_id, started_at desc),
  key idx_status (status, started_at desc)
) engine=InnoDB default charset=utf8mb4;
