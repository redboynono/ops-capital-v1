-- Ops Alpha schema: add post kind + tickers + watchlist

-- 1. posts 新增 kind 字段（如已存在请忽略报错）
alter table posts
  add column kind enum('analysis','news') not null default 'analysis' after slug;
create index idx_posts_kind_created on posts (kind, is_published, created_at);

-- 2. tickers 字典
create table if not exists tickers (
  symbol varchar(32) primary key,
  name varchar(255) not null,
  exchange enum('NASDAQ','NYSE','HKEX','SSE','SZSE','CRYPTO','OTHER') not null default 'OTHER',
  sector varchar(64) null,
  updated_at datetime not null default current_timestamp on update current_timestamp
);

-- 3. post_tickers 多对多关系
create table if not exists post_tickers (
  post_id char(36) not null,
  symbol varchar(32) not null,
  primary key (post_id, symbol),
  key idx_post_tickers_symbol (symbol),
  constraint fk_post_tickers_post foreign key (post_id) references posts(id) on delete cascade,
  constraint fk_post_tickers_ticker foreign key (symbol) references tickers(symbol) on delete cascade
);

-- 4. watchlist 自选股
create table if not exists watchlist (
  user_id char(36) not null,
  symbol varchar(32) not null,
  created_at datetime not null default current_timestamp,
  primary key (user_id, symbol),
  key idx_watchlist_user_created (user_id, created_at),
  constraint fk_watchlist_user foreign key (user_id) references users(id) on delete cascade,
  constraint fk_watchlist_ticker foreign key (symbol) references tickers(symbol) on delete cascade
);

-- 5. 初始 ticker 种子数据（Top 科技 / 中概 / 加密）
insert ignore into tickers (symbol, name, exchange, sector) values
  ('NVDA',  '英伟达 NVIDIA',            'NASDAQ', 'Semiconductors'),
  ('TSLA',  '特斯拉 Tesla',             'NASDAQ', 'Auto'),
  ('AAPL',  '苹果 Apple',               'NASDAQ', 'Consumer Tech'),
  ('MSFT',  '微软 Microsoft',           'NASDAQ', 'Software'),
  ('GOOGL', '谷歌 Alphabet',            'NASDAQ', 'Internet'),
  ('META',  'Meta Platforms',          'NASDAQ', 'Internet'),
  ('AMZN',  '亚马逊 Amazon',            'NASDAQ', 'E-commerce'),
  ('AMD',   '超威 AMD',                 'NASDAQ', 'Semiconductors'),
  ('TSM',   '台积电 TSMC',              'NYSE',   'Semiconductors'),
  ('AVGO',  '博通 Broadcom',            'NASDAQ', 'Semiconductors'),
  ('NFLX',  '奈飞 Netflix',             'NASDAQ', 'Media'),
  ('CRM',   'Salesforce',              'NYSE',   'Software'),
  ('ORCL',  '甲骨文 Oracle',            'NYSE',   'Software'),
  ('BABA',  '阿里巴巴 Alibaba',         'NYSE',   'Internet'),
  ('PDD',   '拼多多 PDD',               'NASDAQ', 'E-commerce'),
  ('JD',    '京东 JD.com',              'NASDAQ', 'E-commerce'),
  ('BIDU',  '百度 Baidu',               'NASDAQ', 'Internet'),
  ('TCEHY', '腾讯 Tencent',             'OTHER',  'Internet'),
  ('NIO',   '蔚来 NIO',                 'NYSE',   'Auto'),
  ('LI',    '理想 Li Auto',             'NASDAQ', 'Auto'),
  ('XPEV',  '小鹏 XPeng',               'NYSE',   'Auto'),
  ('BTC',   'Bitcoin',                 'CRYPTO', 'Crypto'),
  ('ETH',   'Ethereum',                'CRYPTO', 'Crypto'),
  ('SOL',   'Solana',                  'CRYPTO', 'Crypto'),
  ('00700', '腾讯控股',                 'HKEX',   'Internet'),
  ('09988', '阿里巴巴 H',               'HKEX',   'Internet'),
  ('03690', '美团',                     'HKEX',   'Internet');
