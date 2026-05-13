/**
 * dev-api.mjs — Vite middleware plugin that exposes the lead/submission API
 * during development. Backed by a local JSON file (data/submissions.json).
 *
 * In production, you replace these three endpoints with your real backend
 * (Supabase, Postgres, Airtable, etc.). The contract stays the same:
 *
 *   POST /api/leads
 *     in:  { instrumentId, instrumentVersion, email, name, phone?, experienceYears? }
 *     out: { sessionId, attemptNumber }
 *
 *   POST /api/submissions/:sessionId
 *     in:  { responses, axisScores, quadrantId, borderline, completedAt }
 *     out: { ok: true }
 *
 *   GET /api/admin/submissions?token=...
 *     out: { submissions: [...] }
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'dev-admin-token';

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function loadDb(dbPath) {
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify({ submissions: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function saveDb(dbPath, db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function devApiPlugin({ dbPath } = {}) {
  const resolvedDbPath =
    dbPath || path.resolve(process.cwd(), 'data', 'submissions.json');

  return {
    name: 'hollywood-interview-engine-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();

        try {
          // POST /api/leads — create a new lead record, return sessionId + attemptNumber
          if (req.url === '/api/leads' && req.method === 'POST') {
            const body = await readBody(req);
            const email = normalizeEmail(body.email);
            if (!email) {
              return send(res, 400, { ok: false, message: 'Email is required.' });
            }

            const db = loadDb(resolvedDbPath);
            const priorAttempts = db.submissions.filter(
              (s) =>
                normalizeEmail(s.email) === email &&
                s.instrumentId === body.instrumentId
            );

            const record = {
              sessionId: crypto.randomUUID(),
              instrumentId: body.instrumentId,
              instrumentVersion: body.instrumentVersion,
              email,
              name: body.name || '',
              phone: body.phone || '',
              experienceYears: body.experienceYears || '',
              attemptNumber: priorAttempts.length + 1,
              startedAt: new Date().toISOString(),
              completedAt: null,
              responses: null,
              axisScores: null,
              quadrantId: null,
              borderline: null,
              userAgent: req.headers['user-agent'] || '',
            };
            db.submissions.push(record);
            saveDb(resolvedDbPath, db);

            return send(res, 200, {
              ok: true,
              sessionId: record.sessionId,
              attemptNumber: record.attemptNumber,
            });
          }

          // POST /api/submissions/:sessionId — attach results to an existing lead
          const submissionMatch = req.url.match(/^\/api\/submissions\/([^/?]+)$/);
          if (submissionMatch && req.method === 'POST') {
            const sessionId = submissionMatch[1];
            const body = await readBody(req);
            const db = loadDb(resolvedDbPath);
            const rec = db.submissions.find((s) => s.sessionId === sessionId);
            if (!rec) {
              return send(res, 404, { ok: false, message: 'Unknown sessionId.' });
            }
            rec.responses = body.responses;
            rec.axisScores = body.axisScores;
            rec.quadrantId = body.quadrantId;
            rec.borderline = body.borderline;
            rec.completedAt = body.completedAt || new Date().toISOString();
            saveDb(resolvedDbPath, db);
            return send(res, 200, { ok: true });
          }

          // GET /api/admin/submissions?token=... — list all submissions
          if (
            req.url.startsWith('/api/admin/submissions') &&
            req.method === 'GET'
          ) {
            const url = new URL(req.url, 'http://x');
            const token = url.searchParams.get('token');
            if (token !== ADMIN_TOKEN) {
              return send(res, 401, { ok: false, message: 'Invalid token.' });
            }
            const db = loadDb(resolvedDbPath);
            return send(res, 200, { ok: true, submissions: db.submissions });
          }

          return next();
        } catch (e) {
          console.error('[dev-api]', e);
          return send(res, 500, { ok: false, message: String(e) });
        }
      });
    },
  };
}
