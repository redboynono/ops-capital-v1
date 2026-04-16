import { createClient } from "@/lib/supabase/server";

export type ReportPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  is_premium: boolean;
  is_published: boolean;
  created_at: string;
  author_id: string | null;
};

export async function getPublishedPosts(limit?: number) {
  const supabase = await createClient();

  let query = supabase
    .from("posts")
    .select("id,title,slug,excerpt,is_premium,created_at")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    return [];
  }

  return data;
}

export async function getPostBySlug(slug: string): Promise<ReportPost | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("id,title,slug,excerpt,content,is_premium,is_published,created_at,author_id")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (error) {
    return null;
  }

  return data;
}

export async function getCurrentUserSubscriptionStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, subscribed: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, subscription_end_date")
    .eq("id", user.id)
    .single();

  const isActive = profile?.subscription_status === "active";
  const hasNotExpired = !profile?.subscription_end_date || new Date(profile.subscription_end_date) > new Date();

  return {
    user,
    subscribed: isActive && hasNotExpired,
  };
}
