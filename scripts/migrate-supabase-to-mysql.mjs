import crypto from "node:crypto";
import mysql from "mysql2/promise";

const requiredEnv = ["MYSQL_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing ${key}`);
  }
}

const MYSQL_URL = process.env.MYSQL_URL;
const SUPABASE_URL = process.env.SUPABASE_URL.replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE_SIZE = Number(process.env.MIGRATION_PAGE_SIZE || 1000);

function toMySqlDateTime(input) {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function randomPasswordHash() {
  const salt = crypto.randomBytes(16).toString("hex");
  const randomPassword = crypto.randomBytes(24).toString("hex");
  const key = crypto.scryptSync(randomPassword, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}

async function fetchSupabaseRows(table, selectColumns) {
  const rows = [];
  let offset = 0;

  while (true) {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    url.searchParams.set("select", selectColumns);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));

    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase fetch failed for ${table}: ${res.status} ${text}`);
    }

    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;

    rows.push(...page);
    offset += page.length;

    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

async function migrateUsers(conn) {
  const profiles = await fetchSupabaseRows(
    "profiles",
    "id,email,full_name,stripe_customer_id,subscription_status,subscription_end_date,created_at",
  );

  let inserted = 0;
  let updated = 0;

  for (const profile of profiles) {
    const [result] = await conn.execute(
      `
      insert into users
      (id, email, password_hash, full_name, stripe_customer_id, subscription_status, subscription_end_date, created_at)
      values (?, ?, ?, ?, ?, ?, ?, ?)
      on duplicate key update
        email = values(email),
        full_name = values(full_name),
        stripe_customer_id = values(stripe_customer_id),
        subscription_status = values(subscription_status),
        subscription_end_date = values(subscription_end_date)
      `,
      [
        profile.id,
        profile.email || `${profile.id}@migrated.local`,
        randomPasswordHash(),
        profile.full_name || null,
        profile.stripe_customer_id || null,
        profile.subscription_status === "active" ? "active" : "inactive",
        toMySqlDateTime(profile.subscription_end_date),
        toMySqlDateTime(profile.created_at) || toMySqlDateTime(new Date().toISOString()),
      ],
    );

    if (result.affectedRows === 1) inserted += 1;
    else updated += 1;
  }

  return { total: profiles.length, inserted, updated };
}

async function migratePosts(conn) {
  const posts = await fetchSupabaseRows(
    "posts",
    "id,title,slug,excerpt,content,is_premium,is_published,created_at,author_id",
  );

  let inserted = 0;
  let updated = 0;

  for (const post of posts) {
    const [result] = await conn.execute(
      `
      insert into posts
      (id, title, slug, excerpt, content, is_premium, is_published, created_at, author_id)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      on duplicate key update
        title = values(title),
        slug = values(slug),
        excerpt = values(excerpt),
        content = values(content),
        is_premium = values(is_premium),
        is_published = values(is_published),
        author_id = values(author_id)
      `,
      [
        post.id,
        post.title,
        post.slug,
        post.excerpt,
        post.content,
        post.is_premium ? 1 : 0,
        post.is_published ? 1 : 0,
        toMySqlDateTime(post.created_at) || toMySqlDateTime(new Date().toISOString()),
        post.author_id || null,
      ],
    );

    if (result.affectedRows === 1) inserted += 1;
    else updated += 1;
  }

  return { total: posts.length, inserted, updated };
}

async function main() {
  const conn = await mysql.createConnection(MYSQL_URL);

  try {
    await conn.beginTransaction();

    const userStats = await migrateUsers(conn);
    const postStats = await migratePosts(conn);

    await conn.commit();

    console.log("✅ Supabase -> MySQL migration completed");
    console.log("Users:", userStats);
    console.log("Posts:", postStats);
    console.log("⚠️ Passwords are not migrated from Supabase Auth. Users should reset passwords.");
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
