-- Ops Alpha · 完整初始化 schema（单库 ops_alpha）
-- 面向全新数据库。如在已有库增量，请使用 mysql/migrations/ 下的迁移脚本。

create table if not exists users (
  id char(36) primary key,
  email varchar(255) not null unique,
  password_hash text not null,
  full_name varchar(255) null,
  password_reset_token_hash varchar(64) null,
  password_reset_expires_at datetime null,
  stripe_customer_id varchar(255) null,
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
