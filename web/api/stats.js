// GET /api/stats?period=week|month&date=YYYY-MM-DD  (แอดมิน) → สรุปสำหรับรายงานประจำสัปดาห์/เดือน
// เทียบกับช่วงก่อนหน้าให้ด้วย (สัปดาห์ก่อน / เดือนก่อน)
const { sb, requireRole, DONE_STATUS, OPEN_STATUS, SLA_WORKING_DAYS, mooOf, bkk } = require('../lib/db');

/** ช่วงเวลา [start, end) ตามเวลาไทย; week = จันทร์–อาทิตย์ */
function range(period, dateStr) {
  const d = dateStr ? new Date(dateStr + 'T00:00:00+07:00') : bkk();
  const b = dateStr ? new Date(d.getTime() + 7 * 3600e3) : d;   // เป็น "เวลาไทยใน UTC getters"
  let s, e;
  if (period === 'month') {
    s = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 1);
    e = Date.UTC(b.getUTCFullYear(), b.getUTCMonth() + 1, 1);
  } else {
    const dow = (b.getUTCDay() + 6) % 7; // จันทร์=0
    s = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() - dow);
    e = s + 7 * 86400e3;
  }
  return { start: new Date(s - 7 * 3600e3), end: new Date(e - 7 * 3600e3) };
}
function prevRange(period, r) {
  if (period === 'month') {
    const b = new Date(r.start.getTime() + 7 * 3600e3);
    const s = Date.UTC(b.getUTCFullYear(), b.getUTCMonth() - 1, 1);
    return { start: new Date(s - 7 * 3600e3), end: r.start };
  }
  return { start: new Date(r.start.getTime() - 7 * 86400e3), end: r.start };
}
/** นับวันทำการ (จ.–ศ.) ระหว่างสองเวลา — ยังไม่หักวันหยุดนักขัตฤกษ์ */
function workingDays(a, b) {
  let n = 0; const d = new Date(a); d.setUTCHours(0, 0, 0, 0);
  while (d < b) { const w = new Date(d.getTime() + 7 * 3600e3).getUTCDay(); if (w !== 0 && w !== 6) n++; d.setUTCDate(d.getUTCDate() + 1); }
  return n;
}
function summarize(rows) {
  const byStatus = {}, byMoo = {}, byPole = {}, daily = {}, byStaff = {};
  let doneCount = 0, doneHours = 0, withinSla = 0, overSla = 0;
  rows.forEach(r => {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    const m = mooOf(r.pole_id) || 'ไม่ระบุ';
    byMoo[m] = byMoo[m] || { total: 0, open: 0, done: 0, fake: 0 };
    byMoo[m].total++;
    if (OPEN_STATUS.includes(r.status)) byMoo[m].open++;
    if (DONE_STATUS.includes(r.status)) byMoo[m].done++;
    if (r.status === 'แจ้งเท็จ') byMoo[m].fake++;
    byPole[r.pole_id] = (byPole[r.pole_id] || 0) + 1;
    const day = new Date(new Date(r.created_at).getTime() + 7 * 3600e3).toISOString().slice(0, 10);
    daily[day] = (daily[day] || 0) + 1;
    if (r.assigned_to) { byStaff[r.assigned_to] = byStaff[r.assigned_to] || { total: 0, done: 0 }; byStaff[r.assigned_to].total++; if (DONE_STATUS.includes(r.status)) byStaff[r.assigned_to].done++; }
    if (DONE_STATUS.includes(r.status) && r.done_at) {
      doneCount++;
      const a = new Date(r.created_at), b = new Date(r.done_at);
      doneHours += (b - a) / 3600e3;
      if (workingDays(a, b) <= SLA_WORKING_DAYS) withinSla++; else overSla++;
    }
  });
  const open = rows.filter(r => OPEN_STATUS.includes(r.status)).length;
  const repeatPoles = Object.entries(byPole).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([pole_id, n]) => ({ pole_id, count: n }));
  return {
    total: rows.length, open, done: doneCount, fake: byStatus['แจ้งเท็จ'] || 0,
    avg_hours_to_done: doneCount ? Math.round(doneHours / doneCount * 10) / 10 : null,
    sla_within: withinSla, sla_over: overSla,
    sla_pct: doneCount ? Math.round(withinSla / doneCount * 100) : null,
    by_status: byStatus, by_moo: byMoo, by_staff: byStaff, daily, repeat_poles: repeatPoles
  };
}

module.exports = async (req, res) => {
  if (!(await requireRole(req, res, ['admin']))) return;
  const period = req.query.period === 'month' ? 'month' : 'week';
  const cur = range(period, req.query.date), prev = prevRange(period, cur);
  const db = sb();
  const [{ data: a, error: e1 }, { data: b }, { count: backlog }] = await Promise.all([
    db.from('reports').select('*').gte('created_at', cur.start.toISOString()).lt('created_at', cur.end.toISOString()).limit(5000),
    db.from('reports').select('*').gte('created_at', prev.start.toISOString()).lt('created_at', prev.end.toISOString()).limit(5000),
    db.from('reports').select('report_id', { count: 'exact', head: true }).in('status', OPEN_STATUS)
  ]);
  if (e1) return res.status(500).json({ error: e1.message });
  res.json({
    period, start: cur.start.toISOString(), end: cur.end.toISOString(),
    sla_working_days: SLA_WORKING_DAYS,
    backlog_total: backlog || 0,                 // งานค้างทั้งระบบ ณ ตอนนี้ (ไม่จำกัดช่วง)
    current: summarize(a || []), previous: summarize(b || []),
    rows: (a || []).map(r => ({ report_id: r.report_id, created_at: r.created_at, pole_id: r.pole_id, detail: r.detail,
      status: r.status, assigned_to: r.assigned_to, done_at: r.done_at, staff_note: r.staff_note }))  // ไม่ส่งชื่อ/เบอร์ผู้แจ้ง (PDPA) — รายงานไม่จำเป็นต้องมี
  });
};
