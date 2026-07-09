// Example checkout function — deploy as a serverless endpoint (Render web
// service, Cloudflare Worker, Netlify/Vercel function) and put its URL in
// src/data/site.json → checkout.endpoint.
//
// The storefront POSTs { items: [{ sku, size, qty }] }. Prices are looked up
// server-side from products.json — never trust prices from the client.
//
// Fulfilment swap (see README): the webhook below is the single seam where
// home-pressed runs and POD overflow diverge. Two fulfilment paths, one
// storefront, zero redesign.

import Stripe from 'stripe';
import products from '../src/data/products.json' with { type: 'json' };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const FREE_SHIPPING_OVER = 6000; // pence
const UK_SHIPPING = 350;

export async function handleCheckout(request) {
  const { items } = await request.json();

  const lineItems = items.map(({ sku, size, qty }) => {
    const product = products.products.find((p) => p.sku === sku);
    if (!product) throw new Error(`Unknown SKU: ${sku}`);
    if ((product.stock[size] ?? 0) < qty) throw new Error(`Out of stock: ${sku} ${size}`);
    return {
      quantity: qty,
      price_data: {
        currency: 'gbp',
        unit_amount: product.price,
        product_data: {
          name: `${product.name} — ${size}`,
          metadata: { sku, size }
        }
      }
    };
  });

  const subtotal = lineItems.reduce((s, li) => s + li.price_data.unit_amount * li.quantity, 0);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    shipping_address_collection: { allowed_countries: ['GB'] },
    shipping_options: [
      {
        shipping_rate_data: {
          display_name: 'Royal Mail Tracked 48',
          type: 'fixed_amount',
          fixed_amount: { amount: subtotal >= FREE_SHIPPING_OVER ? 0 : UK_SHIPPING, currency: 'gbp' }
        }
      }
    ],
    success_url: `${process.env.SITE_URL}/?claimed=true`,
    cancel_url: `${process.env.SITE_URL}/cart`
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Stripe webhook: checkout.session.completed → route fulfilment.
// This is the POD seam. Limited runs are pressed at home; when volume
// justifies it, route overflow SKUs to a POD API (Printful/Gelato) here.
export async function handleWebhook(event) {
  if (event.type !== 'checkout.session.completed') return;
  const session = event.data.object;
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id);

  for (const item of lineItems.data) {
    const sku = item.price?.product?.metadata?.sku;
    const podEligible = false; // flip per-SKU when POD goes live
    if (podEligible) {
      // await fetch('https://api.printful.com/orders', { ... })
    } else {
      // Home press queue: decrement stock in products.json / DB,
      // send order-confirmation email (emails/order-confirmation.md).
    }
  }
}
