-- OPS Picks · 月度精选荐股
-- 模仿 Seeking Alpha Alpha Picks：编辑严选 2-3 个月度标的，给出入场/目标/止损/逻辑/风险/退出纪律，追踪业绩。

create table if not exists ops_picks (
  id char(36) primary key,
  slug varchar(160) not null unique,
  ticker_symbol varchar(32) not null,
  ticker_name varchar(255) null,                 -- 冗余，展示用（避免 join）

  title varchar(255) not null,                    -- "NVDA · AI 基础设施的复利仓"
  subtitle varchar(255) null,                     -- "2026 年 Q2 · OPS 月度首选"

  thesis_md longtext not null,                    -- 投资逻辑 markdown（付费墙后）
  catalysts_md text null,                         -- 近期催化剂 markdown
  risks_md text null,                             -- 风险提示 markdown
  valuation_md text null,                         -- 估值分析 markdown
  sell_discipline_md text null,                   -- 退出纪律 markdown

  entry_price decimal(14,4) not null,
  entry_date date not null,
  target_price decimal(14,4) null,
  stop_price decimal(14,4) null,
  horizon_months int unsigned not null default 12,

  conviction enum('high','medium','low') not null default 'medium',
  tags varchar(255) null,                          -- 自由标签，逗号分隔

  status enum('open','closed','stopped') not null default 'open',
  close_price decimal(14,4) null,
  close_date date null,
  close_reason varchar(255) null,

  is_premium tinyint(1) not null default 1,        -- 深度 thesis / 目标价是否付费
  is_published tinyint(1) not null default 0,

  created_by char(36) null,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp,

  key idx_picks_status (status, is_published, entry_date),
  key idx_picks_ticker (ticker_symbol),
  key idx_picks_entry_date (entry_date desc),
  constraint fk_picks_ticker foreign key (ticker_symbol) references tickers(symbol) on delete cascade,
  constraint fk_picks_author foreign key (created_by) references users(id) on delete set null
);
