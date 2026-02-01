#!/usr/bin/env node

/**
 * Simple API Test Script
 * Tests various endpoints and parameters
 */

const BASE_URL = "http://localhost:3000";

// Test cases
const tests = [
  {
    name: "Health Check",
    url: `${BASE_URL}/health`,
    expectJSON: true,
  },
  {
    name: "Documentation Page",
    url: `${BASE_URL}/`,
    expectHTML: true,
  },
  {
    name: "Basic Graph",
    url: `${BASE_URL}/api/graph?username=spectrewolf8`,
    expectPNG: true,
  },
  {
    name: "Graph with Stats",
    url: `${BASE_URL}/api/graph?username=spectrewolf8&stats=true`,
    expectPNG: true,
  },
  {
    name: "Graph with Year Parameter",
    url: `${BASE_URL}/api/graph?username=spectrewolf8&year=2025`,
    expectPNG: true,
  },
  {
    name: "Graph with Credit",
    url: `${BASE_URL}/api/graph?username=spectrewolf8&credit=true`,
    expectPNG: true,
  },
  {
    name: "Missing Username",
    url: `${BASE_URL}/api/graph`,
    expectError: true,
  },
  {
    name: "Cache Hit (Second Request)",
    url: `${BASE_URL}/api/graph?username=spectrewolf8`,
    expectPNG: true,
    expectCacheHit: true,
  },
];

async function runTest(test) {
  try {
    const startTime = Date.now();
    const response = await fetch(test.url);
    const duration = Date.now() - startTime;

    const contentType = response.headers.get("content-type");
    const cacheStatus = response.headers.get("x-cache");

    let status = "✅ PASS";
    let details = [];

    // Check content type
    if (test.expectJSON && !contentType.includes("application/json")) {
      status = "❌ FAIL";
      details.push(`Expected JSON, got ${contentType}`);
    }

    if (test.expectHTML && !contentType.includes("text/html")) {
      status = "❌ FAIL";
      details.push(`Expected HTML, got ${contentType}`);
    }

    if (test.expectPNG && !contentType.includes("image/png")) {
      status = "❌ FAIL";
      details.push(`Expected PNG, got ${contentType}`);
    }

    // Check status code
    if (test.expectError && response.ok) {
      status = "❌ FAIL";
      details.push(`Expected error, got ${response.status}`);
    }

    if (!test.expectError && !response.ok) {
      status = "❌ FAIL";
      details.push(`Expected success, got ${response.status}`);
    }

    // Check cache
    if (test.expectCacheHit && cacheStatus !== "HIT") {
      status = "⚠️  WARN";
      details.push(`Expected cache HIT, got ${cacheStatus}`);
    }

    // Log result
    console.log(
      `${status} ${test.name} (${duration}ms) ${cacheStatus ? `[${cacheStatus}]` : ""}`,
    );
    if (details.length > 0) {
      details.forEach((d) => console.log(`   └─ ${d}`));
    }

    return status === "✅ PASS";
  } catch (error) {
    console.log(`❌ FAIL ${test.name}`);
    console.log(`   └─ ${error.message}`);
    return false;
  }
}

async function main() {
  console.log("🧪 Running API Tests\n");
  console.log(`Target: ${BASE_URL}\n`);

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await runTest(test);
    if (result) {
      passed++;
    } else {
      failed++;
    }
    // Small delay between tests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Total: ${tests.length} tests`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`${"=".repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
