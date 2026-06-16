-- 邮箱留资（免费每日简报订阅）。把一次性社媒流量转成可反复触达的列表。
-- 幂等：email 唯一；重复订阅只更新来源/状态。

create table if not exists email_subscribers (
  id                bigint unsigned primary key auto_increment,
  email             varchar(255) not null,
  locale            varchar(8)   not null default 'zh',     -- 'zh' / 'en'
  source            varchar(48)  null,                      -- 'paywall' / 'pricing' / 'home' ...
  utm_source        varchar(48)  null,                      -- 首触渠道
  user_id           varchar(36)  null,                      -- 若已是注册用户则关联
  status            varchar(16)  not null default 'active', -- 'active' / 'unsubscribed'
  unsubscribe_token varchar(40)  not null,                  -- 退订链接 token
  created_at        datetime     not null default current_timestamp,
  updated_at        datetime     not null default current_timestamp on update current_timestamp,
  unique key uk_email (email),
  key idx_status (status),
  key idx_created (created_at)
) engine=InnoDB default charset=utf8mb4;
