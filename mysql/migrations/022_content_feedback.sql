-- 内容有用度反馈（👍/👎）
create table if not exists content_feedback (
  id          char(36)     not null primary key,
  ref_type    enum('post','pick') not null,
  ref_key     varchar(255) not null,
  helpful     tinyint(1)   not null,
  actor_key   varchar(64)  not null,
  actor_kind  enum('user','visitor') not null,
  created_at  datetime(3)  not null default current_timestamp(3),
  updated_at  datetime(3)  not null default current_timestamp(3) on update current_timestamp(3),
  unique key uk_content_feedback_actor (ref_type, ref_key, actor_key),
  key idx_content_feedback_ref (ref_type, ref_key)
);
