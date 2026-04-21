-- OPS Rating · 评分系统（对标 Seeking Alpha Ratings Summary / Factor Grades / Quant Ranking）

create table if not exists ticker_ratings (
  symbol varchar(32) primary key,

  -- OPS Desk (自营分析师/AI 打分)
  ops_verdict enum('STRONG_BUY','BUY','HOLD','SELL','STRONG_SELL') null,
  ops_score decimal(3,2) null,
  ops_target_price decimal(14,4) null,

  -- Street (卖方共识)
  street_verdict enum('STRONG_BUY','BUY','HOLD','SELL','STRONG_SELL') null,
  street_score decimal(3,2) null,
  street_target_price decimal(14,4) null,
  street_analyst_count int null,

  -- Quant (量化综合分)
  quant_score decimal(3,2) null,

  -- Quant Ranking
  rank_overall int null,
  rank_overall_total int null,
  rank_sector int null,
  rank_sector_total int null,
  rank_industry int null,
  rank_industry_total int null,
  industry varchar(128) null,

  -- meta
  has_dividend tinyint(1) not null default 0,
  notes text null,
  source enum('MANUAL','AI','HYBRID','EXTERNAL') not null default 'MANUAL',
  updated_at datetime not null default current_timestamp on update current_timestamp,

  constraint fk_rating_symbol foreign key (symbol) references tickers(symbol) on delete cascade
);

create table if not exists ticker_factor_grades (
  symbol varchar(32) not null,
  factor enum(
    'VALUATION','GROWTH','PROFITABILITY','MOMENTUM','REVISIONS',
    'DIV_SAFETY','DIV_GROWTH','DIV_YIELD','DIV_CONSISTENCY'
  ) not null,
  grade_now   varchar(3) null,
  grade_3m    varchar(3) null,
  grade_6m    varchar(3) null,
  updated_at datetime not null default current_timestamp on update current_timestamp,
  primary key (symbol, factor),
  constraint fk_fg_symbol foreign key (symbol) references tickers(symbol) on delete cascade
);
