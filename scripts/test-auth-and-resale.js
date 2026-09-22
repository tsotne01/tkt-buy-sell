// scripts/test-auth-and-resale.js: Automated Verification for Dynamic Auth & Secondary Resale Flow
const assert = require('assert');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const url = `${GATEWAY_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('======================================================');
  console.log('[Test] Dynamic User Registration, Login & Resale Flow');
  console.log(`Gateway: ${GATEWAY_URL}`);
  console.log('======================================================\n');

  const timestamp = Date.now();
  const buyerEmail = `buyer_${timestamp}@example.com`;
  const sellerEmail = `seller_${timestamp}@example.com`;
  const password = 'realSecurePassword123!';

  // --- Step 1: Register New Buyer ---
  console.log(`[1/5] Registering new Buyer account (${buyerEmail})...`);
  const buyerReg = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: buyerEmail,
      password,
      name: 'Dynamic Buyer',
      role: 'BUYER',
    }),
  });
  assert.strictEqual(buyerReg.status, 201, `Buyer registration failed: ${JSON.stringify(buyerReg.data)}`);
  assert.strictEqual(buyerReg.data.success, true);
  assert.strictEqual(buyerReg.data.role, 'BUYER');
  assert.strictEqual(buyerReg.data.email, buyerEmail);
  assert.ok(buyerReg.data.token, 'Buyer JWT token should be returned');
  const buyerUserId = buyerReg.data.user_id;
  console.log(`  -> Buyer successfully registered in DB! UserID: ${buyerUserId}`);

  // --- Step 2: Register New Seller ---
  console.log(`\n[2/5] Registering new Seller account (${sellerEmail})...`);
  const sellerReg = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: sellerEmail,
      password,
      name: 'Dynamic Seller',
      role: 'SELLER',
    }),
  });
  assert.strictEqual(sellerReg.status, 201, `Seller registration failed: ${JSON.stringify(sellerReg.data)}`);
  assert.strictEqual(sellerReg.data.success, true);
  assert.strictEqual(sellerReg.data.role, 'SELLER');
  assert.strictEqual(sellerReg.data.email, sellerEmail);
  assert.ok(sellerReg.data.token, 'Seller JWT token should be returned');
  const sellerUserId = sellerReg.data.user_id;
  console.log(`  -> Seller successfully registered in DB! UserID: ${sellerUserId}`);

  // --- Step 3: Authenticate Buyer via Login endpoint ---
  console.log(`\n[3/5] Authenticating Buyer via Login endpoint (POST /api/auth/login)...`);
  const buyerLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: buyerEmail,
      password,
    }),
  });
  assert.strictEqual(buyerLogin.status, 201, `Buyer login failed: ${JSON.stringify(buyerLogin.data)}`);
  assert.strictEqual(buyerLogin.data.success, true);
  assert.strictEqual(buyerLogin.data.user_id, buyerUserId);
  assert.ok(buyerLogin.data.token, 'Fresh JWT token issued upon login');
  console.log(`  -> Buyer authenticated with fresh JWT signature!`);

  // --- Step 4: Seller lists a ticket for P2P resale ---
  const resaleTicketId = 'tkt_evt1_8';
  const resalePrice = 195;
  console.log(`\n[4/5] Seller listing ticket ${resaleTicketId} for P2P resale at $${resalePrice}...`);
  const listRes = await request('/api/inventory/resale', {
    method: 'POST',
    body: JSON.stringify({
      ticket_id: resaleTicketId,
      seller_id: sellerUserId,
      resale_price: resalePrice,
      event_id: 'evt_1',
    }),
  });
  assert.strictEqual(listRes.status, 201, `Resale listing failed: ${JSON.stringify(listRes.data)}`);
  assert.strictEqual(listRes.data.id, resaleTicketId);
  assert.strictEqual(listRes.data.is_resale, true);
  assert.strictEqual(listRes.data.seller_id, sellerUserId);
  assert.strictEqual(Number(listRes.data.price), resalePrice);
  console.log(`  -> Ticket ${resaleTicketId} listed for resale by seller! Status: ${listRes.data.status}, Price: $${listRes.data.price}`);

  // Verify it appears in public resale marketplace
  console.log('  -> Fetching public resale marketplace tickets (GET /api/inventory/resale)...');
  const marketRes = await request('/api/inventory/resale');
  assert.strictEqual(marketRes.status, 200);
  const foundTicket = marketRes.data.tickets.find((t) => t.id === resaleTicketId);
  assert.ok(foundTicket, `Ticket ${resaleTicketId} should be in resale list`);
  console.log(`  -> Verified: Ticket ${resaleTicketId} is live on Fan-to-Fan marketplace!`);

  // --- Step 5: Buyer purchases Seller's resale ticket ---
  console.log(`\n[5/5] Buyer purchasing resale ticket (${resaleTicketId}) via Distributed Saga...`);
  // 5a. Buyer reserves hold
  console.log(`  -> Buyer reserving 600s hold on ${resaleTicketId}...`);
  const holdRes = await request('/api/inventory/hold', {
    method: 'POST',
    body: JSON.stringify({
      ticket_id: resaleTicketId,
      user_id: buyerUserId,
      hold_duration_seconds: 600,
      event_id: 'evt_1',
    }),
  });
  assert.strictEqual(holdRes.status, 201, `Hold failed: ${JSON.stringify(holdRes.data)}`);
  assert.strictEqual(holdRes.data.success, true);

  // 5b. Buyer places order
  console.log(`  -> Buyer submitting order for $${resalePrice}...`);
  const orderRes = await request('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      user_id: buyerUserId,
      ticket_id: resaleTicketId,
      event_id: 'evt_1',
      amount: resalePrice,
    }),
  });
  assert.strictEqual(orderRes.status, 201, `Order creation failed: ${JSON.stringify(orderRes.data)}`);
  const orderId = orderRes.data.id;
  console.log(`  -> Order created with ID: ${orderId}. Waiting for Distributed Saga completion...`);

  // 5c. Poll order until COMPLETED
  let completedOrder = null;
  for (let i = 0; i < 20; i++) {
    await sleep(400);
    const checkRes = await request(`/api/orders/${orderId}`);
    if (checkRes.data && checkRes.data.status === 'COMPLETED') {
      completedOrder = checkRes.data;
      break;
    }
  }

  assert.ok(completedOrder, `Order ${orderId} did not complete in time`);
  assert.strictEqual(completedOrder.status, 'COMPLETED');
  assert.ok(completedOrder.qr_code, 'Completed order must have QR Code pass');
  console.log(`  -> Saga COMPLETED! Order ${orderId} status: ${completedOrder.status}`);
  console.log(`  -> Dynamic Entry QR Pass: ${completedOrder.qr_code}`);

  // 5d. Verify resale marketplace no longer lists this ticket as available
  const marketAfterRes = await request('/api/inventory/resale');
  const foundAfter = marketAfterRes.data.tickets.find((t) => t.id === resaleTicketId);
  assert.ok(!foundAfter, `Sold resale ticket ${resaleTicketId} must NOT appear in available resale listings`);
  console.log(`  -> Verified: Resale ticket ${resaleTicketId} removed from available resale listings.`);

  // 5e. Verify Buyer's order history contains this order
  const buyerOrdersRes = await request(`/api/orders/user/${buyerUserId}`);
  assert.strictEqual(buyerOrdersRes.status, 200);
  const buyerOrder = buyerOrdersRes.data.orders.find((o) => o.id === orderId);
  assert.ok(buyerOrder, `Order ${orderId} should appear in Buyer's order history`);
  console.log(`  -> Verified: Order ${orderId} visible in Buyer's personal ticket vault!`);

  console.log('\n======================================================');
  console.log(' SUCCESS: All Dynamic Registration & Resale tests PASSED!');
  console.log('======================================================\n');
}

run().catch((err) => {
  console.error('\n Test FAILED with error:', err);
  process.exit(1);
});
