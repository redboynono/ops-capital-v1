-- Migration 012 · ratings history snapshot
-- 评级周期性刷新：每次 AI 生成（手动 or cron）都往 history 表 append 一行
-- 之后 grade_3m / grade_6m 不再由 AI 凭空编，而是从 history 回看 ~90 / ~180 天前的真实快照

create table if not exists ticker_ratings_history (
  id            char(36) primary key,
  symbol        varchar(16) not null,
  ops_verdict   enum('STRONG_BUY','BUY','HOLD','SELL','STRONG_SELL') null,
  ops_score     decimal(4,2) null,
  ops_target_price decimal(16,4) null,
  street_verdict enum('STRONG_BUY','BUY','HOLD','SELL','STRONG_SELL') null,
  street_score  decimal(4,2) null,
  street_target_price decimal(16,4) null,
  quant_score   decimal(4,2) null,
  rank_overall  int null,
  rank_sector   int null,
  rank_industry int null,
  industry      varchar(120) null,
  notes         text null,
  source        enum('MANUAL','AI','CRON','HYBRID','EXTERNAL') not null default 'AI',
  captured_at   datetime(3) not null default current_timestamp(3),
  key idx_rh_symbol_time (symbol, captured_at desc)
);

create table if not exists ticker_factor_grades_history (
  id          char(36) primary key,
  symbol      varchar(16) not null,
  factor      varchar(24) not null,
  grade       varchar(4) not null,
  captured_at datetime(3) not null default current_timestamp(3),
  key idx_fgh_symbol_factor_time (symbol, factor, captured_at desc)
);

-- 记录 ticker_ratings 上次刷新来源（AI / CRON / MANUAL）
alter table ticker_ratings
  add column last_refreshed_at datetime(3) null after updated_at;
