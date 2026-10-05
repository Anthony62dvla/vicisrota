import type Stripe from "stripe";
import { log } from "@/lib/log";
import { saveSubscription, stripe, stripeConfigured } from "@/lib/stripe";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Stripe tells VicisRota here when a business subscribes, a payment fails or a plan is cancelled.
 * Every message is checked against STRIPE_WEBHOOK_SECRET before anything is changed.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeConfigured() || !secret) return Response.json({ error: "Payments are not switched on" }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Not signed" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return Response.json({ error: "Bad signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const organisationId = session.client_reference_id;
      if (session.mode === "subscription" && session.subscription && organisationId && UUID.test(organisationId)) {
        const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        await saveSubscription(await stripe().subscriptions.retrieve(id), organisationId);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await saveSubscription(event.data.object);
      break;
    default:
      break;
  }
  await log("info", "stripe.event", { type: event.type, id: event.id });
  return Response.json({ received: true });
}
