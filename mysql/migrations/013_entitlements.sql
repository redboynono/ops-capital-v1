-- 分产品线权益：Research Pro / Option Alpha / Bundle
alter table users
  add column entitlement_research tinyint not null default 0 after subscription_end_date,
  add column entitlement_options tinyint not null default 0 after entitlement_research;

-- 历史 active 会员视为 Bundle（两条权益都开）
update users
   set entitlement_research = 1,
       entitlement_options = 1
 where subscription_status = 'active'
   and (subscription_end_date is null or subscription_end_date > now());
