-- 009: 短信验证码登录支持 —— 给 users 表加 phone / username / 姓名拆分字段
-- 注意：现有 users 行的 password_hash 仍保留（兼容老的密码登录）；
--      新流程注册的用户会用占位 hash + phone，登录走短信。

alter table users
  add column username     varchar(64)  null after email,
  add column first_name   varchar(64)  null after username,
  add column last_name    varchar(64)  null after first_name,
  add column country_code varchar(8)   null after last_name,
  add column phone        varchar(32)  null after country_code;

-- 唯一性：同一国家区号 + 手机号 不允许重复（NULL 不参与唯一约束，老用户不受影响）
alter table users
  add unique key uniq_users_phone (country_code, phone);

-- 用户名也唯一（NULL 不算）
alter table users
  add unique key uniq_users_username (username);

-- password_hash 改为允许 null（passwordless 注册用）
alter table users
  modify column password_hash text null;
