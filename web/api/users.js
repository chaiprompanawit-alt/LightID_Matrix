// จัดการบัญชีเจ้าหน้าที่ (แอดมินเท่านั้น)
// GET → รายชื่อ | POST {username, display_name, role, password?, active?} → สร้าง/แก้ | DELETE ?username= → ลบ
const { sb, body, clean } = require('../lib/db');
const A = require('../lib/auth');
module.exports = async (req, res) => {
  const s = await A.requireRole(req, res, ['admin']); if (!s) return;
  const db = sb();
  if (req.method === 'GET') {
    const { data, error } = await db.from('staff_users').select('username,display_name,role,active,created_at,last_login').order('role').order('username');
    return error ? res.status(500).json({ error: error.message }) : res.json(data);
  }
  if (req.method === 'DELETE') {
    const u = clean(req.query.username, 50).toLowerCase();
    if (u === s.username) return res.status(400).json({ error: 'ลบบัญชีตัวเองไม่ได้' });
    const { error } = await db.from('staff_users').delete().eq('username', u);
    return error ? res.status(500).json({ error: error.message }) : res.json({ ok: true });
  }
  const p = body(req);
  const username = clean(p.username, 50).toLowerCase();
  if (!/^[a-z0-9_.]{3,50}$/.test(username)) return res.status(400).json({ error: 'ชื่อผู้ใช้ใช้ a-z 0-9 _ . ยาว 3-50 ตัว' });
  if (username === 'admin') return res.status(400).json({ error: 'ชื่อ admin สงวนไว้สำหรับบัญชีหลัก' });
  if (!['admin', 'tech'].includes(p.role)) return res.status(400).json({ error: 'สิทธิ์ต้องเป็น admin หรือ tech' });
  const row = { username, display_name: clean(p.display_name, 100) || username, role: p.role, active: p.active !== false };
  const { data: exists } = await db.from('staff_users').select('username,role,active,token_version').eq('username', username).maybeSingle();
  if (p.password) {
    if (String(p.password).length < 6) return res.status(400).json({ error: 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว' });
    row.password_hash = A.hashPassword(p.password);
  } else if (!exists) return res.status(400).json({ error: 'บัญชีใหม่ต้องตั้งรหัสผ่าน' });
  // เปลี่ยนสิทธิ์ / ปิดบัญชี / ตั้งรหัสใหม่ → ตัด session เดิมของบัญชีนั้นทันที
  if (exists && (exists.role !== row.role || exists.active !== row.active || row.password_hash))
    row.token_version = (exists.token_version || 0) + 1;
  const { error } = await db.from('staff_users').upsert(row, { onConflict: 'username' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, created: !exists });
};
