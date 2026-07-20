const Stripe = require("stripe");
const User = require("../models/User");

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

function requireStripe(res) {
  if (!stripe) {
    res.status(500).json({ success: false, message: "Billing is not configured on the server yet." });
    return false;
  }
  return true;
}

// Creates (or reuses) a Stripe Customer for this user, then opens a
// Checkout Session for the Pro subscription. Price is defined inline via
// price_data instead of a pre-created Stripe Price id, so this works the
// moment a secret key is dropped in — no dashboard setup required first.
const createCheckoutSession = async (req, res) => {
  if (!requireStripe(res)) return;
  try {
    const user = req.user;

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: String(user._id) },
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
    const amount = parseInt(process.env.STRIPE_PRO_PRICE_INR, 10) || 9900; // paise, ₹99 default

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "inr",
            unit_amount: amount,
            recurring: { interval: "month" },
            product_data: {
              name: "Job Analyzer Pro",
              description: "Up to 100 job matches per resume, AI-written resume improvement tips, and full history.",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${clientUrl}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/account?checkout=cancelled`,
      metadata: { userId: String(user._id) },
    });

    res.json({ success: true, data: { url: session.url } });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    res.status(500).json({ success: false, message: "Could not start checkout. Please try again." });
  }
};

// Lets a Pro user manage or cancel their subscription via Stripe's hosted
// billing portal instead of us building cancel/upgrade UI ourselves.
const createPortalSession = async (req, res) => {
  if (!requireStripe(res)) return;
  try {
    const user = req.user;
    if (!user.stripeCustomerId) {
      return res.status(400).json({ success: false, message: "No billing account found yet." });
    }
    const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${clientUrl}/account`,
    });
    res.json({ success: true, data: { url: session.url } });
  } catch (error) {
    console.error("Stripe portal error:", error);
    res.status(500).json({ success: false, message: "Could not open billing portal." });
  }
};

const getBillingStatus = async (req, res) => {
  const user = req.user;
  res.json({
    success: true,
    data: {
      isPro: user.isPro(),
      subscriptionStatus: user.subscriptionStatus,
      currentPeriodEnd: user.currentPeriodEnd,
    },
  });
};

// Fallback activation path for the classic hackathon-demo bug: "payment
// succeeds, success page shows, but Pro never activates." That happens
// whenever the Stripe webhook isn't actually reachable (no `stripe listen`
// forwarder running locally, wrong/missing STRIPE_WEBHOOK_SECRET, etc) —
// the DB update in handleWebhook below then simply never fires. Instead of
// depending solely on the webhook, the success redirect now carries
// Stripe's own `session_id`, and the frontend calls this endpoint to
// verify + apply the subscription state directly, synchronously, the
// moment the user lands back on /account. The webhook stays in place as
// the source of truth for renewals/cancellations that happen later.
const syncCheckoutSession = async (req, res) => {
  if (!requireStripe(res)) return;
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "Missing sessionId." });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });

    // Make sure this checkout session actually belongs to the signed-in
    // user — never trust a session id to update someone else's account.
    if (String(session.metadata?.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "This checkout session doesn't belong to you." });
    }

    if (session.payment_status !== "paid" && session.status !== "complete") {
      return res.status(400).json({ success: false, message: "Payment not completed yet." });
    }

    const subscription = session.subscription;
    if (!subscription) {
      return res.status(400).json({ success: false, message: "No subscription found on this session." });
    }

    // Stripe API versions from 2025 onward moved current_period_end off
    // the Subscription object and onto its line items — read from
    // whichever place has it so this keeps working across API versions.
    const periodEnd =
      subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end || null;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        stripeCustomerId: session.customer,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      },
      { new: true }
    );

    res.json({ success: true, data: user.toSafeJSON() });
  } catch (error) {
    console.error("Stripe session sync error:", error);
    res.status(500).json({ success: false, message: "Could not confirm your subscription. Please refresh in a moment." });
  }
};

// Keeps User.subscriptionStatus in sync with Stripe. Mounted with
// express.raw() (see server.js) since Stripe's signature check needs the
// exact raw request body, not the JSON-parsed one.
const handleWebhook = async (req, res) => {
  if (!stripe) return res.status(500).send("Billing not configured");

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        if (userId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          const periodEnd =
            subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end || null;
          await User.findByIdAndUpdate(userId, {
            stripeCustomerId: session.customer,
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        await User.findOneAndUpdate(
          { stripeCustomerId: subscription.customer },
          {
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            currentPeriodEnd: (() => {
              const periodEnd =
                subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end || null;
              return periodEnd ? new Date(periodEnd * 1000) : null;
            })(),
          }
        );
        break;
      }
      default:
        break; // ignore events we don't care about
    }
    res.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handling error:", error);
    res.status(500).send("Webhook handler failed");
  }
};

module.exports = {
  createCheckoutSession,
  createPortalSession,
  getBillingStatus,
  syncCheckoutSession,
  handleWebhook,
};
