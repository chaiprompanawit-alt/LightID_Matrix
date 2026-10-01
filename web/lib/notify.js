// แจ้งเตือนช่างเมื่อมีงานใหม่ ผ่าน Resend (อีเมล) — ล้มเหลวก็ไม่กระทบการรับแจ้ง
async function notifyNewReport(r, pole) {
  const key = process.env.RESEND_API_KEY, to = process.env.NOTIFY_EMAIL;
  if (!key || !to) return;
  const mapLink = (r.lat && r.lng) ? `https://www.google.com/maps?q=${r.lat},${r.lng}` : '(ไม่มีพิกัด)';
  const base = process.env.PUBLIC_URL || '';
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || 'onboarding@resend.dev',
        to: to.split(',').map(s => s.trim()).filter(Boolean),
        subject: `[แจ้งซ่อมไฟฟ้า] งานใหม่ เสา ${r.pole_id} — ${r.report_id}`,
        text: [
          'มีการแจ้งซ่อมไฟฟ้าสาธารณะใหม่', '',
          `เลขที่แจ้ง : ${r.report_id}`,
          `เสา        : ${r.pole_id}${pole && pole.address ? ' — ' + pole.address : ''}`,
          `อาการ      : ${r.detail}`,
          `ผู้แจ้ง    : ${r.reporter_name} โทร ${r.reporter_phone}`,
          `นำทาง      : ${mapLink}`, '',
          `เปิดหน้าช่าง: ${base}/tech`
        ].join('\n')
      })
    });
  } catch (e) { console.error('notify failed', e); }
}
module.exports = { notifyNewReport };
