-- Ops Alpha · 完整初始化 schema（单库 ops_alpha）
-- 面向全新数据库。如在已有库增量，请使用 mysql/migrations/ 下的迁移脚本。

create table if not exists users (
  id char(36) primary key,
  email varchar(255) not null unique,
  password_hash text not null,
  full_name varchar(255) null,
  password_reset_token_hash varchar(64) null,
  password_reset_expires_at datetime null,
  subscription_status enum('inactive','active') not null default 'inactive',
  subscription_end_date datetime null,
  created_at datetime not null default current_timestamp
);

create table if not exists posts (
  id char(36) primary key,
  title text not null,
  slug varchar(255) not null unique,
  kind enum('analysis','news') not null default 'analysis',
  excerpt text not null,
  content longtext not null,
  is_premium boolean not null default true,
  is_published boolean not null default false,
  created_at datetime not null default current_timestamp,
  author_id char(36) null,
  key idx_posts_kind_created (kind, is_published, created_at),
  constraint fk_posts_author foreign key (author_id) references users(id) on delete set null
);

create table if not exists tickers (
  symbol varchar(32) primary key,
  name varchar(255) not null,
  exchange enum('NASDAQ','NYSE','HKEX','SSE','SZSE','CRYPTO','OTHER') not null default 'OTHER',
  sector varchar(64) null,
  updated_at datetime not null default current_timestamp on update current_timestamp
);

create table if not exists post_tickers (
  post_id char(36) not null,
  symbol varchar(32) not null,
  primary key (post_id, symbol),
  key idx_post_tickers_symbol (symbol),
  constraint fk_post_tickers_post foreign key (post_id) references posts(id) on delete cascade,
  constraint fk_post_tickers_ticker foreign key (symbol) references tickers(symbol) on delete cascade
);

create table if not exists watchlist (
  user_id char(36) not null,
  symbol varchar(32) not null,
  created_at datetime not null default current_timestamp,
  primary key (user_id, symbol),
  key idx_watchlist_user_created (user_id, created_at),
  constraint fk_watchlist_user foreign key (user_id) references users(id) on delete cascade,
  constraint fk_watchlist_ticker foreign key (symbol) references tickers(symbol) on delete cascade
);

create table if not exists bookmarks (
  user_id char(36) not null,
  post_id char(36) not null,
  created_at datetime not null default current_timestamp,
  primary key (user_id, post_id),
  key idx_bookmarks_user_created (user_id, created_at),
  constraint fk_bookmarks_user foreign key (user_id) references users(id) on delete cascade,
  constraint fk_bookmarks_post foreign key (post_id) references posts(id) on delete cascade
);

-- 初始 ticker 种子数据
insert ignore into tickers (symbol, name, exchange, sector) values
  ('NVDA','英伟达 NVIDIA','NASDAQ','Semiconductors'),
  ('TSLA','特斯拉 Tesla','NASDAQ','Auto'),
  ('AAPL','苹果 Apple','NASDAQ','Consumer Tech'),
  ('MSFT','微软 Microsoft','NASDAQ','Software'),
  ('GOOGL','谷歌 Alphabet','NASDAQ','Internet'),
  ('META','Meta Platforms','NASDAQ','Internet'),
  ('AMZN','亚马逊 Amazon','NASDAQ','E-commerce'),
  ('AMD','超威 AMD','NASDAQ','Semiconductors'),
  ('TSM','台积电 TSMC','NYSE','Semiconductors'),
  ('AVGO','博通 Broadcom','NASDAQ','Semiconductors'),
  ('NFLX','奈飞 Netflix','NASDAQ','Media'),
  ('CRM','Salesforce','NYSE','Software'),
  ('ORCL','甲骨文 Oracle','NYSE','Software'),
  ('BABA','阿里巴巴 Alibaba','NYSE','Internet'),
  ('PDD','拼多多 PDD','NASDAQ','E-commerce'),
  ('JD','京东 JD.com','NASDAQ','E-commerce'),
  ('BIDU','百度 Baidu','NASDAQ','Internet'),
  ('TCEHY','腾讯 Tencent','OTHER','Internet'),
  ('NIO','蔚来 NIO','NYSE','Auto'),
  ('LI','理想 Li Auto','NASDAQ','Auto'),
  ('XPEV','小鹏 XPeng','NYSE','Auto'),
  ('BTC','Bitcoin','CRYPTO','Crypto'),
  ('ETH','Ethereum','CRYPTO','Crypto'),
  ('SOL','Solana','CRYPTO','Crypto'),
  ('00700','腾讯控股','HKEX','Internet'),
  ('09988','阿里巴巴 H','HKEX','Internet'),
  ('03690','美团','HKEX','Internet');

-- OPS Rating · 评分系统（Seeking Alpha Ratings Summary / Factor Grades / Quant Ranking 对标）
create table if not exists ticker_ratings (
  symbol varchar(32) primary key,
  ops_verdict enum('STRONG_BUY','BUY','HOLD','SELL','STRONG_SELL') null,
  ops_score decimal(3,2) null,
  ops_target_price decimal(14,4) null,
  street_verdict enum('STRONG_BUY','BUY','HOLD','SELL','STRONG_SELL') null,
  street_score decimal(3,2) null,
  street_target_price decimal(14,4) null,
  street_analyst_count int null,
  quant_score decimal(3,2) null,
  rank_overall int null,
  rank_overall_total int null,
  rank_sector int null,
  rank_sector_total int null,
  rank_industry int null,
  rank_industry_total int null,
  industry varchar(128) null,
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

create table if not exists reading_history (
  user_id char(36) not null,
  post_id char(36) not null,
  read_at datetime not null default current_timestamp,
  primary key (user_id, post_id),
  key idx_history_user_read_at (user_id, read_at),
  constraint fk_history_user foreign key (user_id) references users(id) on delete cascade,
  constraint fk_history_post foreign key (post_id) references posts(id) on delete cascade
);
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
-- OPS Alpha · Payments
-- 1) 移除 Stripe 相关字段（本项目从未实际接入 Stripe，只有占位）
-- 2) 新建 orders 表：支持支付宝 / 微信 Native 预付费买断模型

alter table users drop column if exists stripe_customer_id;

create table if not exists orders (
  id            char(36)     primary key,
  out_trade_no  varchar(64)  not null unique,       -- 业务订单号：OPS + ts + rand
  user_id       char(36)     not null,
  pay_channel   enum('alipay','wechat','lemon') not null,
  plan_id       varchar(32)  not null,              -- month / year 等，由 plans.ts 定义
  amount        int unsigned not null,              -- 金额（分）
  duration_months int unsigned not null,            -- 购买月份数
  status        enum('pending','paid','failed') not null default 'pending',

  -- 网关返回信息（用于审计与退款）
  gateway_trade_no varchar(128) null,               -- alipay.trade_no / wechat.transaction_id
  gateway_payload  text         null,               -- 最近一次回调/查询原始 JSON

  created_at    datetime     not null default current_timestamp,
  paid_at       datetime     null,
  updated_at    datetime     not null default current_timestamp on update current_timestamp,

  key idx_orders_user (user_id, created_at desc),
  key idx_orders_status (status),
  constraint fk_orders_user foreign key (user_id) references users(id) on delete cascade
);
