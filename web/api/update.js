// POST /api/update {report_id, status, assigned_to, staff_note} (ช่าง/แอดมิน)
const { sb, requireRole, body, STATUS_LIST, OPEN_STATUS, DONE_STATUS, clean } = require('../lib/db');
module.exports = async (req, res) => {
  const me = requireRole(req, res, ['admin', 'tech']); if (!me) return;
  const p = body(req);
  if (!p.report_id) return res.status(400).json({ error: 'ไม่มี report_id' });
  if (p.status && !STATUS_LIST.includes(p.status)) return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });

  const patch = { updated_at: new Date().toISOString() };
  if (p.status) patch.status = p.status;
  if (p.assigned_to !== undefined) patch.assigned_to = clean(p.assigned_to, 100);
  // ช่างกดรับเรื่องโดยไม่พิมพ์ชื่อ → ใส่ชื่อคนล็อกอินให้อัตโนมัติ
  if (p.status && p.status !== 'แจ้งใหม่' && !patch.assigned_to) patch.assigned_to = me.name;
  if (p.staff_note !== undefined) patch.staff_note = clean(p.staff_note, 1000);
  // บันทึกเวลาจบงานครั้งแรก (ใช้คำนวณ SLA); ถ้าเปิดงานกลับ → ล้าง
  if (p.status) {
    if (DONE_STATUS.includes(p.status)) {
      const { data: cur } = await sb().from('reports').select('done_at').eq('report_id', p.report_id).maybeSingle();
      if (!cur || !cur.done_at) patch.done_at = patch.updated_at;
    } else patch.done_at = null;
  }
  // ปิดงาน (เสร็จสิ้น / ไม่พบปัญหา / แจ้งเท็จ) → ลบภาพที่ชาวบ้านแนบทิ้งถาวร (ลดข้อมูลส่วนบุคคลตาม PDPA)
  // บันทึกเวลาที่ลบไว้ใน photo_deleted_at ให้หน้าแอดมินแจ้งเตือน
  let photoDeleted = false;
  if (p.status && !OPEN_STATUS.includes(p.status)) {
    const { data: ph } = await sb().from('report_photos').select('report_id').eq('report_id', p.report_id).maybeSingle();
    if (ph) {
      const { error: eDel } = await sb().from('report_photos').delete().eq('report_id', p.report_id);
      if (eDel) return res.status(500).json({ error: 'ลบภาพไม่สำเร็จ: ' + eDel.message });
      patch.has_photo = false; patch.photo_deleted_at = patch.updated_at; photoDeleted = true;
    }
  }
  const { error } = await sb().from('reports').update(patch).eq('report_id', p.report_id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, photo_deleted: photoDeleted });
};
