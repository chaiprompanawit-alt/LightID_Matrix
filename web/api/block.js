// บัญชีดำเบอร์โทร — GET รายการ / POST {phone, reason} บล็อก / DELETE ?phone= ปลดบล็อก (แอดมินเท่านั้น)
const { sb, requireRole, body, digits, clean } = require('../lib/db');
module.exports = async (req, res) => {
  if (!(await requireRole(req, res, ['admin']))) return;
  const db = sb();
  if (req.method === 'GET') {
    const { data, error } = await db.from('blocklist').select('*').order('blocked_at', { ascending: false });
    return error ? res.status(500).json({ error: error.message }) : res.json(data);
  }
  if (req.method === 'DELETE') {
    const { error } = await db.from('blocklist').delete().eq('phone', digits(req.query.phone));
    return error ? res.status(500).json({ error: error.message }) : res.json({ ok: true });
  }
  const p = body(req), phone = digits(p.phone);
  if (phone.length < 9) return res.status(400).json({ error: 'เบอร์ไม่ถูกต้อง' });
  const { error } = await db.from('blocklist').upsert({ phone, reason: clean(p.reason, 200) || 'แจ้งเท็จซ้ำ' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
};
