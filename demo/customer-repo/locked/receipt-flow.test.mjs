import assert from "node:assert/strict";
import test from "node:test";

import { receiptForPayment } from "../src/receipt.mjs";
import { createStripeClient } from "./stripe-client.mjs";

test("a buyer can open the receipt after a successful payment", async () => {
  const stripe = createStripeClient();
  const firstReceipt = await receiptForPayment(stripe, "pi_order_1042");
  const secondReceipt = await receiptForPayment(stripe, "pi_order_1043");

  assert.equal(firstReceipt, "https://pay.stripe.com/receipts/pi_order_1042");
  assert.equal(secondReceipt, "https://pay.stripe.com/receipts/pi_order_1043");
  assert.deepEqual(stripe.calls, [
    { operation: "charges.list", input: { payment_intent: "pi_order_1042", limit: 1 } },
    { operation: "charges.list", input: { payment_intent: "pi_order_1043", limit: 1 } },
  ]);
});

test("a payment without a charge has no receipt yet", async () => {
  const stripe = createStripeClient({ emptyFor: ["pi_pending"] });

  assert.equal(await receiptForPayment(stripe, "pi_pending"), null);
});
