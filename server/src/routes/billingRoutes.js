const express = require("express");
const { env } = require("../config/env");
const { query: dbQuery } = require("../services/dbAdapter");

const billingRoutes = express.Router();

function getStripe() {
  if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not configured");
  return require("stripe")(env.STRIPE_SECRET_KEY);
}

// GET /billing/plan - current plan info
billingRoutes.get("/plan", async (req, res) => {
  try {
    const result = await dbQuery(
      `SELECT role, stripe_customer_id, stripe_subscription_id, plan_expires, updated_at
       FROM user_plans WHERE user_id = $1`,
      [req.authUser.id]
    );
    const plan = result.rows?.[0] || { role: "free", plan_expires: null };
    return res.json({ plan });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch plan", details: err.message });
  }
});

// POST /billing/checkout - create Stripe checkout session
billingRoutes.post("/checkout", async (req, res) => {
  const { tier } = req.body; // 'pro' or 'elite'
  const priceId = tier === "elite" ? env.STRIPE_PRICE_ELITE : env.STRIPE_PRICE_PRO;

  if (!priceId) {
    return res.status(400).json({ error: "Invalid tier or price not configured" });
  }

  try {
    const stripe = getStripe();

    // Get or create Stripe customer
    let customerId;
    const existing = await dbQuery(
      `SELECT stripe_customer_id FROM user_plans WHERE user_id = $1`,
      [req.authUser.id]
    ).catch(() => ({ rows: [] }));

    if (existing.rows?.[0]?.stripe_customer_id) {
      customerId = existing.rows[0].stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: req.authUser.email,
        name: req.authUser.name,
        metadata: { userId: req.authUser.id },
      });
      customerId = customer.id;
      await dbQuery(
        `INSERT INTO user_plans (user_id, role, stripe_customer_id, updated_at)
         VALUES ($1, 'free', $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET stripe_customer_id = $2, updated_at = NOW()`,
        [req.authUser.id, customerId]
      ).catch(() => {});
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.FRONTEND_URL}/billing?success=true`,
      cancel_url: `${env.FRONTEND_URL}/billing?canceled=true`,
      metadata: { userId: req.authUser.id, tier },
    });

    return res.json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create checkout session", details: err.message });
  }
});

// GET /billing/portal - Stripe customer portal
billingRoutes.get("/portal", async (req, res) => {
  try {
    const stripe = getStripe();
    const result = await dbQuery(
      `SELECT stripe_customer_id FROM user_plans WHERE user_id = $1`,
      [req.authUser.id]
    );
    const customerId = result.rows?.[0]?.stripe_customer_id;
    if (!customerId) {
      return res.status(400).json({ error: "No billing account found" });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${env.FRONTEND_URL}/billing`,
    });
    return res.json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: "Failed to create portal session", details: err.message });
  }
});

// POST /billing/webhook - Stripe webhook handler (raw body required)
billingRoutes.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).json({ error: "Webhook secret not configured" });
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature failed: ${err.message}` });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const tier = session.metadata?.tier || "pro";
      if (userId) {
        await dbQuery(
          `INSERT INTO user_plans (user_id, role, stripe_customer_id, stripe_subscription_id, plan_expires, updated_at)
           VALUES ($1, $2, $3, $4, NULL, NOW())
           ON CONFLICT (user_id) DO UPDATE SET role = $2, stripe_customer_id = $3,
           stripe_subscription_id = $4, plan_expires = NULL, updated_at = NOW()`,
          [userId, tier, session.customer, session.subscription]
        ).catch(() => {});
        await dbQuery(`UPDATE app_users SET role = $1 WHERE id = $2`, [tier, userId]).catch(() => {});
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      await dbQuery(
        `UPDATE user_plans SET role = 'free', stripe_subscription_id = NULL, plan_expires = NOW(), updated_at = NOW()
         WHERE stripe_subscription_id = $1`,
        [sub.id]
      ).catch(() => {});
    }
    return res.json({ received: true });
  } catch (err) {
    console.error("[billing/webhook]", err.message);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

module.exports = { billingRoutes };
