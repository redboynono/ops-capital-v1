import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

function addMonths(base: Date, months: number) {
  const date = new Date(base);
  date.setMonth(date.getMonth() + months);
  return date;
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  const stripe = getStripe();

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id;
    const plan = session.metadata?.plan === "yearly" ? "yearly" : "monthly";

    if (userId) {
      const supabaseAdmin = createAdminClient();
      const months = plan === "yearly" ? 12 : 1;
      const subscriptionEndDate = addMonths(new Date(), months).toISOString();

      await supabaseAdmin
        .from("profiles")
        .update({
          subscription_status: "active",
          subscription_end_date: subscriptionEndDate,
          stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
        })
        .eq("id", userId);
    }
  }

  return NextResponse.json({ received: true });
}
