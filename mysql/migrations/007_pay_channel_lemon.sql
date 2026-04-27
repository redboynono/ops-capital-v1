-- OPS Alpha · 扩展 orders.pay_channel 支持 LemonSqueezy 主通道
-- alipay / wechat 保留：后续备案 / 商户号到位时可直接启用
alter table orders
  modify column pay_channel enum('alipay','wechat','lemon') not null;
