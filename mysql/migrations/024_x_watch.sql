-- X 账号监听 · Serenity(@aleabitoreddit) 等新帖解读与回复草稿
create table if not exists x_watch_state (
  source_username varchar(64)  not null primary key,
  x_user_id         varchar(32)  null,
  last_tweet_id     varchar(32)  null,
  last_polled_at    datetime(3)  null,
  updated_at        datetime(3)  not null default current_timestamp(3) on update current_timestamp(3)
);

create table if not exists x_watch_items (
  id                   char(36)     not null primary key,
  source_username      varchar(64)  not null,
  tweet_id             varchar(32)  not null,
  tweet_text           text         not null,
  tweet_url            varchar(512) not null,
  posted_at            datetime(3)  not null,
  topic_type           varchar(32)  null,
  tickers_json         json         null,
  summary_md           text         null,
  ops_angle_md         text         null,
  reply_draft          text         null,
  status               enum('pending','posted','skipped') not null default 'pending',
  posted_reply_tweet_id varchar(32) null,
  posted_reply_at      datetime(3)  null,
  analyzed_at          datetime(3)  null,
  created_at           datetime(3)  not null default current_timestamp(3),
  updated_at           datetime(3)  not null default current_timestamp(3) on update current_timestamp(3),
  unique key uk_x_watch_tweet (tweet_id),
  key idx_x_watch_status_posted (status, posted_at desc),
  key idx_x_watch_source (source_username, posted_at desc)
);
