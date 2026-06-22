alter table x_watch_items
  add column reply_quality_score tinyint unsigned null after reply_draft_zh,
  add column auto_post_skip_reason varchar(128) null after last_post_error,
  add column reply_impressions int unsigned null after auto_post_skip_reason,
  add column reply_likes int unsigned null after reply_impressions,
  add column reply_retweets int unsigned null after reply_likes,
  add column metrics_synced_at datetime(3) null after reply_retweets;
