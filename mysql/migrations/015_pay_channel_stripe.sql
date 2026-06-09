-- OPS Alpha · orders.pay_channel 支持 Stripe Checkout

alter table orders
  modify column pay_channel enum('alipay','wechat','gumroad','stripe') not null;
