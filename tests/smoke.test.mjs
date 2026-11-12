import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const dataDir = mkdtempSync(path.join(tmpdir(), 'agenta-repair-test-'));
let child;

async function start() {
  child = spawn(process.execPath, ['server/server.mjs'], { cwd: root, env: { ...process.env, PORT: String(port), DATA_DIR: dataDir }, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`Сервер завершился: ${child.exitCode}`);
    try { const res = await fetch(`${base}/api/demo-users`); if (res.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Сервер не запустился');
}
async function stop() {
  if (!child) return;
  const previous = child;
  child = null;
  previous.kill();
  await new Promise(resolve => previous.once('exit', resolve));
}
async function call(pathname, { method = 'GET', cookie, body } = {}) {
  const response = await fetch(`${base}/api${pathname}`, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
async function login(userId) { return call('/session', { method: 'POST', body: { userId } }); }

test('баннер, роли и SQLite переживают перезапуск', async () => {
  try {
    await start();
    const first = await login('agent-1');
    assert.equal(first.body.showBanner, true);
    await call('/banner/dismiss', { method: 'POST', cookie: first.cookie });
    const afterDismiss = await login('agent-1');
    assert.equal(afterDismiss.body.showBanner, false);
    const requestInput = {
      clientName: 'Тестовый клиент', clientPhone: '+7 900 000-00-00', city: 'Казань', vehicleMake: 'Lada',
      vehicleModel: 'Vesta', vehiclePlate: 'А000АА 16', vehicleYear: 2022,
      damageDescription: 'Тестовое повреждение переднего бампера'
    };
    assert.equal((await call('/requests', { method: 'POST', cookie: afterDismiss.cookie, body: { ...requestInput, repairType: 'other' } })).status, 400);
    assert.equal((await call('/requests', { method: 'POST', cookie: afterDismiss.cookie, body: { ...requestInput, city: '', repairType: 'osago' } })).status, 400);
    const created = await call('/requests', { method: 'POST', cookie: afterDismiss.cookie, body: { ...requestInput, repairType: 'osago' } });
    assert.equal(created.status, 201);
    const id = created.body.id;
    assert.equal((await call(`/requests/${id}`, { cookie: afterDismiss.cookie })).body.repair_type, 'ОСАГО');
    assert.equal((await call(`/requests/${id}`, { cookie: afterDismiss.cookie })).body.city, 'Казань');
    assert.equal((await call(`/requests/${id}`, { cookie: afterDismiss.cookie })).body.bonus_percent, 1);
    for (const [repairType, label, percent] of [['kasko', 'КАСКО', 2], ['commercial', 'Коммерческий ремонт', 3]]) {
      const next = await call('/requests', { method: 'POST', cookie: afterDismiss.cookie, body: { ...requestInput, repairType } });
      assert.equal(next.status, 201);
      const detail = await call(`/requests/${next.body.id}`, { cookie: afterDismiss.cookie });
      assert.equal(detail.body.repair_type, label);
      assert.equal(detail.body.bonus_percent, percent);
    }
    assert.equal((await call('/requests', { cookie: afterDismiss.cookie })).body.length, 3);
    const other = await login('agent-2');
    assert.equal(other.body.showBanner, true);
    assert.equal((await call('/requests', { cookie: other.cookie })).body.length, 0);
    assert.equal((await call(`/requests/${id}`, { cookie: other.cookie })).status, 403);
    assert.equal((await call(`/requests/${id}/status`, { method: 'PATCH', cookie: afterDismiss.cookie, body: { status: 'В работе' } })).status, 403);
    const admin = await login('admin-1');
    assert.equal((await call('/requests', { cookie: admin.cookie })).body.length, 3);
    assert.equal((await call(`/requests/${id}/status`, { method: 'PATCH', cookie: admin.cookie, body: { status: 'Произвольный' } })).status, 400);
    assert.equal((await call(`/requests/${id}/status`, { method: 'PATCH', cookie: admin.cookie, body: { status: 'В работе' } })).status, 200);
    assert.equal((await call(`/requests/${id}`, { cookie: admin.cookie })).body.status, 'В работе');
    await stop();
    await start();
    const afterRestart = await login('agent-1');
    assert.equal(afterRestart.body.showBanner, false);
    assert.equal((await call('/requests', { cookie: afterRestart.cookie })).body.length, 3);
    assert.equal((await call(`/requests/${id}`, { cookie: afterRestart.cookie })).body.status, 'В работе');
    assert.equal((await call(`/requests/${id}`, { cookie: afterRestart.cookie })).body.repair_type, 'ОСАГО');
  } finally {
    await stop();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
