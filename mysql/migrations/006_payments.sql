-- OPS Alpha · Payments
-- 1) 移除 Stripe 相关字段（本项目从未实际接入 Stripe，只有占位）
-- 2) 新建 orders 表：支持支付宝 / 微信 Native 预付费买断模型

-- 兼容 MySQL 8 早期版本（没有 "drop column if exists" 语法）
set @col_exists := (
  select count(*) from information_schema.columns
  where table_schema = database() and table_name = 'users' and column_name = 'stripe_customer_id'
);
set @drop_sql := if(@col_exists > 0,
  'alter table users drop column stripe_customer_id',
  'select ''stripe_customer_id already removed'' as msg'
);
prepare drop_stmt from @drop_sql;
execute drop_stmt;
deallocate prepare drop_stmt;

create table if not exists orders (
  id            char(36)     primary key,
  out_trade_no  varchar(64)  not null unique,       -- 业务订单号：OPS + ts + rand
  user_id       char(36)     not null,
  pay_channel   enum('alipay','wechat') not null,
  plan_id       varchar(32)  not null,              -- month / year 等，由 plans.ts 定义
  amount        int unsigned not null,              -- 金额（分）
  duration_months int unsigned not null,            -- 购买月份数
  status        enum('pending','paid','failed') not null default 'pending',

  -- 网关返回信息（用于审计与退款）
  gateway_trade_no varchar(128) null,               -- alipay.trade_no / wechat.transaction_id
  gateway_payload  text         null,               -- 最近一次回调/查询原始 JSON

  created_at    datetime     not null default current_timestamp,
  paid_at       datetime     null,
  updated_at    datetime     not null default current_timestamp on update current_timestamp,

  key idx_orders_user (user_id, created_at desc),
  key idx_orders_status (status),
  constraint fk_orders_user foreign key (user_id) references users(id) on delete cascade
);
