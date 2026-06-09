-- OPS Alpha · Stripe 订阅（自动续费 + 免费试用）
-- users 增加 Stripe 订阅关联字段 + 试用标记。
-- 幂等：用 information_schema 判断列是否已存在再 add（MySQL 8 不支持 add column if not exists）。

-- stripe_customer_id
set @c := (select count(*) from information_schema.columns
  where table_schema = database() and table_name = 'users' and column_name = 'stripe_customer_id');
set @sql := if(@c = 0,
  'alter table users add column stripe_customer_id varchar(64) null after subscription_end_date',
  'select ''stripe_customer_id exists'' as msg');
prepare s from @sql; execute s; deallocate prepare s;

-- stripe_subscription_id
set @c := (select count(*) from information_schema.columns
  where table_schema = database() and table_name = 'users' and column_name = 'stripe_subscription_id');
set @sql := if(@c = 0,
  'alter table users add column stripe_subscription_id varchar(64) null after stripe_customer_id',
  'select ''stripe_subscription_id exists'' as msg');
prepare s from @sql; execute s; deallocate prepare s;

-- trial_used（是否用过免费试用，防止重复领取）
set @c := (select count(*) from information_schema.columns
  where table_schema = database() and table_name = 'users' and column_name = 'trial_used');
set @sql := if(@c = 0,
  'alter table users add column trial_used tinyint(1) not null default 0 after stripe_subscription_id',
  'select ''trial_used exists'' as msg');
prepare s from @sql; execute s; deallocate prepare s;

-- 索引：webhook 按 customer / subscription 反查用户
set @c := (select count(*) from information_schema.statistics
  where table_schema = database() and table_name = 'users' and index_name = 'idx_users_stripe_customer');
set @sql := if(@c = 0,
  'create index idx_users_stripe_customer on users (stripe_customer_id)',
  'select ''idx exists'' as msg');
prepare s from @sql; execute s; deallocate prepare s;

set @c := (select count(*) from information_schema.statistics
  where table_schema = database() and table_name = 'users' and index_name = 'idx_users_stripe_subscription');
set @sql := if(@c = 0,
  'create index idx_users_stripe_subscription on users (stripe_subscription_id)',
  'select ''idx exists'' as msg');
prepare s from @sql; execute s; deallocate prepare s;
