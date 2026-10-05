// ตัวกลางเชื่อม Supabase + ค่าคงที่ที่ใช้ร่วมกันทุก API
// ใช้ service_role key เฉพาะฝั่งเซิร์ฟเวอร์ (ไม่มีทางหลุดไปหน้าเว็บ)
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const STATUS_LIST = ['แจ้งใหม่', 'รับเรื่องแล้ว', 'กำลังดำเนินการ', 'เสร็จสิ้น', 'ปิดงาน/ไม่พบปัญหา', 'แจ้งเท็จ'];
const OPEN_STATUS = ['แจ้งใหม่', 'รับเรื่องแล้ว', 'กำลังดำเนินการ'];   // ยังถือว่างานค้าง
const DONE_STATUS = ['เสร็จสิ้น', 'ปิดงาน/ไม่พบปัญหา'];                  // ถือว่าจบงาน (ใช้วัด SLA)
const MAX_REPORTS_PER_PHONE_PER_DAY = 3;
const MIN_SECONDS_TO_SUBMIT = 3;
const SLA_WORKING_DAYS = 10;
const HOTLINE = process.env.HOTLINE || '0-5383-7432';  // เบอร์ อบต.แม่ก๊า

/** ทำ SUPABASE_URL ให้เหลือแค่ https://<ref>.supabase.co (ตัด /rest/v1, ช่องว่าง, "db." ที่มักคัดลอกติดมา) */
function supabaseOrigin(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^db\.(?=[a-z0-9]+\.supabase\.co$)/, '');
    return u.protocol + '//' + host + (u.port ? ':' + u.port : '');
  } catch { return s; }
}

let _sb;
function sb() {
  if (!_sb) {
    const url = supabaseOrigin(process.env.SUPABASE_URL), key = (process.env.SUPABASE_SERVICE_KEY || '').trim();
    if (!url || !key) {
      // ทดลองในเครื่อง (npm run dev) โดยยังไม่มี Supabase → ใช้ฐานข้อมูลจำลอง; บน Vercel จริงต้องตั้งค่าเสมอ
      if (process.env.VERCEL) throw new Error('ยังไม่ได้ตั้ง SUPABASE_URL / SUPABASE_SERVICE_KEY ใน Environment Variables');
      console.warn('[dev] ไม่พบ SUPABASE_URL → ใช้ฐานข้อมูลจำลองในหน่วยความจำ');
      _sb = require('./mockdb');
    } else _sb = createClient(url, key, { auth: { persistSession: false } });
  }
  return _sb;
}

/** ลายเซ็น QR: 6 ตัวแรกของ SHA-256("QR_SECRET|pole_id") — ต้องตรงกับ docs/qr_generator.html */
function poleSig(poleId) {
  const secret = (process.env.QR_SECRET || '').trim();
  if (!secret) return '';
  return crypto.createHash('sha256').update(secret + '|' + poleId, 'utf8').digest('hex').slice(0, 6);
}
function qrValid(poleId, k) {
  const want = poleSig(poleId);
  return !want || want === String(k || '').toLowerCase();
}

/** ภาพที่ชาวบ้านแนบ: รับ data URL (หน้าเว็บย่อขนาดเป็น JPEG ให้แล้ว) → {mime, data} หรือ null ถ้าไม่ได้แนบ
 *  ตรวจ magic bytes จริง ไม่เชื่อ mime ที่ส่งมา */
const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
function parsePhoto(dataUrl) {
  if (!dataUrl) return null;
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
  if (!m) throw new Error('ไฟล์ภาพไม่ถูกต้อง กรุณาเลือกภาพใหม่ หรือส่งโดยไม่แนบภาพ');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_PHOTO_BYTES) throw new Error('ภาพใหญ่เกินไป กรุณาเลือกภาพใหม่');
  const hex = buf.subarray(0, 12).toString('hex');
  const ok = hex.startsWith('ffd8ff') || hex.startsWith('89504e47') || (hex.startsWith('52494646') && hex.slice(16) === '57454250');
  if (!ok) throw new Error('ไฟล์ภาพไม่ถูกต้อง กรุณาเลือกภาพใหม่ หรือส่งโดยไม่แนบภาพ');
  return { mime: m[1], data: m[2] };
}

/** สิทธิ์ — ดู lib/auth.js (ล็อกอินรายบุคคล) */
const { requireRole, sessionOf } = require('./auth');

/** เวลาไทย (UTC+7, ไม่มี DST) */
function bkk(d = new Date()) { return new Date(d.getTime() + 7 * 3600e3); }
function pad(n) { return String(n).padStart(2, '0'); }
function bkkDayKey(d) { const b = bkk(d); return `${b.getUTCFullYear()}${pad(b.getUTCMonth() + 1)}${pad(b.getUTCDate())}`; }
/** เที่ยงคืนของวันนี้ตามเวลาไทย (คืนเป็น Date ใน UTC) */
function bkkStartOfToday() {
  const b = bkk(); return new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) - 7 * 3600e3);
}
function newReportId() {
  const b = bkk();
  return 'R' + String(b.getUTCFullYear()).slice(2) + pad(b.getUTCMonth() + 1) + pad(b.getUTCDate()) + '-' +
    pad(b.getUTCHours()) + pad(b.getUTCMinutes()) + pad(b.getUTCSeconds()) + '-' + Math.floor(Math.random() * 900 + 100);
}

function clean(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }
function digits(v) { return String(v || '').replace(/\D/g, ''); }
function mooOf(poleId) { const p = String(poleId || '').split('/'); return p.length > 1 ? p[0] : ''; }

/** อ่าน body เป็น JSON ไม่ว่า Vercel จะ parse ให้หรือไม่ */
function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

module.exports = { sb, supabaseOrigin, STATUS_LIST, OPEN_STATUS, DONE_STATUS, MAX_REPORTS_PER_PHONE_PER_DAY, MIN_SECONDS_TO_SUBMIT,
  SLA_WORKING_DAYS, HOTLINE, poleSig, qrValid, sessionOf, requireRole, bkk, bkkDayKey, bkkStartOfToday, newReportId,
  clean, digits, mooOf, body, parsePhoto };
