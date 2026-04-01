/**
 * Integration Test Suite for Contacts, Reminders, Outreach, Email Logs, and Timeline
 * Tests all CRUD operations and tab loading functionality
 */

const http = require("http");

const BASE_URL = "http://localhost:3001";
let testResults = {
  passed: 0,
  failed: 0,
  tests: [],
};

// Helper to make HTTP requests
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: { "Content-Type": "application/json" },
    };

    const req = http.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: { raw: data } });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Test helper
async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    testResults.passed++;
    testResults.tests.push({ name, status: "PASS" });
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`);
    testResults.failed++;
    testResults.tests.push({ name, status: "FAIL", error: err.message });
  }
}

// Wait for server to be ready
async function waitForServer(maxRetries = 20) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await makeRequest("GET", "/health");
      if (res.status === 200) {
        console.log("✓ Server is ready\n");
        return;
      }
    } catch (e) {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Server did not start in time");
}

// ============================================================================
// CONTACTS TESTS
// ============================================================================

let contactId = null;

async function testContacts() {
  console.log("\n=== CONTACTS TESTS ===\n");

  // Create contact
  await test("Create contact", async () => {
    const res = await makeRequest("POST", "/contacts", {
      name: "John Recruiter",
      email: "john@example.com",
      company: "Tech Corp",
      role: "Recruiter",
      linkedinUrl: "https://linkedin.com/in/john",
      notes: "Great contact",
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body?.contact?.id) throw new Error("No contact ID returned");
    contactId = res.body.contact.id;
  });

  // Get contacts
  await test("Get contacts list", async () => {
    const res = await makeRequest("GET", "/contacts");
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.body?.contacts))
      throw new Error("contacts is not an array");
  });

  // Get contacts with filter
  await test("Get contacts with name filter", async () => {
    const res = await makeRequest("GET", "/contacts?name=John");
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.body?.contacts))
      throw new Error("contacts is not an array");
  });

  // Update contact
  await test("Update contact", async () => {
    const res = await makeRequest("PATCH", `/contacts/${contactId}`, {
      email: "john.updated@example.com",
      notes: "Updated contact",
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body?.contact?.id) throw new Error("No contact returned");
  });

  // Delete contact
  await test("Delete contact", async () => {
    const res = await makeRequest("DELETE", `/contacts/${contactId}`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // Verify deletion
  await test("Verify contact deleted", async () => {
    const res = await makeRequest("GET", `/contacts?name=John`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const found = res.body?.contacts?.some((c) => c.id === contactId);
    if (found) throw new Error("Contact still exists after deletion");
  });
}

// ============================================================================
// REMINDERS TESTS
// ============================================================================

let reminderId = null;

async function testReminders() {
  console.log("\n=== REMINDERS TESTS ===\n");

  // Create reminder
  await test("Create reminder", async () => {
    const res = await makeRequest("POST", "/reminders", {
      title: "Follow up with company",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      notes: "Test reminder",
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body?.reminder?.id) throw new Error("No reminder ID returned");
    reminderId = res.body.reminder.id;
  });

  // Get reminders
  await test("Get reminders list", async () => {
    const res = await makeRequest("GET", "/reminders");
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.body?.reminders))
      throw new Error("reminders is not an array");
  });

  // Get reminders with filter (not done)
  await test("Get reminders filtered by isDone=false", async () => {
    const res = await makeRequest("GET", "/reminders?isDone=false");
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.body?.reminders))
      throw new Error("reminders is not an array");
  });

  // Update reminder
  await test("Update reminder status", async () => {
    const res = await makeRequest("PATCH", `/reminders/${reminderId}`, {
      isDone: true,
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body?.reminder?.id) throw new Error("No reminder returned");
  });

  // Verify update
  await test("Verify reminder is marked done", async () => {
    const res = await makeRequest("GET", "/reminders");
    const reminder = res.body?.reminders?.find((r) => r.id === reminderId);
    if (!reminder) throw new Error("Reminder not found");
    if (!reminder.is_done) throw new Error("Reminder not marked as done");
  });

  // Delete reminder
  await test("Delete reminder", async () => {
    const res = await makeRequest("DELETE", `/reminders/${reminderId}`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // Verify deletion
  await test("Verify reminder deleted", async () => {
    const res = await makeRequest("GET", "/reminders");
    const found = res.body?.reminders?.find((r) => r.id === reminderId);
    if (found) throw new Error("Reminder still exists after deletion");
  });
}

// ============================================================================
// OUTREACH TESTS
// ============================================================================

let outreachId = null;

async function testOutreach() {
  console.log("\n=== OUTREACH TESTS ===\n");

  // Create outreach
  await test("Create outreach", async () => {
    const res = await makeRequest("POST", "/outreach", {
      type: "email",
      message: "Test outreach message",
      sentAt: new Date().toISOString(),
      notes: "Initial outreach",
      responseReceived: false,
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body?.outreach?.id) throw new Error("No outreach ID returned");
    outreachId = res.body.outreach.id;
  });

  // Get outreach
  await test("Get outreach list", async () => {
    const res = await makeRequest("GET", "/outreach");
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.body?.outreach))
      throw new Error("outreach is not an array");
  });

  // Get outreach with type filter
  await test("Get outreach filtered by type=email", async () => {
    const res = await makeRequest("GET", "/outreach?type=email");
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.body?.outreach))
      throw new Error("outreach is not an array");
  });

  // Update outreach
  await test("Update outreach response status", async () => {
    const res = await makeRequest("PATCH", `/outreach/${outreachId}`, {
      responseReceived: true,
      notes: "Received response",
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body?.outreach?.id) throw new Error("No outreach returned");
  });

  // Verify update
  await test("Verify outreach marked as received", async () => {
    const res = await makeRequest("GET", "/outreach");
    const entry = res.body?.outreach?.find((o) => o.id === outreachId);
    if (!entry) throw new Error("Outreach not found");
    if (!entry.response_received)
      throw new Error("Outreach response_received not updated");
  });

  // Delete outreach
  await test("Delete outreach", async () => {
    const res = await makeRequest("DELETE", `/outreach/${outreachId}`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // Verify deletion
  await test("Verify outreach deleted", async () => {
    const res = await makeRequest("GET", "/outreach");
    const found = res.body?.outreach?.find((o) => o.id === outreachId);
    if (found) throw new Error("Outreach still exists after deletion");
  });
}

// ============================================================================
// JOB EMAIL LOG TESTS
// ============================================================================

async function testEmailLog() {
  console.log("\n=== JOB EMAIL LOG TESTS ===\n");

  // First, fetch jobs to get a valid job ID
  let testJobId = null;

  await test("Get jobs list", async () => {
    const res = await makeRequest("GET", "/jobs");
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.body?.jobs))
      throw new Error("jobs is not an array");
    if (res.body.jobs.length === 0) {
      console.log("  [info] No jobs exist for email log test");
      return;
    }
    testJobId = res.body.jobs[0].id;
  });

  if (!testJobId) {
    console.log("  [skip] No job ID available for email log test\n");
    return;
  }

  // Get job emails
  await test(`Get job emails for job ${testJobId}`, async () => {
    const res = await makeRequest("GET", `/jobs/${testJobId}/emails`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.body?.emails))
      throw new Error("emails is not an array");
  });
}

// ============================================================================
// TIMELINE TESTS
// ============================================================================

async function testTimeline() {
  console.log("\n=== TIMELINE TESTS ===\n");

  // First, fetch jobs to get a valid job ID
  let testJobId = null;

  await test("Get jobs list for timeline", async () => {
    const res = await makeRequest("GET", "/jobs");
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.body?.jobs))
      throw new Error("jobs is not an array");
    if (res.body.jobs.length === 0) {
      console.log("  [info] No jobs exist for timeline test");
      return;
    }
    testJobId = res.body.jobs[0].id;
  });

  if (!testJobId) {
    console.log("  [skip] No job ID available for timeline test\n");
    return;
  }

  // Get job timeline
  await test(`Get job status timeline for job ${testJobId}`, async () => {
    const res = await makeRequest("GET", `/jobs/timeline/${testJobId}`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.body?.timeline))
      throw new Error("timeline is not an array");
  });
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTests() {
  console.log("Starting integration tests...\n");

  try {
    await waitForServer();

    await testContacts();
    await testReminders();
    await testOutreach();
    await testEmailLog();
    await testTimeline();

    // Print summary
    console.log("\n=== TEST SUMMARY ===\n");
    console.log(`Passed: ${testResults.passed}`);
    console.log(`Failed: ${testResults.failed}`);
    console.log(`Total:  ${testResults.passed + testResults.failed}\n`);

    if (testResults.failed > 0) {
      console.log("Failed tests:");
      testResults.tests
        .filter((t) => t.status === "FAIL")
        .forEach((t) => {
          console.log(`  - ${t.name}: ${t.error}`);
        });
    }

    process.exit(testResults.failed > 0 ? 1 : 0);
  } catch (err) {
    console.error("Test suite error:", err.message);
    process.exit(1);
  }
}

runTests();
