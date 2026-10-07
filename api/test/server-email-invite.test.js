import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = crypto.randomBytes(32).toString('hex');
const ADMIN = 'admin-email-invite';
const ORIGIN = 'http://localhost:8080';

function session(uid) {
  const payload = `${uid}:${Date.now() + 86400000}:0`;
  return payload + '.' + crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

async function listen(server) {
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  return server.address().port;
}

test('admin e-mail invite creates a login, sends it once, and rolls back failed delivery', async t => {
  const deliveries = [];
  const mail = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw); deliveries.push({ auth: req.headers.authorization, body });
    if (body.to.includes('fail@example.com')) {
      res.writeHead(422, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'test refusal' }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: 'email_123' }));
  });
  const mailPort = await listen(mail); t.after(() => mail.close());

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-email-invite-'));
  fs.writeFileSync(path.join(dataDir, 'secret'), SECRET, { mode: 0o600 });
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({
    users: [{ id: ADMIN, name: 'Admin', admin: true, created: new Date().toISOString() }],
    creds: [], subs: [], invites: []
  }));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN, RP_ID: 'localhost',
      PASSWORD_LOGIN: '1', RESEND_API_KEY: 're_test_key', RESEND_FROM_EMAIL: 'openGym <gym@example.com>',
      RESEND_API_URL: `http://127.0.0.1:${mailPort}/emails`, AUDIT_LOG: '1'
    }
  });
  let log = ''; child.stdout.on('data', d => log += d); child.stderr.on('data', d => log += d);
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const api = `http://127.0.0.1:${await boundPort(child, () => log)}`;
  const request = async (method, url, body, cookie = `gymsid=${session(ADMIN)}`) => {
    const r = await fetch(api + url, {
      method, headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: r.status, body: await r.json(), headers: r.headers };
  };

  const users = await request('GET', '/api/admin/users');
  assert.equal(users.body.email_invites, true);

  const made = await request('POST', '/api/admin/invites/email', { name: 'Ana Perez', email: 'ana@example.com' });
  assert.equal(made.status, 200);
  assert.equal(made.body.email, 'ana@example.com');
  assert.equal(made.body.delivery, 'email_123');
  assert.equal(deliveries[0].auth, 'Bearer re_test_key');
  assert.match(deliveries[0].body.text, /https?:\/\/localhost:8080/);
  const password = /^Contraseña inicial: (.+)$/m.exec(deliveries[0].body.text)[1];
  assert.equal(password.length, 24);

  let db = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  const ana = db.users.find(u => u.email === 'ana@example.com');
  assert.ok(ana?.pw?.h); assert.equal(JSON.stringify(ana).includes(password), false);
  assert.equal(db.invites.find(i => i.usedBy === ana.id)?.note, 'Sent by e-mail');

  const login = await request('POST', '/api/login/password', { identifier: 'ana@example.com', password }, '');
  assert.equal(login.status, 200); assert.equal(login.body.user.name, 'Ana Perez');

  const failed = await request('POST', '/api/admin/invites/email', { name: 'Failed', email: 'fail@example.com' });
  assert.equal(failed.status, 502); assert.equal(failed.body.code, 'email-delivery');
  db = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  assert.equal(db.users.some(u => u.email === 'fail@example.com'), false);
  assert.equal(db.invites.some(i => i.usedBy && !db.users.some(u => u.id === i.usedBy)), false);
});
