-- AI 周选（Weekly Signals）· Research Pro 专属
create table if not exists ai_signal_editions (
  id            char(36)     not null primary key,
  edition_date  date         not null,
  cadence       enum('weekly') not null default 'weekly',
  status        enum('draft','published') not null default 'draft',
  summary_md    text         null,
  published_at  datetime(3)  null,
  email_sent_at datetime(3)  null,
  created_at    datetime(3)  not null default current_timestamp(3),
  updated_at    datetime(3)  not null default current_timestamp(3) on update current_timestamp(3),
  unique key uk_ai_signal_edition_date (edition_date),
  key idx_ai_signal_edition_status (status, edition_date desc)
);

create table if not exists ai_signals (
  id                   char(36)     not null primary key,
  edition_id           char(36)     not null,
  rank_no              int unsigned not null,
  ticker_symbol        varchar(32)  not null,
  ticker_name          varchar(255) null,
  ops_verdict          varchar(16)  null,
  ops_score            decimal(4,2) null,
  ai_score             tinyint unsigned null,
  conviction           enum('high','medium','low') not null default 'medium',
  headline             varchar(255) not null,
  reason_teaser        varchar(320) not null,
  reason_md            text         not null,
  entry_price          decimal(14,4) null,
  target_price         decimal(14,4) null,
  stop_price           decimal(14,4) null,
  source_snapshot_json json         null,
  created_at           datetime(3)  not null default current_timestamp(3),
  key idx_ai_signals_edition (edition_id, rank_no),
  key idx_ai_signals_symbol (ticker_symbol),
  constraint fk_ai_signals_edition foreign key (edition_id) references ai_signal_editions(id) on delete cascade
);
