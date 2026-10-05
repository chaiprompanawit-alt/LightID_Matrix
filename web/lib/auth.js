// ระบบล็อกอินเจ้าหน้าที่: username/password รายบุคคล (ตาราง staff_users) + session token แบบเซ็นลายเซ็น
// ไม่ต้องพึ่งบริการภายนอก ใช้ crypto ของ Node เท่านั้น
const crypto = require('crypto');
const SESSION_HOURS = 12;

function secret() {
  const s = process.env.SESSION_SECRET || process.env.ADMIN_TOKEN;
  if (!s) throw new Error('ยังไม่ได้ตั้ง SESSION_SECRET');
  return s;
}

/** รหัสผ่าน → "salt:hash" (scrypt) */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(String(pw), salt, 32).toString('hex');
}
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const got = crypto.scryptSync(String(pw), salt, 32);
  const want = Buffer.from(hash, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

/** ออก session token: base64url(payload).signature */
function issueToken(user) {
  const payload = { u: user.username, n: user.display_name, r: user.role, v: user.token_version || 0, exp: Date.now() + SESSION_HOURS * 3600e3 };
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(p).digest('base64url');
  return p + '.' + sig;
}
/** ตรวจ token → {username, name, role} หรือ null */
function verifyToken(token) {
  try {
    const [p, sig] = String(token || '').split('.');
    if (!p || !sig) return null;
    const want = crypto.createHmac('sha256', secret()).update(p).digest('base64url');
    if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
    const d = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (!d.exp || d.exp < Date.now()) return null;
    return { username: d.u, name: d.n, role: d.r, v: d.v || 0 };
  } catch { return null; }
}

/** อ่าน session จาก header Authorization: Bearer <token> แล้วเทียบกับสถานะบัญชีปัจจุบันใน staff_users ทุกครั้ง
 *  → ลบ/ปิดบัญชี/เปลี่ยนสิทธิ์/เปลี่ยนรหัส มีผลทันที (token_version ในฐานข้อมูลถูกเพิ่ม token เก่าจึงใช้ไม่ได้)
 *  บัญชี admin หลัก (ADMIN_TOKEN) ไม่มีแถวในฐานข้อมูล — เพิกถอนโดยเปลี่ยน SESSION_SECRET */
async function sessionOf(req) {
  const h = req.headers['authorization'] || '';
  const t = verifyToken(h.replace(/^Bearer\s+/i, '').trim());
  if (!t || t.username === 'admin') return t;
  const { data } = await require('./db').sb().from('staff_users')
    .select('username,display_name,role,active,token_version').eq('username', t.username).maybeSingle();
  if (!data || !data.active || (data.token_version || 0) !== t.v) return null;
  return { username: data.username, name: data.display_name, role: data.role, v: t.v };
}
/** ใช้ต้น API: คืน session หรือตอบ 401 แล้วคืน null
 *  ※ เป็น async — ต้องเรียกแบบ `if (!(await requireRole(...))) return;` เสมอ (ลืม await = Promise เป็นจริงเสมอ = ไม่ได้ตรวจสิทธิ์) */
async function requireRole(req, res, roles) {
  const s = await sessionOf(req);
  if (!s || (roles && !roles.includes(s.role))) { res.status(401).json({ error: 'unauthorized' }); return null; }
  return s;
}

module.exports = { hashPassword, verifyPassword, issueToken, verifyToken, sessionOf, requireRole, SESSION_HOURS };
