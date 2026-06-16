-- OPS Alpha · 加密原生因子模型（docs/crypto-factor-model.md）
-- 1) tickers.asset_class：股票/加密评分分流的唯一开关
-- 2) tickers.coingecko_id：库内短码 BTC → coingecko id bitcoin
-- 3) ticker_factor_grades.factor enum 扩展 5 个加密因子（MOMENTUM 跨类别复用）
-- 幂等：用 information_schema 判断后再 alter。

-- tickers.asset_class
set @c := (select count(*) from information_schema.columns
  where table_schema = database() and table_name = 'tickers' and column_name = 'asset_class');
set @sql := if(@c = 0,
  'alter table tickers add column asset_class enum(''equity'',''crypto'',''etf'') not null default ''equity'' after exchange',
  'select ''asset_class exists'' as msg');
prepare s from @sql; execute s; deallocate prepare s;

-- tickers.coingecko_id
set @c := (select count(*) from information_schema.columns
  where table_schema = database() and table_name = 'tickers' and column_name = 'coingecko_id');
set @sql := if(@c = 0,
  'alter table tickers add column coingecko_id varchar(64) null after asset_class',
  'select ''coingecko_id exists'' as msg');
prepare s from @sql; execute s; deallocate prepare s;

-- 既有 CRYPTO 交易所标的归类 + coingecko id 映射
update tickers set asset_class = 'crypto' where exchange = 'CRYPTO';
update tickers set coingecko_id = 'bitcoin'     where symbol = 'BTC'  and coingecko_id is null;
update tickers set coingecko_id = 'ethereum'    where symbol = 'ETH'  and coingecko_id is null;
update tickers set coingecko_id = 'solana'      where symbol = 'SOL'  and coingecko_id is null;
update tickers set coingecko_id = 'binancecoin' where symbol = 'BNB'  and coingecko_id is null;
update tickers set coingecko_id = 'ripple'      where symbol = 'XRP'  and coingecko_id is null;
update tickers set coingecko_id = 'dogecoin'    where symbol = 'DOGE' and coingecko_id is null;

-- factor enum 扩展（modify 幂等：重复执行结果一致）
alter table ticker_factor_grades
  modify factor enum(
    'VALUATION','GROWTH','PROFITABILITY','MOMENTUM','REVISIONS',
    'DIV_SAFETY','DIV_GROWTH','DIV_YIELD','DIV_CONSISTENCY',
    'CRYPTO_VALUATION','NETWORK','TOKENOMICS','LIQUIDITY','SECURITY'
  ) not null;

-- 注：ticker_factor_grades_history.factor 为 varchar(24)，新因子 key 最长 16 字符，无需改动。
