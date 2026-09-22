// scripts/test-auth-and-resale.js: Automated Verification for Auth & Secondary Resale Flow
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
  console.log('[Test] Secondary Resale Marketplace & JWT Auth Verification');
  console.log(`Gateway: ${GATEWAY_URL}`);
  console.log('======================================================\n');

  // --- Step 1: Alice Login ---
  console.log('[1/5] Authenticating Alice (Buyer)...');
  const aliceRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'buyer@example.com', password: 'password123' }),
  });
  assert.strictEqual(aliceRes.status, 201, `Alice login failed: ${JSON.stringify(aliceRes.data)}`);
  assert.strictEqual(aliceRes.data.success, true);
  assert.strictEqual(aliceRes.data.role, 'BUYER');
  assert.strictEqual(aliceRes.data.email, 'buyer@example.com');
  assert.ok(aliceRes.data.token, 'Alice JWT token should be present');
  console.log(`  -> Alice authenticated successfully! UserID: ${aliceRes.data.user_id}, Role: ${aliceRes.data.role}`);

  // --- Step 2: Bob Login ---
  console.log('\n[2/5] Authenticating Bob (Seller)...');
  const bobRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'seller@example.com', password: 'password123' }),
  });
  assert.strictEqual(bobRes.status, 201, `Bob login failed: ${JSON.stringify(bobRes.data)}`);
  assert.strictEqual(bobRes.data.success, true);
  assert.strictEqual(bobRes.data.role, 'SELLER');
  assert.strictEqual(bobRes.data.email, 'seller@example.com');
  assert.ok(bobRes.data.token, 'Bob JWT token should be present');
  console.log(`  -> Bob authenticated successfully! UserID: ${bobRes.data.user_id}, Role: ${bobRes.data.role}`);

  // --- Step 3: Register New Fan ---
  const newEmail = `fan_${Date.now()}@example.com`;
  console.log(`\n[3/5] Registering new fan account (${newEmail})...`);
  const regRes = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: newEmail,
      password: 'password123',
      name: 'Charlie Fan',
      role: 'BUYER',
    }),
  });
  assert.strictEqual(regRes.status, 201, `Registration failed: ${JSON.stringify(regRes.data)}`);
  assert.strictEqual(regRes.data.success, true);
  assert.strictEqual(regRes.data.name, 'Charlie Fan');
  assert.ok(regRes.data.user_id.startsWith('usr_'));
  console.log(`  -> New fan registered successfully! UserID: ${regRes.data.user_id}, Name: ${regRes.data.name}`);

  // --- Step 4: Bob lists a ticket for P2P resale ---
  const resaleTicketId = 'tkt_evt1_5';
  const resalePrice = 175;
  console.log(`\n[4/5] Bob listing ticket ${resaleTicketId} for P2P resale at $${resalePrice}...`);
  const listRes = await request('/api/inventory/resale', {
    method: 'POST',
    body: JSON.stringify({
      ticket_id: resaleTicketId,
      seller_id: bobRes.data.user_id,
      resale_price: resalePrice,
      event_id: 'evt_1',
    }),
  });
  assert.strictEqual(listRes.status, 201, `Resale listing failed: ${JSON.stringify(listRes.data)}`);
  assert.strictEqual(listRes.data.id, resaleTicketId);
  assert.strictEqual(listRes.data.is_resale, true);
  assert.strictEqual(listRes.data.seller_id, bobRes.data.user_id);
  assert.strictEqual(Number(listRes.data.price), resalePrice);
  console.log(`  -> Ticket ${resaleTicketId} listed for resale by Bob! Status: ${listRes.data.status}, Price: $${listRes.data.price}`);

  // Verify it appears in public resale marketplace
  console.log('  -> Fetching public resale marketplace tickets (GET /api/inventory/resale)...');
  const marketRes = await request('/api/inventory/resale');
  assert.strictEqual(marketRes.status, 200);
  const foundTicket = marketRes.data.tickets.find((t) => t.id === resaleTicketId);
  assert.ok(foundTicket, `Ticket ${resaleTicketId} should be in resale list`);
  console.log(`  -> Verified: Ticket ${resaleTicketId} is live on Fan-to-Fan marketplace!`);

  // --- Step 5: Alice purchases Bob's resale ticket ---
  console.log(`\n[5/5] Alice buying Bob's resale ticket (${resaleTicketId}) via Distributed Saga...`);
  // 5a. Alice reserves hold
  console.log(`  -> Alice reserving 600s hold on ${resaleTicketId}...`);
  const holdRes = await request('/api/inventory/hold', {
    method: 'POST',
    body: JSON.stringify({
      ticket_id: resaleTicketId,
      user_id: aliceRes.data.user_id,
      hold_duration_seconds: 600,
      event_id: 'evt_1',
    }),
  });
  assert.strictEqual(holdRes.status, 201, `Hold failed: ${JSON.stringify(holdRes.data)}`);
  assert.strictEqual(holdRes.data.success, true);

  // 5b. Alice places order
  console.log(`  -> Alice submitting order for $${resalePrice}...`);
  const orderRes = await request('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      user_id: aliceRes.data.user_id,
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

  // 5e. Verify Alice's order history contains this order
  const aliceOrdersRes = await request(`/api/orders/user/${aliceRes.data.user_id}`);
  assert.strictEqual(aliceOrdersRes.status, 200);
  const aliceOrder = aliceOrdersRes.data.orders.find((o) => o.id === orderId);
  assert.ok(aliceOrder, `Order ${orderId} should appear in Alice's order history`);
  console.log(`  -> Verified: Order ${orderId} visible in Alice's personal ticket vault!`);

  console.log('\n======================================================');
  console.log(' SUCCESS: All JWT Auth & P2P Resale flow checks PASSED!');
  console.log('======================================================\n');
}

run().catch((err) => {
  console.error('\n Test FAILED with error:', err);
  process.exit(1);
});
