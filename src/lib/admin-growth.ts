/**
 * 增长运营看板聚合查询 — /admin/growth
 */
import { mysqlQuery } from "@/lib/mysql";

export type GrowthKpi = {
  dau24h: number;
  wau7d: number;
  mau30d: number;
  pv24h: number;
  uv24h: number;
  signups24h: number;
  signups7d: number;
  signups30d: number;
  totalUsers: number;
  xPosts24h: number;
  xPosts7d: number;
  xClicks24h: number;
  xClicks7d: number;
  reads24h: number;
  trialUsers: number;
  paidUsers: number;
};

/** 活跃主体：登录 user_id 或匿名 visitor_id */
const ACTIVE_ACTOR_SQL = `coalesce(
  user_id,
  nullif(json_unquote(json_extract(meta_json, '$.visitor_id')), 'null')
)`;

export async function getGrowthKpi(): Promise<GrowthKpi> {
  const [dau] = await mysqlQuery<{ n: number }[]>(
    `select count(distinct ${ACTIVE_ACTOR_SQL}) as n
       from events
      where ts >= date_sub(current_timestamp, interval 24 hour)
        and (${ACTIVE_ACTOR_SQL}) is not null`,
  );
  const [wau] = await mysqlQuery<{ n: number }[]>(
    `select count(distinct ${ACTIVE_ACTOR_SQL}) as n
       from events
      where ts >= date_sub(current_timestamp, interval 7 day)
        and (${ACTIVE_ACTOR_SQL}) is not null`,
  );
  const [mau] = await mysqlQuery<{ n: number }[]>(
    `select count(distinct ${ACTIVE_ACTOR_SQL}) as n
       from events
      where ts >= date_sub(current_timestamp, interval 30 day)
        and (${ACTIVE_ACTOR_SQL}) is not null`,
  );
  const [pv] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from events
      where event_type='page_view' and ts >= date_sub(current_timestamp, interval 24 hour)`,
  );
  const [uv] = await mysqlQuery<{ n: number }[]>(
    `select count(distinct ${ACTIVE_ACTOR_SQL}) as n from events
      where event_type='page_view' and ts >= date_sub(current_timestamp, interval 24 hour)
        and (${ACTIVE_ACTOR_SQL}) is not null`,
  );
  const [s24] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from users where created_at >= date_sub(current_timestamp, interval 24 hour)`,
  );
  const [s7] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from users where created_at >= date_sub(current_timestamp, interval 7 day)`,
  );
  const [s30] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from users where created_at >= date_sub(current_timestamp, interval 30 day)`,
  );
  const [total] = await mysqlQuery<{ n: number }[]>(`select count(*) as n from users`);
  const [xp24] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from social_ops_posts
      where posted_x_at >= date_sub(current_timestamp, interval 24 hour)`,
  );
  const [xp7] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from social_ops_posts
      where posted_x_at >= date_sub(current_timestamp, interval 7 day)`,
  );
  const [xc7] = await mysqlQuery<{ n: number }[]>(
    `select coalesce(sum(clicks),0) as n from short_links where utm_source='x'`,
  );
  const [reads] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from reading_history
      where read_at >= date_sub(current_timestamp, interval 24 hour)`,
  );
  const [trial] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from users where subscription_status='active' and trial_used=1`,
  );
  const [paid] = await mysqlQuery<{ n: number }[]>(
    `select count(*) as n from users where subscription_status='active' and entitlement_research=1`,
  );

  return {
    dau24h: Number(dau?.n ?? 0),
    wau7d: Number(wau?.n ?? 0),
    mau30d: Number(mau?.n ?? 0),
    pv24h: Number(pv?.n ?? 0),
    uv24h: Number(uv?.n ?? 0),
    signups24h: Number(s24?.n ?? 0),
    signups7d: Number(s7?.n ?? 0),
    signups30d: Number(s30?.n ?? 0),
    totalUsers: Number(total?.n ?? 0),
    xPosts24h: Number(xp24?.n ?? 0),
    xPosts7d: Number(xp7?.n ?? 0),
    xClicks24h: 0,
    xClicks7d: Number(xc7?.n ?? 0),
    reads24h: Number(reads?.n ?? 0),
    trialUsers: Number(trial?.n ?? 0),
    paidUsers: Number(paid?.n ?? 0),
  };
}

export type DailyTrendRow = { day: string; dau: number; pv: number; signups: number };

export async function getGrowthTrend(days = 30): Promise<DailyTrendRow[]> {
  const rows = await mysqlQuery<
    Array<{ day: string; dau: string | number; pv: string | number; signups: string | number }>
  >(
    `with days as (
       select date_sub(current_date, interval seq day) as day
         from (
           select 0 as seq union select 1 union select 2 union select 3 union select 4
           union select 5 union select 6 union select 7 union select 8 union select 9
           union select 10 union select 11 union select 12 union select 13 union select 14
           union select 15 union select 16 union select 17 union select 18 union select 19
           union select 20 union select 21 union select 22 union select 23 union select 24
           union select 25 union select 26 union select 27 union select 28 union select 29
         ) s
        where seq < ?
     ),
     ev as (
       select date(ts) as day,
              count(distinct ${ACTIVE_ACTOR_SQL}) as dau,
              sum(case when event_type='page_view' then 1 else 0 end) as pv
         from events
        where ts >= date_sub(current_date, interval ? day)
        group by date(ts)
     ),
     su as (
       select date(created_at) as day, count(*) as signups
         from users
        where created_at >= date_sub(current_date, interval ? day)
        group by date(created_at)
     )
     select date_format(d.day, '%Y-%m-%d') as day,
            coalesce(ev.dau, 0) as dau,
            coalesce(ev.pv, 0) as pv,
            coalesce(su.signups, 0) as signups
       from days d
       left join ev on ev.day = d.day
       left join su on su.day = d.day
      order by d.day asc`,
    [days, days, days],
  );
  return rows.map((r) => ({
    day: r.day,
    dau: Number(r.dau),
    pv: Number(r.pv),
    signups: Number(r.signups),
  }));
}

export type TopPathRow = { path: string; views_7d: number };

export async function getTopPaths(limit = 12): Promise<TopPathRow[]> {
  return mysqlQuery<TopPathRow[]>(
    `select json_unquote(json_extract(meta_json, '$.path')) as path,
            count(*) as views_7d
       from events
      where event_type='page_view'
        and ts >= date_sub(current_timestamp, interval 7 day)
        and json_extract(meta_json, '$.path') is not null
      group by path
      order by views_7d desc
      limit ?`,
    [limit],
  );
}

export type SocialPostRow = {
  title: string;
  ref_key: string | null;
  posted_x_at: string | null;
  utm_campaign: string | null;
};

export async function getRecentXPosts(limit = 10): Promise<SocialPostRow[]> {
  const rows = await mysqlQuery<
    Array<{ title: string; ref_key: string | null; posted_x_at: Date | null; utm_campaign: string | null }>
  >(
    `select title, ref_key, posted_x_at, utm_campaign
       from (
         select title, ref_key, posted_x_at, utm_campaign,
                row_number() over (partition by ref_key order by posted_x_at desc) as rn
           from social_ops_posts
          where posted_x_at is not null and ref_key is not null
       ) t
      where rn = 1
      order by posted_x_at desc
      limit ?`,
    [limit],
  );
  return rows.map((r) => ({
    title: r.title,
    ref_key: r.ref_key,
    posted_x_at: r.posted_x_at ? new Date(r.posted_x_at).toISOString() : null,
    utm_campaign: r.utm_campaign,
  }));
}

export type UtmSourceRow = { utm_source: string; views_7d: number };

export async function getUtmBreakdown(): Promise<UtmSourceRow[]> {
  return mysqlQuery<UtmSourceRow[]>(
    `select coalesce(nullif(json_unquote(json_extract(meta_json, '$.utm_source')), 'null'), '(direct)') as utm_source,
            count(*) as views_7d
       from events
      where event_type='page_view'
        and ts >= date_sub(current_timestamp, interval 7 day)
      group by utm_source
      order by views_7d desc
      limit 10`,
  );
}
