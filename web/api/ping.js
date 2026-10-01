// Vercel Cron เรียกทุกวัน 10:15 น. (เวลาไทย) → แตะฐานข้อมูล กัน Supabase Free หยุดโปรเจกต์เมื่อไม่มีการใช้งาน 7 วัน
// เปิดเองในเบราว์เซอร์ได้ เพื่อตรวจว่าเว็บต่อฐานข้อมูลได้ไหม (แสดงแค่ชื่อโฮสต์ ไม่แสดงคีย์)
const { sb, supabaseOrigin } = require('../lib/db');

function hostCheck(raw) {
  const url = String(raw || '');
  if (!url) return { host: null, hint: 'ยังไม่ได้ตั้ง SUPABASE_URL' };
  if (url !== url.trim()) return { host: url.trim().replace(/^https?:\/\//, '').split('/')[0], hint: 'SUPABASE_URL มีช่องว่าง/ขึ้นบรรทัดติดมา (ระบบตัดให้แล้ว แต่ควรลบออกใน Vercel)' };
  let u;
  try { u = new URL(url); } catch { return { host: url, hint: 'SUPABASE_URL ต้องขึ้นต้นด้วย https:// เช่น https://abcd.supabase.co' }; }
  if (u.hostname.startsWith('db.')) return { host: u.hostname, hint: 'ใช้ลิงก์ฐานข้อมูลตรง (db.) ไม่ได้ ต้องใช้ Project URL แบบ https://abcd.supabase.co' };
  if (u.pathname.replace(/\/+$/, '')) return { host: u.hostname, hint: 'SUPABASE_URL ต้องไม่มีส่วนต่อท้าย ใช้แค่ https://abcd.supabase.co' };
  if (!/\.supabase\.co$/.test(u.hostname)) return { host: u.hostname, hint: 'ไม่ใช่โดเมน supabase.co — ตรวจว่าคัดลอก Project URL มาถูกช่อง' };
  return { host: u.hostname, hint: null };
}

module.exports = async (req, res) => {
  const chk = hostCheck(process.env.SUPABASE_URL);
  const origin = supabaseOrigin(process.env.SUPABASE_URL);
  const { count, error } = await sb().from('poles').select('pole_id', { count: 'exact', head: true });
  let netError = null;
  if (error && origin) {
    try { await fetch(origin + '/rest/v1/', { signal: AbortSignal.timeout(5000) }); }
    catch (e) { netError = (e.cause && (e.cause.code || e.cause.message)) || e.message; }
  }
  if (error) console.error('ping failed', error, netError);
  res.status(error ? 500 : 200).json({
    ok: !error, poles: count, at: new Date().toISOString(),
    supabase_host: origin ? new URL(origin).hostname : null, hint: chk.hint && (/ให้แล้ว/.test(chk.hint) ? chk.hint : chk.hint + ' (ระบบปรับให้อัตโนมัติแล้ว)'), error: error && error.message, network: netError
  });
};
