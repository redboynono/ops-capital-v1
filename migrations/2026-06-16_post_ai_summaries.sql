-- 付费墙「AI 一句话结论」缓存。按 post + 语言缓存，body_hash 变化时重新生成。
create table if not exists post_ai_summaries (
  post_id    varchar(36) not null,
  lang       varchar(8)  not null default 'zh',
  body_hash  char(40)    not null,                 -- sha1(正文)，正文变更即失效
  summary    varchar(500) not null,                -- 单句钩子，不含目标价/止损等被锁字段
  model      varchar(64)  null,
  created_at datetime     not null default current_timestamp,
  updated_at datetime     not null default current_timestamp on update current_timestamp,
  primary key (post_id, lang)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;
