/**
 * Smoke test for the dev API plugin. Exercises the three endpoints
 * by simulating Vite middleware calls without spinning up a server.
 */
import http from 'node:http';
import { devApiPlugin } from '../server/dev-api.mjs';
import fs from 'node:fs';
import path from 'node:path';

// Use a unique tmp file per run so we don't depend on cleanup succeeding.
const TMP_DB = path.resolve('data', `check-test-${Date.now()}-${process.pid}.json`);

// Build a tiny http server with the middleware so we can curl-style test
const plugin = devApiPlugin({ dbPath: TMP_DB });
const server = http.createServer((req, res) => {
  // Vite's middleware signature: (req, res, next)
  plugin.configureServer({
    middlewares: { use: (handler) => server.on('request', () => {}) },
  });
});

// Instead of using configureServer's middleware registration, replicate it inline:
const middleware = [];
plugin.configureServer({
  middlewares: { use: (h) => middleware.push(h) },
});

const realServer = http.createServer(async (req, res) => {
  let i = 0;
  const next = () => {
    if (i >= middleware.length) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    const m = middleware[i++];
    m(req, res, next);
  };
  next();
});

const PORT = 7531;
realServer.listen(PORT);

async function req(method, path, body) {
  const opts = {
    hostname: 'localhost',
    port: PORT,
    path,
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  return new Promise((resolve, reject) => {
    const r = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log('  ✓', msg);
  else {
    console.log('  ✗', msg);
    failures++;
  }
}

console.log('API smoke test:');

// 1. Create lead
const lead1 = await req('POST', '/api/leads', {
  instrumentId: 'vintage-mechanic-v1',
  instrumentVersion: 1,
  email: 'jane@example.com',
  name: 'Jane Doe',
  phone: '555-1234',
  experienceYears: '12',
});
assert(lead1.status === 200, 'POST /api/leads returns 200');
assert(!!lead1.body.sessionId, 'returns sessionId');
assert(lead1.body.attemptNumber === 1, 'first attempt is numbered 1');

// 2. Same email again — should be attempt 2
const lead2 = await req('POST', '/api/leads', {
  instrumentId: 'vintage-mechanic-v1',
  instrumentVersion: 1,
  email: 'JANE@Example.com', // case + whitespace tolerant
  name: 'Jane Doe',
});
assert(lead2.status === 200 && lead2.body.attemptNumber === 2, 'retake is numbered 2 (case-insensitive match)');

// 3. POST results to first session
const submit = await req('POST', `/api/submissions/${lead1.body.sessionId}`, {
  responses: { c1: 1, c2: 1, m1: 1, m2: 1 },
  axisScores: { curiosity: 0.83, mastery: 0.67 },
  quadrantId: 'vintage-specialist',
  borderline: false,
  completedAt: new Date().toISOString(),
});
assert(submit.status === 200 && submit.body.ok, 'POST /api/submissions/:id attaches results');

// 4. Admin auth — wrong token rejected
const adminBad = await req('GET', '/api/admin/submissions?token=wrong');
assert(adminBad.status === 401, 'admin endpoint rejects bad token');

// 5. Admin auth — correct token returns rows
const adminGood = await req('GET', '/api/admin/submissions?token=dev-admin-token');
assert(adminGood.status === 200, 'admin endpoint accepts correct token');
assert(adminGood.body.submissions.length === 2, 'admin endpoint returns 2 records');
assert(
  adminGood.body.submissions[0].quadrantId === 'vintage-specialist',
  'first record has the result attached'
);
assert(
  adminGood.body.submissions[1].completedAt === null,
  'second record (incomplete retake) has null completedAt'
);
assert(
  adminGood.body.submissions[1].attemptNumber === 2,
  'retake attemptNumber is 2'
);

// 6. Unknown sessionId rejected
const ghost = await req('POST', '/api/submissions/not-real', { responses: {} });
assert(ghost.status === 404, 'unknown sessionId returns 404');

realServer.close();
try {
  if (fs.existsSync(TMP_DB)) fs.unlinkSync(TMP_DB);
} catch (_e) {
  // best-effort cleanup; not fatal
}

console.log('');
if (failures === 0) {
  console.log('✓ All API checks passed.');
  process.exit(0);
} else {
  console.log(`✗ ${failures} API check(s) failed.`);
  process.exit(1);
}
