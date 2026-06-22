alter table x_watch_items
  add column post_mode varchar(16) null after posted_reply_at,
  add column last_post_error varchar(512) null after post_mode;
