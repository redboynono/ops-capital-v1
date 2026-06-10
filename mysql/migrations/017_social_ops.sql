-- OPS Alpha · 社媒运营工作台（草稿 + 发布记录）

create table if not exists social_ops_posts (
  id              char(36)     not null primary key,
  content_type    enum('analysis','news','rating_change','value_chain','custom') not null,
  ref_key         varchar(128) null,
  title           varchar(512) not null,
  canonical_url   varchar(1024) not null,
  x_copy          text         not null,
  xhs_copy        text         not null,
  utm_campaign    varchar(64)  null,
  status          enum('draft','posted_x','posted_xhs','done') not null default 'draft',
  notes           text         null,
  posted_x_at     datetime(3)  null,
  posted_xhs_at   datetime(3)  null,
  created_by      varchar(255) null,
  created_at      datetime(3)  not null default current_timestamp(3),
  updated_at      datetime(3)  not null default current_timestamp(3) on update current_timestamp(3),
  key idx_social_ops_status (status, updated_at desc),
  key idx_social_ops_ref (content_type, ref_key)
);
