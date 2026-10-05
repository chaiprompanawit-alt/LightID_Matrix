// POST /api/report — ชาวบ้านส่งเรื่องแจ้งซ่อม (ย้าย logic กันแจ้งมั่ว 6 ชั้นจาก Code.gs มาครบ)
const L = require('../lib/db');
const { notifyNewReport } = require('../lib/notify');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const p = L.body(req);
  try {
    const name = L.clean(p.reporter_name, 100);
    const phone = L.digits(p.reporter_phone).slice(0, 15);
    const detail = L.clean(p.detail, 1000);
    const poleId = L.clean(p.pole_id, 20);
    if (!name || !phone || !detail) throw new Error('กรุณากรอก ชื่อ / เบอร์โทร / รายละเอียด ให้ครบ');
    if (phone.length < 9) throw new Error('เบอร์โทรไม่ถูกต้อง');
    if (!poleId) throw new Error('กรุณากรอกเลขเสา');
    const photo = L.parsePhoto(p.photo);   // ไม่บังคับ

    // (1) honeypot — บอทกรอกช่องที่คนมองไม่เห็น → ตอบเหมือนสำเร็จแต่ไม่บันทึก
    if (p.website) return res.json({ ok: true, report_id: 'R-OK' });
    // (2) ส่งเร็วเกินมนุษย์
    const elapsed = (Date.now() - Number(p.opened_at || 0)) / 1000;
    if (p.opened_at && elapsed < L.MIN_SECONDS_TO_SUBMIT) throw new Error('กรุณาตรวจสอบข้อมูลแล้วส่งอีกครั้ง');
    // (3) ลายเซ็น QR
    if (!L.qrValid(poleId, p.k)) throw new Error('ลิงก์ไม่ถูกต้อง กรุณาสแกน QR จากสติกเกอร์บนเสาอีกครั้ง');

    const db = L.sb();
    // (4) บัญชีดำ
    const { data: blocked, error: eB } = await db.from('blocklist').select('phone').eq('phone', phone).maybeSingle();
    dbOk(eB, 'blocklist');
    if (blocked) throw new Error('ไม่สามารถรับแจ้งจากหมายเลขนี้ได้ กรุณาติดต่อ ' + L.HOTLINE);
    // (5) โควตาต่อเบอร์ต่อวัน
    const { count, error: eC } = await db.from('reports').select('report_id', { count: 'exact', head: true })
      .eq('reporter_phone', phone).gte('created_at', L.bkkStartOfToday().toISOString());
    dbOk(eC, 'quota');
    if ((count || 0) >= L.MAX_REPORTS_PER_PHONE_PER_DAY)
      throw new Error(`หมายเลขนี้แจ้งครบ ${L.MAX_REPORTS_PER_PHONE_PER_DAY} ครั้งแล้วในวันนี้ หากเร่งด่วนโทร ${L.HOTLINE}`);
    // (6) เสาต้นนี้มีงานค้างอยู่แล้ว → ไม่สร้างซ้ำ บอกเลขที่เดิม
    const { data: dup, error: eD } = await db.from('reports').select('report_id,status').eq('pole_id', poleId)
      .in('status', L.OPEN_STATUS).order('created_at', { ascending: false }).limit(1).maybeSingle();
    dbOk(eD, 'duplicate');
    if (dup) return res.json({ ok: true, duplicate: true, report_id: dup.report_id, status: dup.status });

    // พิกัด: ใช้ของเสาที่สำรวจไว้เป็นหลัก ถ้าไม่มีค่อยใช้ GPS ผู้แจ้ง
    const { data: pole, error: eP } = await db.from('poles').select('*').eq('pole_id', poleId).maybeSingle();
    dbOk(eP, 'pole');
    const lat = pole && pole.lat ? pole.lat : (parseFloat(p.gps_lat) || null);
    const lng = pole && pole.lng ? pole.lng : (parseFloat(p.gps_lng) || null);

    const row = { report_id: L.newReportId(), pole_id: poleId, lat, lng, reporter_name: name,
      reporter_phone: phone, detail, status: 'แจ้งใหม่', has_photo: false };
    const { error } = await db.from('reports').insert(row);
    // ส่งพร้อมกันหลายคำขอ: ฐานข้อมูลยอมให้มีงานค้างได้ 1 งานต่อเสา (unique index reports_one_open_per_pole)
    // คำขอที่ช้ากว่าจะชน 23505 → ตอบว่าเสานี้มีคนแจ้งแล้ว ไม่เก็บภาพ ไม่ส่งอีเมล
    if (error && error.code === '23505') {
      const { data: cur } = await db.from('reports').select('report_id,status').eq('pole_id', poleId)
        .in('status', L.OPEN_STATUS).order('created_at', { ascending: false }).limit(1).maybeSingle();
      return res.json({ ok: true, duplicate: true, report_id: cur && cur.report_id, status: cur && cur.status });
    }
    if (error) throw new Error('บันทึกไม่สำเร็จ กรุณาลองใหม่ (' + error.message + ')');

    // เก็บภาพแยกตาราง — ถ้าเก็บภาพไม่สำเร็จ เรื่องแจ้งยังรับไว้ตามปกติ (ภาพเป็นของเสริม)
    if (photo) {
      const { error: eF } = await db.from('report_photos').insert({ report_id: row.report_id, mime: photo.mime, data: photo.data });
      if (eF) console.error('photo save failed', eF.message);
      else {
        // ระหว่างอัปโหลดภาพ เจ้าหน้าที่อาจปิดงานไปแล้ว (update.js ลบภาพไม่ได้เพราะยังไม่มีแถวภาพ) → ตรวจสถานะซ้ำแล้วลบทันที
        const { data: cur } = await db.from('reports').select('status').eq('report_id', row.report_id).maybeSingle();
        if (cur && !L.OPEN_STATUS.includes(cur.status)) {
          await db.from('report_photos').delete().eq('report_id', row.report_id);
          await db.from('reports').update({ has_photo: false, photo_deleted_at: new Date().toISOString() }).eq('report_id', row.report_id);
        } else {
          row.has_photo = true;
          await db.from('reports').update({ has_photo: true }).eq('report_id', row.report_id);
        }
      }
    }

    await notifyNewReport(row, pole);
    res.json({ ok: true, report_id: row.report_id, photo: row.has_photo });
  } catch (e) {
    console.error('report failed', e.message);
    res.status(400).json({ error: e.message });
  }
};

function dbOk(error, step) {
  if (error) throw new Error('ฐานข้อมูลขัดข้อง (' + step + '): ' + error.message);
}
