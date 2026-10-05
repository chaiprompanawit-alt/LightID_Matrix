// ฐานข้อมูลจำลองในหน่วยความจำ — ใช้เฉพาะตอนรัน `npm run dev` โดยยังไม่ได้ตั้ง SUPABASE_URL
// เลียนแบบ API ของ supabase-js เท่าที่โปรเจกต์นี้ใช้ (ข้อมูลหายเมื่อปิดเซิร์ฟเวอร์)
const tables = {
  poles: [{ pole_id: '1/1', zone: '1', address: 'เสาทดลองระบบ', lat: 18.582125, lng: 98.952782, note: 'TEST' },
          { pole_id: '1/2', zone: '1', address: 'ปากซอยทดลอง', lat: 18.5835, lng: 98.9540, note: '' },
          { pole_id: '2/5', zone: '2', address: 'หน้าศาลาหมู่ 2', lat: 18.5790, lng: 98.9500, note: '' }],
  reports: [], report_photos: [], blocklist: [], staff_users: []
};
const OPEN = ['แจ้งใหม่', 'รับเรื่องแล้ว', 'กำลังดำเนินการ'];
/** จำลอง unique index reports_one_open_per_pole ของ schema.sql (1 เสา = งานค้างได้ 1 งาน) */
function openConflict(table, r, self) {
  return table === 'reports' && OPEN.includes(r.status) &&
    tables.reports.some(x => x !== self && x.pole_id === r.pole_id && OPEN.includes(x.status));
}
const DUP = { code: '23505', message: 'duplicate key value violates unique constraint "reports_one_open_per_pole"' };
const PK = { poles: 'pole_id', reports: 'report_id', report_photos: 'report_id', blocklist: 'phone', staff_users: 'username' };
// ข้อมูลตัวอย่างให้เห็นแดชบอร์ด/รายงานทันที
(function seed() {
  const now = Date.now(), d = h => new Date(now - h * 3600e3).toISOString();
  tables.reports.push(
    { report_id: 'R250915-081200-101', created_at: d(80), pole_id: '1/1', lat: 18.582125, lng: 98.952782, reporter_name: 'นางสมพร (ทดสอบ)', reporter_phone: '0810000001', detail: 'ไฟดับทั้งต้น', status: 'เสร็จสิ้น', assigned_to: 'ช่างเอ', staff_note: 'เปลี่ยนหลอด', updated_at: d(30), done_at: d(30), has_photo: false, photo_deleted_at: d(30) },
    { report_id: 'R250916-190500-202', created_at: d(40), pole_id: '1/2', lat: 18.5835, lng: 98.954, reporter_name: 'นายวิชัย (ทดสอบ)', reporter_phone: '0810000002', detail: 'ไฟกะพริบ', status: 'กำลังดำเนินการ', assigned_to: 'ช่างเอ', staff_note: '', updated_at: d(20), done_at: null },
    { report_id: 'R250917-200100-303', created_at: d(12), pole_id: '2/5', lat: 18.579, lng: 98.95, reporter_name: 'นางสาวมะลิ (ทดสอบ)', reporter_phone: '0810000003', detail: 'โคมแตก/ห้อย', status: 'แจ้งใหม่', assigned_to: '', staff_note: '', updated_at: d(12), done_at: null },
    { report_id: 'R250901-090000-505', created_at: d(24*15), pole_id: '1/1', lat: 18.582125, lng: 98.952782, reporter_name: 'นายบุญมี (ทดสอบ)', reporter_phone: '0810000004', detail: 'สายไฟหลุด/ห้อยต่ำ', status: 'รับเรื่องแล้ว', assigned_to: 'ช่างบี', staff_note: '', updated_at: d(24*14), done_at: null },
    { report_id: 'R250910-100000-404', created_at: d(200), pole_id: '1/1', lat: 18.582125, lng: 98.952782, reporter_name: 'ผู้ไม่หวังดี', reporter_phone: '0899999999', detail: 'ทดสอบเฉยๆ', status: 'แจ้งเท็จ', assigned_to: 'ช่างบี', staff_note: '', updated_at: d(190), done_at: null });
})();

function q(table) {
  const st = { f: [], order: null, limit: null, head: false, count: false, single: false };
  const apply = () => {
    let rows = tables[table].filter(r => st.f.every(fn => fn(r)));
    if (st.order) rows.sort((a, b) => (a[st.order.col] > b[st.order.col] ? 1 : -1) * (st.order.asc ? 1 : -1));
    if (st.limit) rows = rows.slice(0, st.limit);
    return rows;
  };
  const done = (data, error) => Promise.resolve({ data, error: error || null, count: st.count ? (data ? data.length : 0) : null });
  const b = {
    select(cols, o) { if (o && o.count) st.count = true; if (o && o.head) st.head = true; return b; },
    eq(c, v) { st.f.push(r => String(r[c]) === String(v)); return b; },
    in(c, arr) { st.f.push(r => arr.includes(r[c])); return b; },
    gte(c, v) { st.f.push(r => r[c] >= v); return b; },
    lte(c, v) { st.f.push(r => r[c] <= v); return b; },
    lt(c, v) { st.f.push(r => r[c] < v); return b; },
    order(c, o) { st.order = { col: c, asc: !o || o.ascending !== false }; return b; },
    limit(n) { st.limit = n; return b; },
    maybeSingle() { st.single = true; return b; },
    insert(row) { const rows = [].concat(row).map(r => ({ created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...r })); if (rows.some(r => openConflict(table, r))) return done(null, DUP); tables[table].push(...rows); return done(rows); },
    upsert(row) { [].concat(row).forEach(r => { const i = tables[table].findIndex(x => x[PK[table]] === r[PK[table]]); if (i >= 0) Object.assign(tables[table][i], r); else tables[table].push({ created_at: new Date().toISOString(), ...r }); }); return done(null); },
    update(patch) { return { eq(c, v) { const hit = tables[table].filter(r => String(r[c]) === String(v)); if (hit.some(r => openConflict(table, { ...r, ...patch }, r))) return done(null, DUP); hit.forEach(r => Object.assign(r, patch)); return done(null); } }; },
    delete() { return { eq(c, v) { tables[table] = tables[table].filter(r => String(r[c]) !== String(v)); return done(null); } }; },
    then(res, rej) { const rows = apply(); let data = st.head ? null : (st.single ? (rows[0] || null) : rows); const out = { data, error: null, count: st.count ? apply().length : null }; return Promise.resolve(out).then(res, rej); }
  };
  return b;
}
module.exports = { from: q, __tables: tables };
