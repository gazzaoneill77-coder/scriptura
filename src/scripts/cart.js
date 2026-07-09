// NARROW. cart — client-side, localStorage-backed.
// Checkout hands the line items to the endpoint configured in
// src/data/site.json (checkout.endpoint), which is expected to create a
// Stripe Checkout session and return { url }. See README for wiring.

const KEY = 'narrow.cart';

const read = () => JSON.parse(localStorage.getItem(KEY) || '[]');
const write = (items) => {
  localStorage.setItem(KEY, JSON.stringify(items));
  renderCount();
};

const gbp = (pence) => `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`;

function renderCount() {
  const n = read().reduce((sum, i) => sum + i.qty, 0);
  document.querySelectorAll('[data-cart-count]').forEach((el) => {
    el.textContent = n;
    el.classList.toggle('on', n > 0);
  });
}

/* ---------- product page ---------- */

function initProductPage() {
  const dataEl = document.getElementById('product-data');
  if (!dataEl) return;
  const product = JSON.parse(dataEl.textContent);
  const threshold = product.lowStockThreshold ?? 5;

  const sizeBtns = [...document.querySelectorAll('[data-size]')];
  const claimBtn = document.querySelector('[data-claim]');
  const stockMsg = document.querySelector('[data-stock-msg]');
  let selected = null;

  sizeBtns.forEach((btn) => {
    const size = btn.dataset.size;
    const left = product.stock[size] ?? 0;
    if (left <= 0) {
      btn.classList.add('gone');
      btn.disabled = true;
      return;
    }
    btn.addEventListener('click', () => {
      selected = size;
      sizeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      // Scarcity is only shown when it's real: below threshold units.
      stockMsg.textContent = left < threshold ? `${left} remaining in ${size}.` : '';
      claimBtn.disabled = false;
    });
  });

  const soldOut = Object.values(product.stock).every((n) => n <= 0);
  if (soldOut && claimBtn) {
    claimBtn.textContent = 'GONE.';
    claimBtn.disabled = true;
    stockMsg.textContent = 'No restocks. Join the Gate List for Drop 002.';
    return;
  }

  claimBtn?.addEventListener('click', () => {
    if (!selected) return;
    const items = read();
    const found = items.find((i) => i.sku === product.sku && i.size === selected);
    if (found) found.qty += 1;
    else items.push({ sku: product.sku, slug: product.slug, name: product.name, size: selected, price: product.price, qty: 1 });
    write(items);
    claimBtn.textContent = 'CLAIMED. IN YOUR CART.';
    setTimeout(() => { claimBtn.textContent = 'CLAIM IT'; }, 1600);
  });
}

/* ---------- cart page ---------- */

function initCartPage() {
  const root = document.querySelector('[data-cart-root]');
  if (!root) return;
  const endpoint = root.dataset.checkoutEndpoint || '';

  function render() {
    const items = read();
    if (items.length === 0) {
      root.innerHTML = '<p class="cart-empty">Nothing yet. The gate is still open.</p>' +
        '<p style="margin-top:32px"><a class="btn" href="/shop">SHOP THE DROP</a></p>';
      return;
    }
    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    root.innerHTML = items.map((i, idx) => `
      <div class="cart-row">
        <div class="info">
          <strong><a href="/products/${i.slug}">${i.name}</a></strong>
          <span>Size ${i.size} · Qty ${i.qty}</span>
        </div>
        <div>${gbp(i.price * i.qty)}</div>
        <button class="remove" data-remove="${idx}">remove</button>
      </div>`).join('') + `
      <div class="cart-total"><span>Total</span><span>${gbp(total)}</span></div>
      <button class="btn solid claim" data-checkout>CHECKOUT</button>
      <p class="cart-note" data-checkout-msg></p>
      <p class="trust-line">Hand-pressed in the UK. Tracked shipping. 14-day returns.</p>`;

    root.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const items = read();
        items.splice(Number(btn.dataset.remove), 1);
        write(items);
        render();
      });
    });

    root.querySelector('[data-checkout]')?.addEventListener('click', async (e) => {
      const msg = root.querySelector('[data-checkout-msg]');
      if (!endpoint) {
        msg.textContent = 'Checkout opens with the drop. Join the Gate List below — you’ll hear first.';
        return;
      }
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: read().map(({ sku, size, qty }) => ({ sku, size, qty })) })
        });
        const { url } = await res.json();
        if (url) window.location.href = url;
        else throw new Error('no url');
      } catch {
        msg.textContent = 'Something broke on the road. Try again in a minute.';
        btn.disabled = false;
      }
    });
  }

  render();
}

renderCount();
initProductPage();
initCartPage();
