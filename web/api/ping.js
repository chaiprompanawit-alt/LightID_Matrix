// Vercel Cron เรียกทุกวัน 10:15 น. (เวลาไทย) → แตะฐานข้อมูล กัน Supabase Free หยุดโปรเจกต์เมื่อไม่มีการใช้งาน 7 วัน
const { sb } = require('../lib/db');
module.exports = async (req, res) => {
  const { count, error } = await sb().from('poles').select('pole_id', { count: 'exact', head: true });
  if (error) console.error('ping failed', error);
  res.status(error ? 500 : 200).json({ ok: !error, poles: count, at: new Date().toISOString(), error: error && error.message });
};
