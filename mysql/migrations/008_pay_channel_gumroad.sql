-- OPS Alpha · 支付通道从 LemonSqueezy 切到 Gumroad
-- LemonSqueezy 不支持中国大陆卖家（onboarding 国家列表无 China），换用 Gumroad
alter table orders
  modify column pay_channel enum('alipay','wechat','gumroad') not null;
