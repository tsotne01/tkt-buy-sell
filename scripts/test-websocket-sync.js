// test-websocket-sync.js: Automated Verification for Real-Time Live Seat Map & Saga Notifications
const { io } = require('socket.io-client');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:4000';

async function main() {
  console.log(`\n======================================================`);
  console.log(`[Test] Starting WebSockets Live Synchronization Test`);
  console.log(`Target Gateway: ${GATEWAY_URL}`);
  console.log(`======================================================\n`);

  // 1. Connect Client A (Buyer Alice)
  const clientA = io(GATEWAY_URL, {
    transports: ['websocket', 'polling'],
  });

  // 2. Connect Client B (Observer Bob)
  const clientB = io(GATEWAY_URL, {
    transports: ['websocket', 'polling'],
  });

  await new Promise((resolve) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 2) resolve();
    };
    clientA.on('connect', () => {
      console.log(`[Client A] Connected with socket ID: ${clientA.id}`);
      clientA.emit('joinEventRoom', 'evt_1');
      clientA.emit('joinUserRoom', 'usr_buyer_1');
      check();
    });
    clientB.on('connect', () => {
      console.log(`[Client B] Connected with socket ID: ${clientB.id}`);
      clientB.emit('joinEventRoom', 'evt_1');
      check();
    });
  });

  console.log(`\n>>> Phase 1: Test Real-Time Seat Hold Broadcast <<<`);
  
  // Find first available ticket
  const tktRes = await fetch(`${GATEWAY_URL}/api/inventory/events/evt_1/tickets`);
  const tktData = await tktRes.json();
  const availableTicket = tktData.tickets.find((t) => t.status === 'AVAILABLE');
  if (!availableTicket) {
    throw new Error('No available tickets found in evt_1 to test');
  }
  const targetSeat = availableTicket.id;
  console.log(`Target Seat selected: ${targetSeat} (Price: $${availableTicket.price})`);
  
  // Set up expectation on Client B for seatUpdated HELD
  const holdPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for seatUpdated HELD on Client B')), 5000);
    clientB.on('seatUpdated', (data) => {
      const ticketId = data.ticket_id || data.ticketId;
      if (ticketId === targetSeat && data.status === 'HELD') {
        clearTimeout(timeout);
        console.log(`[Client B Verified] Received real-time seatUpdated: ${ticketId} is now HELD!`);
        resolve(data);
      }
    });
  });

  // Trigger hold from Client A via HTTP
  const holdRes = await fetch(`${GATEWAY_URL}/api/inventory/hold`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticket_id: targetSeat,
      user_id: 'usr_buyer_1',
      hold_duration_seconds: 600,
      event_id: 'evt_1',
    }),
  });

  if (!holdRes.ok) {
    const err = await holdRes.text();
    console.error(`Hold request failed:`, err);
    process.exit(1);
  }
  console.log(`[HTTP Request] Hold successful for seat ${targetSeat}`);

  await holdPromise;
  clientB.off('seatUpdated');
  console.log(`>>> Phase 1 Passed: Client B received real-time seat hold without reloading! <<<\n`);

  console.log(`>>> Phase 2: Test Real-Time Checkout Saga Completion Broadcast <<<`);
  
  // Client B expects seatUpdated SOLD
  const soldPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for seatUpdated SOLD on Client B')), 10000);
    clientB.on('seatUpdated', (data) => {
      const ticketId = data.ticket_id || data.ticketId;
      if (ticketId === targetSeat && data.status === 'SOLD') {
        clearTimeout(timeout);
        console.log(`[Client B Verified] Received real-time seatUpdated: ${ticketId} is now SOLD!`);
        resolve(data);
      }
    });
  });

  // Client A expects orderUpdated with COMPLETED and QR pass
  const orderPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for orderUpdated on Client A')), 10000);
    clientA.on('orderUpdated', (data) => {
      if (data.status === 'COMPLETED') {
        clearTimeout(timeout);
        console.log(`[Client A Verified] Received real-time orderUpdated: Order ${data.orderId} COMPLETED with QR Code ${data.qr_code}!`);
        resolve(data);
      }
    });
  });

  // Trigger checkout via HTTP
  const orderRes = await fetch(`${GATEWAY_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: 'usr_buyer_1',
      ticket_id: targetSeat,
      event_id: 'evt_1',
      amount: 110.0,
    }),
  });

  const orderData = await orderRes.json();
  console.log(`[HTTP Request] Order created with ID: ${orderData.id}, waiting for RabbitMQ Saga & WebSocket events...`);

  await Promise.all([soldPromise, orderPromise]);
  console.log(`>>> Phase 2 Passed: RabbitMQ Saga broadcasted SOLD status and Digital Pass directly via WebSockets! <<<\n`);

  console.log(`>>> Phase 3: Test Real-Time Seat Hold Release Broadcast <<<`);
  // Find next available ticket
  const tktRes2 = await fetch(`${GATEWAY_URL}/api/inventory/events/evt_1/tickets`);
  const tktData2 = await tktRes2.json();
  const nextSeat = tktData2.tickets.find((t) => t.status === 'AVAILABLE').id;
  console.log(`Testing release on seat: ${nextSeat}`);

  // 1. Hold it
  await fetch(`${GATEWAY_URL}/api/inventory/hold`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticket_id: nextSeat,
      user_id: 'usr_buyer_1',
      hold_duration_seconds: 600,
      event_id: 'evt_1',
    }),
  });

  // 2. Set up release listener on Client B
  const releasePromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for seatUpdated AVAILABLE on Client B')), 5000);
    clientB.on('seatUpdated', (data) => {
      const ticketId = data.ticket_id || data.ticketId;
      if (ticketId === nextSeat && data.status === 'AVAILABLE') {
        clearTimeout(timeout);
        console.log(`[Client B Verified] Received real-time seatUpdated: ${ticketId} is now AVAILABLE again!`);
        resolve(data);
      }
    });
  });

  // 3. Release it
  await fetch(`${GATEWAY_URL}/api/inventory/release`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticket_id: nextSeat,
      user_id: 'usr_buyer_1',
      event_id: 'evt_1',
    }),
  });

  await releasePromise;
  console.log(`>>> Phase 3 Passed: Client B received real-time seat release back to AVAILABLE! <<<\n`);

  clientA.disconnect();
  clientB.disconnect();

  console.log(`======================================================`);
  console.log(`🎉 ALL REAL-TIME WEBSOCKET SYNCHRONIZATION TESTS PASSED!`);
  console.log(`======================================================\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`\n❌ Verification failed:`, err);
  process.exit(1);
});
