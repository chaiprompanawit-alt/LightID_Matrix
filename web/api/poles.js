// ข้อมูลเสา — GET รายการทั้งหมด (ช่าง/แอดมิน) / POST {rows:[{pole_id,zone,address,lat,lng,note}]} upsert เป็นชุด (แอดมิน)
const { sb, requireRole, body, clean, poleSig } = require('../lib/db');

/** เว็บที่ QR จะพาไป: QR_BASE_URL (โดเมนของตัวเอง) > โดเมน production ของ Vercel > โดเมนที่เปิดอยู่ */
function qrBase(req) {
  const set = String(process.env.QR_BASE_URL || '').trim().replace(/\/+$/, '');
  if (set) return set;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || req.headers['x-forwarded-host'] || req.headers.host;
  return (host.startsWith('localhost') ? 'http://' : 'https://') + host;
}
module.exports = async (req, res) => {
  if (req.method === 'GET') {
    if (!(await requireRole(req, res, ['admin', 'tech']))) return;
    // Supabase ตัดผลลัพธ์ที่ 1,000 แถวเสมอ (limit() ไม่เกิน) → ดึงเป็นหน้าๆ จนครบ ไม่งั้นเสาท้ายตาราง (เช่น ม.9) หาย
    const data = [];
    for (let from = 0; ; from += 1000) {
      const { data: page, error } = await sb().from('poles').select('*').order('pole_id').range(from, from + 999);
      if (error) return res.status(500).json({ error: error.message });
      data.push(...page);
      if (page.length < 1000) break;
    }
    if (req.query.qr) {   // หน้าสร้างสติกเกอร์: ส่งลายเซ็น k ของแต่ละต้น (QR_SECRET ไม่ออกจากเซิร์ฟเวอร์)
      if (!(await requireRole(req, res, ['admin']))) return;
      return res.json({ base: qrBase(req) + '/', signed: !!poleSig('x'), rows: data.map(p => ({ pole_id: p.pole_id, k: poleSig(p.pole_id) })) });
    }
    return res.json(data);
  }
  if (!(await requireRole(req, res, ['admin']))) return;
  const rows = (body(req).rows || []).map(r => ({
    pole_id: clean(r.pole_id, 20), zone: clean(r.zone, 10), address: clean(r.address, 200),
    lat: parseFloat(r.lat) || null, lng: parseFloat(r.lng) || null, note: clean(r.note, 200)
  })).filter(r => r.pole_id);
  const bad = rows.filter(r => !/^\d{1,2}\/\d{1,4}$/.test(r.pole_id)).map(r => r.pole_id);
  if (bad.length) return res.status(400).json({ error: 'รูปแบบเลขเสาต้องเป็น หมู่/ต้นที่ เช่น 1/14 — ผิดที่: ' + bad.slice(0, 10).join(', ') });
  if (!rows.length) return res.status(400).json({ error: 'ไม่มีข้อมูล' });
  const { error } = await sb().from('poles').upsert(rows, { onConflict: 'pole_id' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, count: rows.length });
};
