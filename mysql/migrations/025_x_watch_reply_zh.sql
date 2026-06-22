-- 回复草稿中文对照
alter table x_watch_items
  add column reply_draft_zh text null after reply_draft;
