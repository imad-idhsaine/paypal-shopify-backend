const express = require('express');
const bodyParser = require('body-parser');
const paypalSdk = require('@paypal/checkout-server-sdk');
const Shopify = require('shopify-api-node');
require('dotenv').config();
// PayPal client setup
const environment = new paypalSdk.core.SandboxEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_CLIENT_SECRET
);
const paypalClient = new paypalSdk.core.PayPalHttpClient(environment);
// Shopify client setup
const shopify = new Shopify({
  shopName: process.env.SHOPIFY_SHOP_NAME,
  apiKey: process.env.SHOPIFY_API_KEY,
  password: process.env.SHOPIFY_API_PASSWORD
});
const app = express();
app.use(bodyParser.json());
app.post('/create-paypal-order', async (req, res) => {
  const { cart } = req.body;
  const purchaseUnits = [{
    amount: { currency_code: 'USD', value: cart.reduce((sum, i) => sum + parseFloat(i.unit_amount) * i.quantity, 0).toFixed(2) },
    items: cart.map(i => ({ name: i.name, unit_amount: { currency_code: 'USD', value: i.unit_amount }, quantity: i.quantity.toString() }))
  }];
  const request = new paypalSdk.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({ intent: 'CAPTURE', purchase_units: purchaseUnits });
  const order = await paypalClient.execute(request);
  res.json({ id: order.result.id });
});
app.post('/capture-paypal-order', async (req, res) => {
  const { orderID, shopifyOrderId } = req.body;
  // Capture PayPal payment
  const captureRequest = new paypalSdk.orders.OrdersCaptureRequest(orderID);
  captureRequest.requestBody({});
  const capture = await paypalClient.execute(captureRequest);
  // Mark Shopify order as paid
  await shopify.order.update(shopifyOrderId, { financial_status: 'paid' });
  // Create fulfillment to trigger digital delivery
  await shopify.fulfillment.create({
    order_id: shopifyOrderId,
    line_items: [] // Shopify will auto-fulfill digital items
  });
  res.json({ status: capture.result.status });
});
app.listen(8080, () => console.log('Server running on port 8080'));
