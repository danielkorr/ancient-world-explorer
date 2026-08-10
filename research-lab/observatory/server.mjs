import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ResearchStore } from '../core/store.mjs';
import { buildReviewSyntheses } from '../core/review-synthesis.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const store = new ResearchStore();
const host = '127.0.0.1';
const port = Number(process.env.AWE_RESEARCH_PORT || 8787);
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
]);

function headers(contentType = 'application/json; charset=utf-8') {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
  };
}

function send(res, status, body, contentType) {
  res.writeHead(status, headers(contentType));
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 10000) throw new Error('Request body too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${host}:${port}`);
    if (req.method === 'GET' && staticFiles.has(url.pathname)) {
      const [file, type] = staticFiles.get(url.pathname);
      return send(res, 200, await readFile(path.join(root, file), 'utf8'), type);
    }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return send(res, 200, JSON.stringify({ ok: true, writes: 'research-state-only', core_write_path: false }));
    }
    if (req.method === 'GET' && url.pathname === '/api/report') {
      const report = await store.readLatest();
      return send(res, 200, JSON.stringify(report));
    }
    if (req.method === 'GET' && url.pathname === '/api/reviews') {
      return send(res, 200, JSON.stringify(await store.readReviews()));
    }
    if (req.method === 'GET' && url.pathname === '/api/review-syntheses') {
      const report = await store.readLatest();
      const reviews = await store.readReviews();
      return send(res, 200, JSON.stringify(buildReviewSyntheses(report, reviews)));
    }
    if (req.method === 'POST' && url.pathname === '/api/reviews') {
      if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
        return send(res, 415, JSON.stringify({ error: 'application/json required' }));
      }
      const body = await readBody(req);
      const report = await store.readLatest();
      const targetType = body.target_type || 'claim';
      const targetId = body.target_id || body.claim_id;
      const knownTarget = targetType === 'claim'
        ? report.claims.some((claim) => claim.id === targetId)
        : targetType === 'archaeology_lead'
          ? (report.archaeology_leads || []).some((lead) => lead.id === targetId)
          : targetType === 'evidence'
            ? report.evidence.some((item) => item.id === targetId)
            : false;
      if (!knownTarget) {
        return send(res, 400, JSON.stringify({ error: `Unknown ${targetType} target` }));
      }
      const review = await store.appendReview({
        id: randomUUID(),
        target_type: targetType,
        target_id: targetId,
        decision: body.decision,
        note: body.note,
      });
      return send(res, 201, JSON.stringify(review));
    }
    return send(res, 404, JSON.stringify({ error: 'Not found' }));
  } catch (error) {
    const status = /ENOENT/.test(String(error?.code)) ? 404 : 500;
    return send(res, status, JSON.stringify({ error: error.message }));
  }
});

server.listen(port, host, () => {
  console.log(`Research Observatory: http://${host}:${port}`);
  console.log('Isolation: review writes are restricted to research-lab/.state; core writes are unavailable.');
});
