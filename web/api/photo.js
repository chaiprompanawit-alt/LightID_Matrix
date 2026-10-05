// GET /api/photo?id=<report_id>  (ช่าง/แอดมิน) → {mime, data} ภาพที่ชาวบ้านแนบ (ถูกลบเมื่อปิดงาน)
const { sb, requireRole } = require('../lib/db');
module.exports = async (req, res) => {
  if (!(await requireRole(req, res, ['admin', 'tech']))) return;
  const id = String(req.query.id || '');
  if (!id) return res.status(400).json({ error: 'ไม่มี id' });
  const { data, error } = await sb().from('report_photos').select('mime,data').eq('report_id', id).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'ไม่มีภาพ (อาจถูกลบไปแล้วเมื่อปิดงาน)' });
  res.json(data);
};
