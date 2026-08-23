export function createStripeClient({ emptyFor = [] } = {}) {
  const calls = [];
  return {
    calls,
    paymentIntents: {
      async retrieve() {
        throw new Error("Target Stripe contract forbids retrieving embedded charges.");
      },
    },
    charges: {
      async list(input) {
        calls.push({ operation: "charges.list", input });
        const paymentIntentId = input.payment_intent;
        return {
          object: "list",
          data: emptyFor.includes(paymentIntentId)
            ? []
            : [
                {
                  id: `ch_${paymentIntentId}`,
                  payment_intent: paymentIntentId,
                  receipt_url: `https://pay.stripe.com/receipts/${paymentIntentId}`,
                },
              ].slice(0, input.limit),
        };
      },
    },
  };
}
