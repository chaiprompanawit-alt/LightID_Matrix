// GET /api/reports?from=ISO&to=ISO  (ช่าง/แอดมิน) → รายการทั้งหมด ใหม่สุดอยู่บน + จำนวนครั้งที่เบอร์เคยแจ้งเท็จ
const { sb, requireRole, digits } = require('../lib/db');
module.exports = async (req, res) => {
  if (!(await requireRole(req, res, ['admin', 'tech']))) return;
  let q = sb().from('reports').select('*').order('created_at', { ascending: false }).limit(3000);
  if (req.query.from) q = q.gte('created_at', req.query.from);
  if (req.query.to) q = q.lte('created_at', req.query.to);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  // เบอร์ที่เคยถูกตีเป็น "แจ้งเท็จ" (ดูทั้งประวัติ ไม่ใช่แค่ช่วงที่กรอง)
  const { data: fakes } = await sb().from('reports').select('reporter_phone').eq('status', 'แจ้งเท็จ');
  const fake = {};
  (fakes || []).forEach(r => { const d = digits(r.reporter_phone); fake[d] = (fake[d] || 0) + 1; });
  data.forEach(r => { r.fake_count = fake[digits(r.reporter_phone)] || 0; });
  res.json(data);
};
