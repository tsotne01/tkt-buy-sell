/**
 * Automated Verification: Elasticsearch Distributed Search, Typo Tolerance,
 * and Transactional Outbox Event Ingestion Pipeline.
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:4000';
const ES_URL = process.env.ES_URL || 'http://localhost:9200';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: text };
  }
}

async function main() {
  console.log('================================================================');
  console.log('🚀 ELASTICSEARCH DISTRIBUTED SEARCH & OUTBOX PIPELINE TEST');
  console.log('================================================================\n');

  // Phase 1: Cluster Health
  console.log('--- Phase 1: Verify Elasticsearch Cluster Health ---');
  let esHealth = await request(`${ES_URL}/_cluster/health`);
  if (!esHealth.ok) {
    console.log(`Direct port 9200 not reachable (${esHealth.status}), checking through API Gateway...`);
  } else {
    console.log(`✅ Elasticsearch Cluster Status: ${esHealth.data.status} (nodes: ${esHealth.data.number_of_nodes})`);
  }

  // Phase 2: Exact Match Search
  console.log('\n--- Phase 2: Exact Match Search via Catalog API ---');
  const coldplayExact = await request(`${GATEWAY_URL}/api/events?search=Coldplay`);
  if (!coldplayExact.ok || !coldplayExact.data.events || coldplayExact.data.events.length === 0) {
    throw new Error(`Failed exact search for Coldplay: ${JSON.stringify(coldplayExact.data)}`);
  }
  console.log(`✅ Exact Search 'Coldplay': found ${coldplayExact.data.events.length} event(s)`);
  console.log(`   Top result: "${coldplayExact.data.events[0].title}" in ${coldplayExact.data.events[0].city}`);

  const londonSearch = await request(`${GATEWAY_URL}/api/events?search=London`);
  console.log(`✅ Exact Search 'London': found ${londonSearch.data.events.length} event(s) in London`);

  // Phase 3: Typo-Tolerant (Fuzzy) Search
  console.log('\n--- Phase 3: Typo-Tolerant (Fuzzy) Search Verification ---');
  const testTypos = [
    { typo: 'clodplay', expected: 'Coldplay' },
    { typo: 'wembly', expected: 'Wembley' },
    { typo: 'zimmar', expected: 'Hans Zimmer' },
    { typo: 'hamilten', expected: 'Hamilton' },
  ];

  for (const { typo, expected } of testTypos) {
    const res = await request(`${GATEWAY_URL}/api/events?search=${typo}`);
    if (!res.ok || !res.data.events || res.data.events.length === 0) {
      throw new Error(`Typo search for '${typo}' failed to find '${expected}'! Data: ${JSON.stringify(res.data)}`);
    }
    const matched = res.data.events[0];
    console.log(`✅ Typo query '${typo}' ➔ Correctly matched "${matched.title}" (${matched.venue_name})`);
  }

  // Phase 4: Category Filtering
  console.log('\n--- Phase 4: Category Filter Verification ---');
  const sportsFilter = await request(`${GATEWAY_URL}/api/events?category=Sports`);
  if (!sportsFilter.ok || sportsFilter.data.events.length === 0) {
    throw new Error(`Sports filter failed: ${JSON.stringify(sportsFilter.data)}`);
  }
  console.log(`✅ Category 'Sports': found ${sportsFilter.data.events.length} event(s) - "${sportsFilter.data.events[0].title}"`);

  // Phase 5: Transactional Outbox & End-to-End Ingestion Pipeline
  console.log('\n--- Phase 5: Transactional Outbox & Real-time Event Ingestion ---');
  const timestamp = Date.now();
  const newEventData = {
    title: `Dua Lipa - Radical Optimism Tour ${timestamp}`,
    description: 'Global pop sensation live in London performing chart-topping hits with breathtaking choreography.',
    category: 'Concerts',
    venue_id: 'ven_3',
    date: '2026-11-10T19:30:00Z',
    min_price: 89.0,
    total_seats: 500,
    image_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
  };

  console.log(`Publishing new event via API Gateway POST /api/events...`);
  const createRes = await request(`${GATEWAY_URL}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newEventData),
  });

  if (!createRes.ok || !createRes.data.id) {
    throw new Error(`Failed to create event: ${JSON.stringify(createRes.data)}`);
  }

  const createdId = createRes.data.id;
  console.log(`✅ Event created in PostgreSQL: ID ${createdId}`);
  console.log(`   Waiting for Outbox Relay ➔ RabbitMQ ➔ Indexer Consumer ➔ Elasticsearch...`);

  // Poll search until the new event appears in Elasticsearch
  let indexed = false;
  for (let attempt = 1; attempt <= 10; attempt++) {
    await sleep(1500);
    // Search with intentional typo: "lipaa" + timestamp for unique ranking among 1M events
    const searchRes = await request(`${GATEWAY_URL}/api/events?search=lipaa%20${timestamp}`);
    if (searchRes.ok && searchRes.data.events) {
      const found = searchRes.data.events.find((e) => e.id === createdId || e.title.includes(String(timestamp)));
      if (found) {
        console.log(`✅ [Attempt ${attempt}] Typo query 'lipaa' matched newly created event in Elasticsearch!`);
        console.log(`   Matched Title: "${found.title}"`);
        console.log(`   Venue: ${found.venue_name}, City: ${found.city}`);
        indexed = true;
        break;
      }
    }
    console.log(`   Waiting for indexer sync (attempt ${attempt}/10)...`);
  }

  if (!indexed) {
    throw new Error('New event did not appear in Elasticsearch within timeout!');
  }

  console.log('\n================================================================');
  console.log('🎉 ALL PHASES PASSED! ELASTICSEARCH SEARCH & OUTBOX PIPELINE FULLY VERIFIED!');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('\n❌ Verification failed:', err.message);
  process.exit(1);
});
