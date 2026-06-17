-- Chokepoint Brief 入门档（$2.99/月）：仅解锁 chokepoint-* 深度研报
alter table users
  add column entitlement_brief tinyint not null default 0 after entitlement_research;
