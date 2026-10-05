// GET /api/reports?from=ISO&to=ISO  (ช่าง/แอดมิน) → รายการทั้งหมด ใหม่สุดอยู่บน + จำนวนครั้งที่เบอร์เคยแจ้งเท็จ
// DELETE /api/reports?id=REPORT_ID  (แอดมินเท่านั้น) → ลบงานถาวร พร้อมภาพที่แนบ
// (รวมไว้ไฟล์เดียว เพราะ Vercel แผนฟรีจำกัด 12 ฟังก์ชัน)
const { sb, requireRole, digits } = require('../lib/db');
module.exports = async (req, res) => {
  if (req.method === 'DELETE') {
    if (!(await requireRole(req, res, ['admin']))) return;
    const id = String(req.query.id || '');
    if (!id) return res.status(400).json({ error: 'ไม่มี id' });
    await sb().from('report_photos').delete().eq('report_id', id);   // schema มี on delete cascade อยู่แล้ว ลบซ้ำกันพลาด
    const { error } = await sb().from('reports').delete().eq('report_id', id);
    return error ? res.status(500).json({ error: error.message }) : res.json({ ok: true });
  }
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
