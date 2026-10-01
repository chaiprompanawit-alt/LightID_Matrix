/**
 * ระบบแจ้งซ่อมไฟฟ้าสาธารณะ - อบต.แม่ก๊า (MVP)
 * Google Apps Script Web App + Google Sheet
 *
 * โครงสร้าง Sheet (สร้างชีตชื่อตรงตามนี้):
 *  - ชีต "Poles"   : เลขเสา + พิกัด (สำรวจล่วงหน้า)
 *      คอลัมน์: pole_id | zone | address | lat | lng | note
 *  - ชีต "Reports" : บันทึกการแจ้งซ่อม (ระบบเขียนให้อัตโนมัติ)
 *      คอลัมน์: report_id | timestamp | pole_id | lat | lng | reporter_name |
 *               reporter_phone | detail | status | assigned_to | staff_note | updated_at
 *
 * วิธี Deploy: Deploy > New deployment > Web app
 *   - Execute as: Me
 *   - Who has access: Anyone (เพื่อให้ชาวบ้านสแกน QR แจ้งได้โดยไม่ต้องล็อกอิน)
 */

var SHEET_POLES = 'Poles';
var SHEET_REPORTS = 'Reports';
var SHEET_BLOCK = 'Blocklist';
var STATUS_LIST = ['แจ้งใหม่', 'รับเรื่องแล้ว', 'กำลังดำเนินการ', 'เสร็จสิ้น', 'ปิดงาน/ไม่พบปัญหา', 'แจ้งเท็จ'];
var OPEN_STATUS = ['แจ้งใหม่', 'รับเรื่องแล้ว', 'กำลังดำเนินการ']; // สถานะที่ถือว่า "งานยังค้าง"

/** ---------- ตั้งค่าป้องกันการแจ้งมั่ว ---------- */
var MAX_REPORTS_PER_PHONE_PER_DAY = 3;  // เบอร์เดียวแจ้งได้กี่ครั้ง/วัน
var MIN_SECONDS_TO_SUBMIT = 3;          // ส่งเร็วกว่านี้ = บอท

/**
 * ค่าลับเก็บใน Script Properties (ไม่ฝังในโค้ด เพราะโค้ดอยู่บน GitHub สาธารณะ)
 * ตั้งค่าที่: Apps Script > ⚙️ Project Settings > Script Properties
 *   ADMIN_TOKEN  = รหัสเข้าหน้า admin ของเจ้าหน้าที่ (บังคับ)
 *   NOTIFY_EMAIL = อีเมลช่างไฟที่จะรับแจ้งเตือนงานใหม่ (ไม่บังคับ, คั่นหลายคนด้วย ,)
 */
function prop_(key) { return PropertiesService.getScriptProperties().getProperty(key) || ''; }

/**
 * ลายเซ็น QR (ไม่บังคับ): ถ้าตั้ง Script Property QR_SECRET ไว้ ระบบจะรับเฉพาะลิงก์ที่มี k ถูกต้อง
 *   ลิงก์ = ...exec?pole=1/14&k=<6 ตัวแรกของ SHA-256(QR_SECRET + "|" + pole)>
 * ทำให้คนพิมพ์ URL มั่วเสาอื่นไม่ได้ ต้องสแกนจากสติกเกอร์จริง (docs/qr_generator.html สร้าง k ให้เอง)
 */
function poleSig_(poleId) {
  var secret = prop_('QR_SECRET');
  if (!secret) return '';
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, secret + '|' + poleId, Utilities.Charset.UTF_8);
  return bytes.slice(0, 3).map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function qrValid_(poleId, k) {
  var want = poleSig_(poleId);
  return !want || want === String(k || '').toLowerCase();
}
function adminToken_() {
  var t = prop_('ADMIN_TOKEN');
  if (!t) throw new Error('ยังไม่ได้ตั้ง ADMIN_TOKEN ใน Script Properties (ดู README ข้อ 2.4)');
  return t;
}
function isAdmin_(token) { return !!token && token === adminToken_(); }

function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || 'report';

  if (page === 'admin') {
    var t = HtmlService.createTemplateFromFile('admin');
    t.token = (e.parameter.token || '');
    t.adminOk = isAdmin_(e.parameter.token);
    return t.evaluate()
      .setTitle('แดชบอร์ดช่างไฟ - อบต.แม่ก๊า')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // หน้าแจ้งซ่อมสำหรับชาวบ้าน (สแกน QR มา)
  var poleId = (e && e.parameter && e.parameter.pole) ? String(e.parameter.pole).trim() : '';
  var k = (e && e.parameter && e.parameter.k) || '';
  var t = HtmlService.createTemplateFromFile('report');
  t.qrOk = qrValid_(poleId, k);          // false = ลิงก์ปลอม/พิมพ์ URL เอง
  t.k = k;
  t.poleId = t.qrOk ? poleId : '';
  t.pole = (t.qrOk && poleId) ? getPole(poleId) : null;
  t.openReport = (t.qrOk && poleId) ? findOpenReport_(poleId) : null; // มีงานค้างของเสานี้อยู่แล้วไหม
  return t.evaluate()
    .setTitle('แจ้งซ่อมไฟฟ้าสาธารณะ - อบต.แม่ก๊า')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** ให้ HTML ฝัง include ไฟล์อื่นได้ */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** ---------- ข้อมูลเสา ---------- */
function getSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error('ไม่พบชีตชื่อ "' + name + '" กรุณาสร้างตามคู่มือ');
  return sh;
}

function getPole(poleId) {
  var sh = getSheet_(SHEET_POLES);
  // ใช้ getDisplayValues เพื่ออ่านเลขเสาตามที่ "เห็น" ในชีต
  // (กันกรณี Sheet แปลง 9-9 เป็นวันที่ แล้วค่าจริงกลายเป็น Date object)
  var data = sh.getDataRange().getDisplayValues();
  var head = data[0];
  var idx = colIndex_(head);
  var want = String(poleId).trim();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx.pole_id]).trim() === want) {
      return {
        pole_id: String(data[i][idx.pole_id]).trim(),
        zone: data[i][idx.zone] || '',
        address: data[i][idx.address] || '',
        lat: data[i][idx.lat] || '',
        lng: data[i][idx.lng] || '',
        note: data[i][idx.note] || ''
      };
    }
  }
  return null; // ไม่พบเสา -> ให้ชาวบ้านกรอกเลขเสาเอง
}

function colIndex_(head) {
  var map = {};
  head.forEach(function (h, i) { map[String(h).trim().toLowerCase()] = i; });
  return {
    pole_id: pick_(map, ['pole_id', 'เลขเสา', 'id']),
    zone: pick_(map, ['zone', 'โซน', 'หมู่']),
    address: pick_(map, ['address', 'ที่อยู่', 'ตำแหน่ง']),
    lat: pick_(map, ['lat', 'latitude', 'ละติจูด']),
    lng: pick_(map, ['lng', 'lon', 'longitude', 'ลองจิจูด']),
    note: pick_(map, ['note', 'หมายเหตุ'])
  };
}
function pick_(map, keys) {
  for (var i = 0; i < keys.length; i++) if (map[keys[i]] !== undefined) return map[keys[i]];
  return -1;
}

/** ---------- รับการแจ้งซ่อมจากหน้าเว็บ ---------- */
function submitReport(payload) {
  // ตรวจข้อมูลฝั่งเซิร์ฟเวอร์ด้วย (อย่าเชื่อแค่หน้าเว็บ)
  var name = clean_(payload.reporter_name, 100);
  var phone = clean_(payload.reporter_phone, 20).replace(/[^0-9+\-]/g, '');
  var detail = clean_(payload.detail, 1000);
  var poleId = clean_(payload.pole_id, 20);
  if (!name || !phone || !detail) throw new Error('กรุณากรอก ชื่อ / เบอร์โทร / รายละเอียด ให้ครบ');
  if (phone.replace(/\D/g, '').length < 9) throw new Error('เบอร์โทรไม่ถูกต้อง');

  // ---- ด่านกันแจ้งมั่ว ----
  // (1) honeypot: ช่องซ่อนที่คนไม่เห็น ถ้ามีค่า = บอท (ตอบเหมือนสำเร็จ ไม่บันทึก)
  if (payload.website) return { ok: true, report_id: 'R-OK' };
  // (2) ส่งเร็วเกินมนุษย์
  var elapsed = (Date.now() - Number(payload.opened_at || 0)) / 1000;
  if (payload.opened_at && elapsed < MIN_SECONDS_TO_SUBMIT) throw new Error('กรุณาตรวจสอบข้อมูลแล้วส่งอีกครั้ง');
  // (3) ลายเซ็น QR (ถ้าเปิดใช้)
  if (poleId && !qrValid_(poleId, payload.k)) throw new Error('ลิงก์ไม่ถูกต้อง กรุณาสแกน QR จากสติกเกอร์บนเสาอีกครั้ง');
  // (4) เบอร์ในบัญชีดำ
  if (isBlocked_(phone)) throw new Error('ไม่สามารถรับแจ้งจากหมายเลขนี้ได้ กรุณาติดต่อ 053-537-478');
  // (5) เบอร์เดียวแจ้งเกินโควตาต่อวัน
  if (countTodayByPhone_(phone) >= MAX_REPORTS_PER_PHONE_PER_DAY)
    throw new Error('หมายเลขนี้แจ้งครบ ' + MAX_REPORTS_PER_PHONE_PER_DAY + ' ครั้งแล้วในวันนี้ หากเร่งด่วนโทร 053-537-478');
  // (6) เสาต้นนี้มีงานค้างอยู่แล้ว → ไม่สร้างซ้ำ แต่บอกเลขที่เดิมให้
  var dup = poleId ? findOpenReport_(poleId) : null;
  if (dup) return { ok: true, duplicate: true, report_id: dup.report_id, status: dup.status };

  var pole = poleId ? getPole(poleId) : null;
  // พิกัด: ใช้ของเสาที่สำรวจไว้เป็นหลัก; ถ้าไม่มีค่อยใช้ GPS ที่ผู้แจ้งส่งมา
  var lat = (pole && pole.lat) ? pole.lat : (payload.gps_lat || '');
  var lng = (pole && pole.lng) ? pole.lng : (payload.gps_lng || '');

  // ล็อกกันคนแจ้งพร้อมกันแล้วเขียนชีตชนกัน / เลขที่แจ้งซ้ำ
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  var reportId;
  try {
    var sh = getSheet_(SHEET_REPORTS);
    ensureReportHeader_(sh);
    var now = new Date();
    reportId = 'R' + Utilities.formatDate(now, 'Asia/Bangkok', 'yyMMdd-HHmmss') +
      '-' + Math.floor(Math.random() * 900 + 100); // กันซ้ำในวินาทีเดียวกัน
    sh.appendRow([
      reportId, now, poleId || '(ไม่ระบุ)', lat, lng,
      name, phone, detail, 'แจ้งใหม่',
      '',   // assigned_to
      '',   // staff_note
      now   // updated_at
    ]);
  } finally {
    lock.releaseLock();
  }

  notifyNewReport_(reportId, poleId, pole, lat, lng, name, phone, detail);
  return { ok: true, report_id: reportId };
}

function clean_(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }

/** อ่านชีต Reports เป็น object (ใช้ displayValues เพื่อให้ pole_id/เบอร์โทรเป็นข้อความตรงตามที่เห็น) */
function readReports_() {
  var sh = getSheet_(SHEET_REPORTS);
  if (sh.getLastRow() < 2) return [];
  var data = sh.getDataRange().getDisplayValues();
  var raw = sh.getDataRange().getValues(); // เอา Date จริงมาใช้เทียบวัน
  var head = data[0], rows = [];
  for (var i = 1; i < data.length; i++) {
    var o = { _row: i + 1 };
    head.forEach(function (h, j) { o[String(h).trim()] = data[i][j]; });
    o._ts = raw[i][1] instanceof Date ? raw[i][1] : null;
    rows.push(o);
  }
  return rows;
}

/** เสาต้นนี้มีงานที่ยังไม่ปิดอยู่ไหม */
function findOpenReport_(poleId) {
  var want = String(poleId).trim();
  var rows = readReports_();
  for (var i = rows.length - 1; i >= 0; i--) {
    if (rows[i].pole_id === want && OPEN_STATUS.indexOf(rows[i].status) >= 0) {
      return { report_id: rows[i].report_id, status: rows[i].status, timestamp: rows[i].timestamp };
    }
  }
  return null;
}

/** เบอร์นี้แจ้งมาแล้วกี่ครั้งวันนี้ */
function countTodayByPhone_(phone) {
  var today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd');
  var digits = phone.replace(/\D/g, '');
  return readReports_().filter(function (r) {
    return r._ts && String(r.reporter_phone).replace(/\D/g, '') === digits &&
      Utilities.formatDate(r._ts, 'Asia/Bangkok', 'yyyyMMdd') === today;
  }).length;
}

/** บัญชีดำ: ชีต Blocklist คอลัมน์ A = เบอร์โทร, B = เหตุผล, C = วันที่บล็อก */
function isBlocked_(phone) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_BLOCK);
  if (!sh || sh.getLastRow() < 2) return false;
  var digits = phone.replace(/\D/g, '');
  return sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues()
    .some(function (r) { return String(r[0]).replace(/\D/g, '') === digits && digits; });
}

/** ช่างกดบล็อกเบอร์จากแดชบอร์ด */
function blockPhone(token, phone, reason) {
  if (!isAdmin_(token)) throw new Error('unauthorized');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_BLOCK) || ss.insertSheet(SHEET_BLOCK);
  if (sh.getLastRow() === 0) { sh.appendRow(['phone', 'reason', 'blocked_at']); sh.getRange('A:A').setNumberFormat('@'); }
  if (isBlocked_(phone)) return { ok: true, already: true };
  sh.appendRow([String(phone), reason || 'แจ้งเท็จซ้ำ', new Date()]);
  return { ok: true };
}

/** แจ้งเตือนช่างทางอีเมลเมื่อมีงานใหม่ (ถ้าตั้ง NOTIFY_EMAIL ไว้) — ล้มเหลวก็ไม่กระทบการรับแจ้ง */
function notifyNewReport_(reportId, poleId, pole, lat, lng, name, phone, detail) {
  var to = prop_('NOTIFY_EMAIL');
  if (!to) return;
  try {
    var mapLink = (lat && lng) ? 'https://www.google.com/maps?q=' + lat + ',' + lng : '(ไม่มีพิกัด)';
    var adminLink = ScriptApp.getService().getUrl() + '?page=admin';
    MailApp.sendEmail({
      to: to,
      subject: '[แจ้งซ่อมไฟฟ้า] งานใหม่ เสา ' + (poleId || '(ไม่ระบุ)') + ' — ' + reportId,
      body: [
        'มีการแจ้งซ่อมไฟฟ้าสาธารณะใหม่',
        '',
        'เลขที่แจ้ง : ' + reportId,
        'เสา        : ' + (poleId || '(ไม่ระบุ)') + (pole && pole.address ? ' — ' + pole.address : ''),
        'อาการ      : ' + detail,
        'ผู้แจ้ง    : ' + name + ' โทร ' + phone,
        'นำทาง      : ' + mapLink,
        '',
        'เปิดแดชบอร์ด: ' + adminLink
      ].join('\n')
    });
  } catch (err) {
    console.error('notify failed: ' + err);
  }
}

var REPORT_HEADER = ['report_id', 'timestamp', 'pole_id', 'lat', 'lng', 'reporter_name',
  'reporter_phone', 'detail', 'status', 'assigned_to', 'staff_note', 'updated_at'];
var POLE_HEADER = ['pole_id', 'zone', 'address', 'lat', 'lng', 'note'];

function ensureReportHeader_(sh) {
  if (sh.getLastRow() === 0) {
    sh.appendRow(REPORT_HEADER);
    sh.getRange('C:C').setNumberFormat('@'); // pole_id เป็นข้อความ กัน 1/14 กลายเป็นวันที่
    sh.setFrozenRows(1);
  }
}

/**
 * ▶ รันฟังก์ชันนี้ครั้งเดียวตอนติดตั้ง (เลือก setupSheets แล้วกด Run)
 * สร้างชีต Poles + Reports พร้อมหัวตาราง และล็อกคอลัมน์เลขเสาเป็น "ข้อความ"
 * สำคัญมาก: เลขเสารูปแบบ 1/14 ถ้าไม่ล็อกไว้ Google Sheet จะแปลงเป็นวันที่ 14 ม.ค. ทันที
 */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var poles = ss.getSheetByName(SHEET_POLES) || ss.insertSheet(SHEET_POLES);
  if (poles.getLastRow() === 0) poles.appendRow(POLE_HEADER);
  poles.getRange('A:A').setNumberFormat('@');   // pole_id
  poles.getRange('D:E').setNumberFormat('0.000000'); // lat, lng ทศนิยม 6 ตำแหน่ง
  poles.setFrozenRows(1);

  var reports = ss.getSheetByName(SHEET_REPORTS) || ss.insertSheet(SHEET_REPORTS);
  ensureReportHeader_(reports);
  reports.getRange('C:C').setNumberFormat('@');
  reports.getRange('B:B').setNumberFormat('dd/mm/yyyy hh:mm');
  reports.getRange('L:L').setNumberFormat('dd/mm/yyyy hh:mm');

  var block = ss.getSheetByName(SHEET_BLOCK) || ss.insertSheet(SHEET_BLOCK);
  if (block.getLastRow() === 0) block.appendRow(['phone', 'reason', 'blocked_at']);
  block.getRange('A:A').setNumberFormat('@');

  // ลบชีตว่างเริ่มต้น "Sheet1" ถ้ามีและยังว่างอยู่
  var s1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1');
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 2) ss.deleteSheet(s1);

  var hasToken = !!prop_('ADMIN_TOKEN');
  SpreadsheetApp.getUi().alert(
    'ติดตั้งชีตเรียบร้อย ✓\n\n' +
    '• ชีต Poles: วางข้อมูลเสา 1,300 ต้น (คอลัมน์ A ล็อกเป็นข้อความแล้ว วาง 1/14 ได้ไม่กลายเป็นวันที่)\n' +
    '• ชีต Reports: ระบบเขียนเอง ไม่ต้องแก้\n\n' +
    (hasToken ? '• ADMIN_TOKEN ตั้งแล้ว ✓' : '⚠ ยังไม่ได้ตั้ง ADMIN_TOKEN — ไปที่ Project Settings > Script Properties')
  );
}

/** ตรวจสุขภาพข้อมูลเสา: เลขซ้ำ / ไม่มีพิกัด / รูปแบบผิด — รันแล้วดูผลใน Logs (Ctrl+Enter) */
function checkPoles() {
  var data = getSheet_(SHEET_POLES).getDataRange().getDisplayValues();
  var idx = colIndex_(data[0]);
  var seen = {}, dup = [], noGeo = [], badFmt = [];
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][idx.pole_id]).trim();
    if (!id) continue;
    if (!/^\d{1,2}\/\d{1,4}$/.test(id)) badFmt.push('แถว ' + (i + 1) + ': "' + id + '"');
    if (seen[id]) dup.push(id); seen[id] = true;
    if (!data[i][idx.lat] || !data[i][idx.lng]) noGeo.push(id);
  }
  console.log('เสาทั้งหมด: ' + Object.keys(seen).length);
  console.log('เลขซ้ำ (' + dup.length + '): ' + dup.join(', '));
  console.log('ไม่มีพิกัด (' + noGeo.length + '): ' + noGeo.join(', '));
  console.log('รูปแบบไม่ใช่ หมู่/ต้น (' + badFmt.length + '): ' + badFmt.join(', '));
}

/** ---------- ฝั่งเจ้าหน้าที่ (admin) ---------- */
function getReports(token) {
  if (!isAdmin_(token)) throw new Error('unauthorized');
  // นับจำนวนครั้งที่แต่ละเบอร์ถูกตีเป็น "แจ้งเท็จ" เพื่อโชว์เตือนช่าง
  var rows = readReports_();
  var fake = {};
  rows.forEach(function (r) { if (r.status === 'แจ้งเท็จ') { var d = String(r.reporter_phone).replace(/\D/g, ''); fake[d] = (fake[d] || 0) + 1; } });
  rows.forEach(function (r) { r.fake_count = fake[String(r.reporter_phone).replace(/\D/g, '')] || 0; delete r._ts; });
  return rows.reverse(); // ใหม่สุดอยู่บน
}

function updateReport(token, row, status, assignedTo, staffNote) {
  if (!isAdmin_(token)) throw new Error('unauthorized');
  if (status && STATUS_LIST.indexOf(status) < 0) throw new Error('สถานะไม่ถูกต้อง');
  var sh = getSheet_(SHEET_REPORTS);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var idx = {};
  head.forEach(function (h, i) { idx[String(h).trim()] = i + 1; });

  if (status) sh.getRange(row, idx['status']).setValue(status);
  if (assignedTo !== undefined) sh.getRange(row, idx['assigned_to']).setValue(assignedTo);
  if (staffNote !== undefined) sh.getRange(row, idx['staff_note']).setValue(staffNote);
  sh.getRange(row, idx['updated_at']).setValue(new Date());
  return { ok: true };
}

function getStatusList() { return STATUS_LIST; }
