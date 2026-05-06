-- Migration 010 · earnings releases tracking
-- ----------------------------------------------------------------------
-- 记录每只覆盖标的的财报发布事件 + 与之关联的 AI 深度文章
-- 触发条件：cron 拉取 Finnhub /calendar/earnings，eps_actual 非空 = 真正释放
-- 唯一性：同一标的一个财季只产出一条记录与一篇文章
-- ----------------------------------------------------------------------

create table if not exists earnings_releases (
  id char(36) primary key,
  symbol varchar(32) not null,
  fiscal_year smallint not null,
  fiscal_quarter tinyint not null,
  report_date date not null,
  hour varchar(8) null,                 -- 'bmo' / 'amc' / 'dmh' / null
  eps_actual decimal(12,4) null,
  eps_estimate decimal(12,4) null,
  revenue_actual bigint null,           -- 美元（不是美分）
  revenue_estimate bigint null,
  post_id char(36) null,                -- 关联 AI 生成的深度文章
  generation_attempts tinyint not null default 0,
  last_error text null,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp,
  unique key uk_symbol_period (symbol, fiscal_year, fiscal_quarter),
  key idx_symbol_date (symbol, report_date desc),
  key idx_unfilled_post (post_id, generation_attempts),
  constraint fk_earnings_post foreign key (post_id) references posts(id) on delete set null,
  constraint fk_earnings_ticker foreign key (symbol) references tickers(symbol) on delete cascade
);
