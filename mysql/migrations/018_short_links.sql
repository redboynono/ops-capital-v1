-- OPS Alpha · 社媒短链接（跳转 + UTM 归因）

create table if not exists short_links (
  code          varchar(12)   not null primary key,
  target_url    varchar(2048) not null,
  utm_source    varchar(32)   null,
  utm_medium    varchar(32)   null,
  utm_campaign  varchar(64)   null,
  ref_key       varchar(128)  null,
  clicks        int unsigned  not null default 0,
  created_at    datetime(3)   not null default current_timestamp(3),
  unique key uk_short_target (target_url(512)),
  key idx_short_ref (ref_key)
);
