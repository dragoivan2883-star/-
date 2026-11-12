import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { cities, availableInsurers } from '../shared/requestOptions.mjs';
import { mailMode, sendRequestEmail } from './mail.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, 'data');
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'prototype.sqlite'));
db.exec(`PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('agent','admin')),
  banner_closed_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS repair_requests (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
  client_name TEXT NOT NULL, client_phone TEXT NOT NULL, city TEXT NOT NULL DEFAULT '',
  vehicle_make TEXT NOT NULL, vehicle_model TEXT NOT NULL, vehicle_plate TEXT NOT NULL,
  vehicle_year INTEGER, damage_description TEXT NOT NULL,
  repair_type TEXT NOT NULL DEFAULT 'Не указан', bonus_percent INTEGER, insurer TEXT,
  status TEXT NOT NULL DEFAULT 'Новая', created_at TEXT NOT NULL,
  email_status TEXT NOT NULL DEFAULT 'disabled', email_sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_requests_owner ON repair_requests(owner_id, created_at);`);
const requestColumns = new Set(db.prepare('PRAGMA table_info(repair_requests)').all().map(column => column.name));
if (!requestColumns.has('city')) db.exec("ALTER TABLE repair_requests ADD COLUMN city TEXT NOT NULL DEFAULT ''");
if (!requestColumns.has('repair_type')) db.exec("ALTER TABLE repair_requests ADD COLUMN repair_type TEXT NOT NULL DEFAULT 'Не указан'");
if (!requestColumns.has('bonus_percent')) db.exec('ALTER TABLE repair_requests ADD COLUMN bonus_percent INTEGER');
if (!requestColumns.has('insurer')) db.exec('ALTER TABLE repair_requests ADD COLUMN insurer TEXT');
if (!requestColumns.has('email_status')) db.exec("ALTER TABLE repair_requests ADD COLUMN email_status TEXT NOT NULL DEFAULT 'disabled'");
if (!requestColumns.has('email_sent_at')) db.exec('ALTER TABLE repair_requests ADD COLUMN email_sent_at TEXT');

const demoUsers = [
  ['agent-1', 'Демо: Агент 1', 'agent'],
  ['agent-2', 'Демо: Агент 2', 'agent'],
  ['admin-1', 'Демо: Администратор', 'admin']
];
const addUser = db.prepare('INSERT OR IGNORE INTO users (id,name,role) VALUES (?,?,?)');
for (const user of demoUsers) addUser.run(...user);

const userById = db.prepare('SELECT id,name,role,banner_closed_at FROM users WHERE id=?');
const userByToken = db.prepare('SELECT u.id,u.name,u.role,u.banner_closed_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?');
const insertSession = db.prepare('INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,?)');
const deleteSession = db.prepare('DELETE FROM sessions WHERE token=?');
const updateBanner = db.prepare('UPDATE users SET banner_closed_at=? WHERE id=?');
const requestCount = db.prepare('SELECT count(*) AS count FROM repair_requests WHERE owner_id=?');
const insertRequest = db.prepare(`INSERT INTO repair_requests
  (id,owner_id,client_name,client_phone,city,vehicle_make,vehicle_model,vehicle_plate,vehicle_year,damage_description,repair_type,bonus_percent,insurer,status,created_at,email_status)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'Новая',?,?)`);
const updateEmailStatus = db.prepare('UPDATE repair_requests SET email_status=?, email_sent_at=? WHERE id=?');
const allRequests = db.prepare(`SELECT r.id,r.owner_id,u.name AS owner_name,r.client_name,r.city,r.vehicle_make,r.vehicle_model,r.vehicle_plate,r.repair_type,r.bonus_percent,r.insurer,r.status,r.created_at
  FROM repair_requests r JOIN users u ON u.id=r.owner_id ORDER BY r.created_at DESC`);
const ownRequests = db.prepare(`SELECT r.id,r.owner_id,u.name AS owner_name,r.client_name,r.city,r.vehicle_make,r.vehicle_model,r.vehicle_plate,r.repair_type,r.bonus_percent,r.insurer,r.status,r.created_at
  FROM repair_requests r JOIN users u ON u.id=r.owner_id WHERE r.owner_id=? ORDER BY r.created_at DESC`);
const requestById = db.prepare(`SELECT r.*,u.name AS owner_name FROM repair_requests r JOIN users u ON u.id=r.owner_id WHERE r.id=?`);
const updateRequestStatus = db.prepare('UPDATE repair_requests SET status=? WHERE id=?');
const allowedStatuses = new Set(['Новая', 'В работе', 'Ожидает клиента', 'Завершена', 'Отменена']);
const repairTypes = new Map([
  ['osago', { label: 'ОСАГО', percent: 1 }],
  ['kasko', { label: 'КАСКО', percent: 2 }],
  ['commercial', { label: 'Коммерческий ремонт', percent: 3 }]
]);

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
function cookieToken(req) {
  return /(?:^|; )repair_demo_session=([^;]+)/.exec(req.headers.cookie || '')?.[1] || null;
}
function currentUser(req) {
  const token = cookieToken(req);
  return token ? userByToken.get(token) : null;
}
async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 20_000) throw new Error('Слишком большой запрос');
  }
  try { return JSON.parse(body || '{}'); } catch { throw new Error('Неверный JSON'); }
}
function clean(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function sessionView(user) {
  if (!user) return { user: null, showBanner: false };
  const hasRequest = requestCount.get(user.id).count > 0;
  const elapsed = user.banner_closed_at ? Date.now() - Date.parse(user.banner_closed_at) : Infinity;
  return { user: { id: user.id, name: user.name, role: user.role }, showBanner: user.role === 'agent' && !hasRequest && elapsed >= 48 * 60 * 60 * 1000 };
}

const vite = await createViteServer({ root, server: { middlewareMode: true }, appType: 'spa' });
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname;
  if (!pathname.startsWith('/api/')) return vite.middlewares(req, res);
  try {
    if (req.method === 'GET' && pathname === '/api/demo-users') {
      return send(res, 200, demoUsers.map(([id, name, role]) => ({ id, name, role })));
    }
    if (req.method === 'POST' && pathname === '/api/session') {
      const { userId } = await readJson(req);
      const user = userById.get(userId);
      if (!user) return send(res, 400, { error: 'Неизвестный демонстрационный пользователь' });
      const oldToken = cookieToken(req);
      if (oldToken) deleteSession.run(oldToken);
      const token = randomBytes(32).toString('hex');
      insertSession.run(token, user.id, new Date().toISOString());
      res.setHeader('Set-Cookie', `repair_demo_session=${token}; HttpOnly; SameSite=Strict; Path=/`);
      return send(res, 200, sessionView(user));
    }
    if (req.method === 'DELETE' && pathname === '/api/session') {
      const token = cookieToken(req);
      if (token) deleteSession.run(token);
      res.setHeader('Set-Cookie', 'repair_demo_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/');
      return send(res, 200, { user: null, showBanner: false });
    }
    const user = currentUser(req);
    if (req.method === 'GET' && pathname === '/api/session') return send(res, 200, sessionView(user));
    if (!user) return send(res, 401, { error: 'Выберите демонстрационного пользователя' });
    if (req.method === 'POST' && pathname === '/api/banner/dismiss') {
      if (user.role !== 'agent') return send(res, 403, { error: 'Недоступно' });
      updateBanner.run(new Date().toISOString(), user.id);
      return send(res, 200, { showBanner: false });
    }
    if (req.method === 'GET' && pathname === '/api/requests') {
      return send(res, 200, user.role === 'admin' ? allRequests.all() : ownRequests.all(user.id));
    }
    if (req.method === 'POST' && pathname === '/api/requests') {
      if (user.role !== 'agent') return send(res, 403, { error: 'Заявку создаёт агент' });
      const input = await readJson(req);
      const fields = {
        clientName: clean(input.clientName, 120), clientPhone: clean(input.clientPhone, 30), city: clean(input.city, 100),
        vehicleMake: clean(input.vehicleMake, 80), vehicleModel: clean(input.vehicleModel, 80),
        vehiclePlate: clean(input.vehiclePlate, 20).toUpperCase(),
        damageDescription: clean(input.damageDescription, 2000)
      };
      if (Object.values(fields).some(x => !x) || !/^\+?[\d\s()\-]{10,20}$/.test(fields.clientPhone)) {
        return send(res, 400, { error: 'Заполните все обязательные поля и проверьте телефон' });
      }
      const repairType = repairTypes.get(input.repairType);
      if (!repairType) return send(res, 400, { error: 'Выберите вид ремонта' });
      if (!cities.includes(fields.city)) return send(res, 400, { error: 'Выберите Казань, Нижнекамск или Набережные Челны' });
      const insurer = clean(input.insurer, 80);
      if (input.repairType === 'commercial') {
        if (insurer) return send(res, 400, { error: 'Для коммерческого ремонта страховая компания не выбирается' });
      } else if (!availableInsurers(input.repairType, fields.city).includes(insurer)) {
        return send(res, 400, { error: 'Страховая компания недоступна для выбранного вида ремонта и города' });
      }
      const vehicleYear = input.vehicleYear === '' || input.vehicleYear == null ? null : Number(input.vehicleYear);
      if (vehicleYear !== null && (!Number.isInteger(vehicleYear) || vehicleYear < 1950 || vehicleYear > new Date().getFullYear() + 1)) {
        return send(res, 400, { error: 'Проверьте год выпуска' });
      }
      const id = randomUUID();
      insertRequest.run(id, user.id, fields.clientName, fields.clientPhone, fields.city, fields.vehicleMake, fields.vehicleModel,
        fields.vehiclePlate, vehicleYear, fields.damageDescription, repairType.label, repairType.percent, insurer || null, new Date().toISOString(), mailMode === 'off' ? 'disabled' : 'pending');
      if (mailMode !== 'off') {
        try {
          await sendRequestEmail({ id, agentName: user.name, ...fields, vehicleYear, repairType: repairType.label, bonusPercent: repairType.percent, insurer });
          updateEmailStatus.run('sent', new Date().toISOString(), id);
        } catch (error) {
          updateEmailStatus.run('failed', null, id);
          console.error(`Почтовое уведомление по заявке ${id} не отправлено: ${error.code || error.message}`);
        }
      }
      return send(res, 201, { id, emailStatus: mailMode === 'off' ? 'disabled' : requestById.get(id).email_status });
    }
    const statusMatch = /^\/api\/requests\/([a-f0-9-]+)\/status$/.exec(pathname);
    if (req.method === 'PATCH' && statusMatch) {
      if (user.role !== 'admin') return send(res, 403, { error: 'Статус заявки меняет только администратор' });
      const { status } = await readJson(req);
      if (!allowedStatuses.has(status)) return send(res, 400, { error: 'Недопустимый статус заявки' });
      const row = requestById.get(statusMatch[1]);
      if (!row) return send(res, 404, { error: 'Заявка не найдена' });
      updateRequestStatus.run(status, row.id);
      return send(res, 200, { id: row.id, status });
    }
    const detailMatch = /^\/api\/requests\/([a-f0-9-]+)$/.exec(pathname);
    if (req.method === 'GET' && detailMatch) {
      const row = requestById.get(detailMatch[1]);
      if (!row) return send(res, 404, { error: 'Заявка не найдена' });
      if (user.role !== 'admin' && row.owner_id !== user.id) return send(res, 403, { error: 'Нет доступа к заявке' });
      return send(res, 200, row);
    }
    return send(res, 404, { error: 'Маршрут не найден' });
  } catch (error) {
    return send(res, error.message === 'Неверный JSON' || error.message === 'Слишком большой запрос' ? 400 : 500, { error: error.message });
  }
});
const port = Number(process.env.PORT || 4174);
server.listen(port, '127.0.0.1', () => console.log(`Локальный прототип: http://127.0.0.1:${port}`));
