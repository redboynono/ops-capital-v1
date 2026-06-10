/**
 * 给 /admin/ops 用的所有聚合查询。
 * 每个函数返回纯数据；表格 / 卡片在 page.tsx 里渲染。
 *
 * 表来源：
 *   - job_runs / events                — 本次新增（observability）
 *   - users / watchlist / positions / alert_rules / daily_briefings  — 现有
 *   - tickers / ticker_ratings / posts / earnings_releases           — 内容侧
 */

import { mysqlQuery } from "@/lib/mysql";

// =================== KPI ===================

export type OpsKpi = {
  dau24h: number;          // 24h 内有事件的不重复 user_id
  signups7d: number;
  aiQueries24h: number;
  alertTriggers24h: number;
  cronFailures24h: number;
  briefingsSent7d: number;
};

export async function getKpi(): Promise<OpsKpi> {
  const [dau] = await mysqlQuery<{ n: number }[]>(
    `select count(distinct user_id) as n
       from events
      where user_id is not null
        and ts >= date_sub(current_timestamp, interval 24 hour)`,
  );
  const [signup] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from users where created_at >= date_sub(current_timestamp, interval 7 day)`,
  );
  const [ai] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from events where event_type='ai_query' and ts >= date_sub(current_timestamp, interval 24 hour)`,
  );
  const [trig] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from events where event_type='alert_trigger' and ts >= date_sub(current_timestamp, interval 24 hour)`,
  );
  const [fail] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from job_runs where status='failed' and started_at >= date_sub(current_timestamp, interval 24 hour)`,
  );
  const [brief] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from daily_briefings where email_sent_at >= date_sub(current_timestamp, interval 7 day)`,
  );
  return {
    dau24h: Number(dau?.n ?? 0),
    signups7d: Number(signup?.n ?? 0),
    aiQueries24h: Number(ai?.n ?? 0),
    alertTriggers24h: Number(trig?.n ?? 0),
    cronFailures24h: Number(fail?.n ?? 0),
    briefingsSent7d: Number(brief?.n ?? 0),
  };
}

// =================== Cron health ===================

export type CronJobHealth = {
  job_name: string;
  last_started_at: string | null;
  last_finished_at: string | null;
  status: "running" | "ok" | "failed" | "partial" | null;
  duration_ms: number | null;
  items_total: number | null;
  items_ok: number | null;
  items_failed: number | null;
  error_message: string | null;
  age_minutes: number | null; // 距离上次开始多久了
  runs_24h: number;
  fails_24h: number;
};

/** 每个 job 取最新一次 + 24h 统计。前端按 age_minutes 染色。 */
export async function getCronHealth(): Promise<CronJobHealth[]> {
  const rows = await mysqlQuery<
    Array<{
      job_name: string;
      last_started_at: Date | null;
      last_finished_at: Date | null;
      status: CronJobHealth["status"];
      duration_ms: number | null;
      items_total: number | null;
      items_ok: number | null;
      items_failed: number | null;
      error_message: string | null;
      runs_24h: string | number;
      fails_24h: string | number;
    }>
  >(
    `select latest.job_name,
            latest.started_at as last_started_at,
            latest.finished_at as last_finished_at,
            latest.status,
            latest.duration_ms,
            latest.items_total,
            latest.items_ok,
            latest.items_failed,
            latest.error_message,
            stats.runs_24h,
            stats.fails_24h
       from (
         select * from (
           select jr.*,
                  row_number() over (partition by job_name order by started_at desc) as rn
             from job_runs jr
         ) t where t.rn = 1
       ) latest
       left join (
         select job_name,
                count(*) as runs_24h,
                sum(case when status='failed' then 1 else 0 end) as fails_24h
           from job_runs
          where started_at >= date_sub(current_timestamp, interval 24 hour)
          group by job_name
       ) stats on stats.job_name = latest.job_name
      order by latest.job_name`,
  );

  const now = Date.now();
  return rows.map((r) => {
    const started = r.last_started_at ? new Date(r.last_started_at).getTime() : null;
    const ageMin = started ? Math.floor((now - started) / 60000) : null;
    return {
      job_name: r.job_name,
      last_started_at: r.last_started_at ? new Date(r.last_started_at).toISOString() : null,
      last_finished_at: r.last_finished_at ? new Date(r.last_finished_at).toISOString() : null,
      status: r.status,
      duration_ms: r.duration_ms,
      items_total: r.items_total,
      items_ok: r.items_ok,
      items_failed: r.items_failed,
      error_message: r.error_message,
      age_minutes: ageMin,
      runs_24h: Number(r.runs_24h ?? 0),
      fails_24h: Number(r.fails_24h ?? 0),
    };
  });
}

// =================== Data freshness ===================

export type DataFreshness = {
  tickers: { total: number; with_rating: number; coverage_pct: number };
  posts: { total: number; last24h: number; last7d: number; latest_at: string | null };
  earnings: { total: number; future30d: number; reported_no_post: number };
  ratings: { rated_count: number; updated_24h: number };
};

export async function getDataFreshness(): Promise<DataFreshness> {
  const [tickerCount] = await mysqlQuery<{ n: number }[]>(`select count(*) as n from tickers`);
  const [ratedCount] = await mysqlQuery<{ n: number }[]>(
    `select count(distinct symbol) as n from ticker_ratings`,
  );
  const [postTotal] = await mysqlQuery<{ n: number; latest_at: Date | null }[]>(
    `select count(*) as n, max(created_at) as latest_at from posts`,
  );
  const [post24] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from posts where created_at >= date_sub(current_timestamp, interval 24 hour)`,
  );
  const [post7] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from posts where created_at >= date_sub(current_timestamp, interval 7 day)`,
  );
  const [earnTotal] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from earnings_releases`,
  );
  const [earnFuture] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from earnings_releases
       where report_date between current_date and date_add(current_date, interval 30 day)`,
  );
  const [earnPending] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from earnings_releases
       where eps_actual is not null and post_id is null`,
  );
  const [rated24] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from ticker_ratings
       where updated_at >= date_sub(current_timestamp, interval 24 hour)`,
  );

  const totalT = Number(tickerCount?.n ?? 0);
  const rated = Number(ratedCount?.n ?? 0);
  return {
    tickers: {
      total: totalT,
      with_rating: rated,
      coverage_pct: totalT > 0 ? Math.round((rated / totalT) * 1000) / 10 : 0,
    },
    posts: {
      total: Number(postTotal?.n ?? 0),
      last24h: Number(post24?.n ?? 0),
      last7d: Number(post7?.n ?? 0),
      latest_at: postTotal?.latest_at ? new Date(postTotal.latest_at).toISOString() : null,
    },
    earnings: {
      total: Number(earnTotal?.n ?? 0),
      future30d: Number(earnFuture?.n ?? 0),
      reported_no_post: Number(earnPending?.n ?? 0),
    },
    ratings: {
      rated_count: rated,
      updated_24h: Number(rated24?.n ?? 0),
    },
  };
}

// =================== User funnel ===================

export type UserFunnel = {
  total_users: number;
  has_watchlist: number;
  has_position: number;
  has_alert: number;
  briefing_enabled: number;
  signups_30d: number;
  active_dau_7d: number;
};

export async function getUserFunnel(): Promise<UserFunnel> {
  const [total] = await mysqlQuery<{ n: number }[]>(`select count(*) as n from users`);
  const [wl] = await mysqlQuery<{ n: number }[]>(
    `select count(distinct user_id) as n from watchlist`,
  );
  const [pos] = await mysqlQuery<{ n: number }[]>(
    `select count(distinct user_id) as n from positions`,
  );
  const [al] = await mysqlQuery<{ n: number }[]>(
    `select count(distinct user_id) as n from alert_rules where is_active = 1`,
  );
  const [be] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from users where email_briefing_enabled = 1`,
  );
  const [s30] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from users where created_at >= date_sub(current_timestamp, interval 30 day)`,
  );
  const [dau7] = await mysqlQuery<{ n: number }[]>(
    `select count(distinct user_id) as n from events
      where user_id is not null
        and ts >= date_sub(current_timestamp, interval 7 day)`,
  );
  return {
    total_users: Number(total?.n ?? 0),
    has_watchlist: Number(wl?.n ?? 0),
    has_position: Number(pos?.n ?? 0),
    has_alert: Number(al?.n ?? 0),
    briefing_enabled: Number(be?.n ?? 0),
    signups_30d: Number(s30?.n ?? 0),
    active_dau_7d: Number(dau7?.n ?? 0),
  };
}

// =================== Event trends ===================

export type EventCountRow = {
  event_type: string;
  count_24h: number;
  count_7d: number;
};

export async function getEventTrends(): Promise<EventCountRow[]> {
  return mysqlQuery<EventCountRow[]>(
    `select event_type,
            sum(case when ts >= date_sub(current_timestamp, interval 24 hour) then 1 else 0 end) as count_24h,
            sum(case when ts >= date_sub(current_timestamp, interval 7 day) then 1 else 0 end) as count_7d
       from events
      where ts >= date_sub(current_timestamp, interval 7 day)
      group by event_type
      order by count_7d desc`,
  );
}

// =================== Recent failures ===================

export type RecentFailure = {
  id: string;
  job_name: string;
  started_at: string;
  duration_ms: number | null;
  error_message: string | null;
};

export async function getRecentFailures(limit = 20): Promise<RecentFailure[]> {
  const rows = await mysqlQuery<
    Array<{
      id: string;
      job_name: string;
      started_at: Date;
      duration_ms: number | null;
      error_message: string | null;
    }>
  >(
    `select id, job_name, started_at, duration_ms, error_message
       from job_runs
      where status = 'failed'
      order by started_at desc
      limit ?`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    job_name: r.job_name,
    started_at: new Date(r.started_at).toISOString(),
    duration_ms: r.duration_ms,
    error_message: r.error_message,
  }));
}

// =================== Top symbols by AI queries ===================

export type TopSymbol = { symbol: string; queries_7d: number };

export async function getTopAiSymbols(limit = 10): Promise<TopSymbol[]> {
  return mysqlQuery<TopSymbol[]>(
    `select symbol, count(*) as queries_7d
       from events
      where event_type = 'ai_query'
        and symbol is not null
        and ts >= date_sub(current_timestamp, interval 7 day)
      group by symbol
      order by queries_7d desc
      limit ?`,
    [limit],
  );
}
