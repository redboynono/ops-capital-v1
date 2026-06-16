-- 018: 扩充加密标的至 9 个（与 symbol-resolve.ts CRYPTO_SHORTS 同步）
-- 幂等：insert ignore + 二次 update 补 asset_class / coingecko_id。

insert ignore into tickers (symbol, name, exchange, sector, asset_class, coingecko_id) values
  ('BNB',  'BNB',       'CRYPTO', 'Crypto', 'crypto', 'binancecoin'),
  ('XRP',  'XRP',       'CRYPTO', 'Crypto', 'crypto', 'ripple'),
  ('DOGE', 'Dogecoin',  'CRYPTO', 'Crypto', 'crypto', 'dogecoin'),
  ('ADA',  'Cardano',   'CRYPTO', 'Crypto', 'crypto', 'cardano'),
  ('AVAX', 'Avalanche', 'CRYPTO', 'Crypto', 'crypto', 'avalanche-2'),
  ('LINK', 'Chainlink', 'CRYPTO', 'Crypto', 'crypto', 'chainlink');

-- 若标的已存在（如此前作为普通 ticker 录入），补齐分类与映射
update tickers set exchange = 'CRYPTO', sector = 'Crypto', asset_class = 'crypto',
  coingecko_id = case symbol
    when 'BNB'  then 'binancecoin'
    when 'XRP'  then 'ripple'
    when 'DOGE' then 'dogecoin'
    when 'ADA'  then 'cardano'
    when 'AVAX' then 'avalanche-2'
    when 'LINK' then 'chainlink'
  end
where symbol in ('BNB','XRP','DOGE','ADA','AVAX','LINK');
