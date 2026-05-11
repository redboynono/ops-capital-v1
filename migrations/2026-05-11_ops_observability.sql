-- =============================================================
-- ops observability — job_runs + events
-- 2026-05-11
-- =============================================================

-- 每个 cron / 后台任务的一次运行
create table if not exists job_runs (
  id              varchar(36) primary key,
  job_name        varchar(64) not null,             -- 'daily-news' / 'daily-content' / ...
  started_at      datetime    not null,
  finished_at     datetime    null,
  status          enum('running','ok','failed','partial') not null default 'running',
  items_total     int unsigned null,                -- 总处理数（可选）
  items_ok        int unsigned null,
  items_failed    int unsigned null,
  duration_ms     int unsigned null,                -- finished_at - started_at
  error_message   varchar(1000) null,
  meta_json       json null,                        -- 自由附加（如 tickers 列表）
  host            varchar(64) null,                 -- 跑在哪台机器 / 容器
  created_at      timestamp default current_timestamp,
  key idx_job_name_started (job_name, started_at desc),
  key idx_status (status, started_at desc)
) engine=InnoDB default charset=utf8mb4;

-- 轻量行为事件（不存隐私 / 用 hash userId 即可）
create table if not exists events (
  id              bigint unsigned primary key auto_increment,
  ts              datetime    not null default current_timestamp,
  event_type      varchar(48) not null,             -- 'ai_query' / 'watchlist_add' / 'position_add' / 'alert_trigger' / 'briefing_view' / 'page_view' / ...
  user_id         varchar(36) null,                 -- 可空（匿名）
  symbol          varchar(32) null,                 -- 关联标的（可选）
  meta_json       json null,                        -- 自由附加
  key idx_ts (ts),
  key idx_type_ts (event_type, ts),
  key idx_user_ts (user_id, ts),
  key idx_symbol_ts (symbol, ts)
) engine=InnoDB default charset=utf8mb4;
