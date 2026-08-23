export async function receiptForPayment(stripe, paymentIntentId) {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["charges"],
  });

  return paymentIntent.charges.data[0]?.receipt_url ?? null;
}
