-- 卡点 thread 独立 content_type，便于 admin/growth CTR 分桶
alter table social_ops_posts
  modify column content_type
    enum('analysis','chokepoint','news','rating_change','value_chain','custom') not null;
