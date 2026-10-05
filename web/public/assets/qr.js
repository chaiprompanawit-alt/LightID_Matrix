/* แท็บ "สติกเกอร์ QR" ในหน้าแอดมิน: เลือกหมู่ → ดูตัวอย่าง → ดาวน์โหลด PDF (A4 แนวตั้ง 2x4 = 8 ดวง/หน้า)
 * ลายเซ็น k มาจากเซิร์ฟเวอร์ (/api/poles?qr=1) — QR_SECRET ไม่ออกจากเซิร์ฟเวอร์
 * ฟอนต์/ไลบรารีอยู่ในเว็บเอง (assets/fonts, assets/vendor) ทุกเครื่องจึงได้ไฟล์หน้าตาเดียวกัน
 * ขนาดสติกเกอร์ 95 x 62.5 มม. ตามแบบ docs/sticker_1-1.html */
var QR = { data: null, base: '', signed: false, moo: '', ready: null, logo: null, busy: false };
var QR_FONT = '"MaekaSerif","Noto Serif Thai",serif';
var QR_W = 95, QR_H = 62.5, QR_TOP = 36;
var QR_PAGE = { x: [8, 107], y0: 17.5, dy: 66.5, rows: 4 };

function qrLoadScript(src) {
  return new Promise(function (ok, bad) {
    var s = document.createElement('script'); s.src = src; s.onload = ok;
    s.onerror = function () { bad(new Error('โหลด ' + src + ' ไม่สำเร็จ')); };
    document.head.appendChild(s);
  });
}

/** โหลดไลบรารี + ฟอนต์ + ตรา อบต. ครั้งเดียว */
QR.prepare = function () {
  if (QR.ready) return QR.ready;
  var thai = 'U+0E01-0E5B, U+200C-200D, U+25CC', latin = 'U+0000-00FF, U+2000-206F, U+2212';
  var fonts = [];
  [400, 700, 900].forEach(function (w) {
    fonts.push(new FontFace('MaekaSerif', 'url(/assets/fonts/noto-serif-thai-thai-' + w + '-normal.woff2) format("woff2")', { weight: String(w), unicodeRange: thai }));
    fonts.push(new FontFace('MaekaSerif', 'url(/assets/fonts/noto-serif-thai-latin-' + w + '-normal.woff2) format("woff2")', { weight: String(w), unicodeRange: latin }));
  });
  var logo = new Promise(function (ok) {
    var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = ORG.stickerLogo || ORG.logo;
  });
  QR.ready = Promise.all([
    window.qrcode ? 0 : qrLoadScript('/assets/vendor/qrcode-generator.js'),
    window.jspdf ? 0 : qrLoadScript('/assets/vendor/jspdf.umd.min.js'),
    Promise.all(fonts.map(function (f) { document.fonts.add(f); return f.load(); })).catch(function () {}),
    logo.then(function (im) { QR.logo = im; })
  ]).catch(function (e) { QR.ready = null; throw e; });
  return QR.ready;
};

/** สี่เหลี่ยมมุมโค้ง (iOS 15 และเก่ากว่าไม่มี ctx.roundRect) */
function qrRound(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

QR.url = function (r) { return QR.base + '?pole=' + encodeURIComponent(r.pole_id) + (r.k ? '&k=' + r.k : ''); };
QR.matrix = function (text) {
  var q = qrcode(0, 'M'); q.addData(text); q.make();
  var n = q.getModuleCount(), m = [];
  for (var r = 0; r < n; r++) { var row = []; for (var c = 0; c < n; c++) row.push(q.isDark(r, c)); m.push(row); }
  return m;
};
function qrMoo(id) { return String(id).split('/')[0]; }
function qrSort(a, b) { var x = a.pole_id.split('/'), y = b.pole_id.split('/'); return (x[0] - y[0]) || (x[1] - y[1]); }

/** ข้อความกึ่งกลาง ย่อขนาดอัตโนมัติถ้ายาวเกิน maxW (หน่วย px ของ canvas) */
function qrText(ctx, txt, weight, sizePx, cx, cy, maxW, color) {
  var size = sizePx;
  ctx.font = weight + ' ' + size + 'px ' + QR_FONT;
  var w = ctx.measureText(txt).width;
  if (w > maxW) { size = size * maxW / w; ctx.font = weight + ' ' + size + 'px ' + QR_FONT; }
  var m = ctx.measureText(txt);
  var asc = m.actualBoundingBoxAscent || size * 0.7, desc = m.actualBoundingBoxDescent || 0;
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(txt, cx, cy + (asc - desc) / 2);
}

/** พื้นสติกเกอร์ทั้งหมด ยกเว้นเลขเสาและ QR (s = px ต่อ มม.) */
QR.drawBase = function (ctx, s) {
  var W = QR_W * s, H = QR_H * s, r = 2 * s, lw = 0.4 * s;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  qrRound(ctx, lw / 2, lw / 2, W - lw, H - lw, r); ctx.clip();
  // ลายตารางเพชรด้านบน
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, QR_TOP * s); ctx.clip();
  ctx.strokeStyle = '#eee6cf'; ctx.lineWidth = Math.max(1, 0.26 * s);
  var t = 3.175 * s;
  ctx.beginPath();
  for (var y = 0; y < QR_TOP * s; y += t) for (var x = 0; x < W; x += t) {
    ctx.moveTo(x + t / 2, y); ctx.lineTo(x + t, y + t / 2); ctx.lineTo(x + t / 2, y + t); ctx.lineTo(x, y + t / 2); ctx.closePath();
  }
  ctx.stroke(); ctx.restore();
  qrText(ctx, 'หมายเลขโคมไฟฟ้าสาธารณะ', 700, 5.2 * s, W / 2, 6 * s, 89 * s, '#222');
  ctx.fillStyle = '#e8891c'; ctx.fillRect(0, QR_TOP * s, W, 1 * s);
  // ส่วนล่าง: ตรา · ข้อความ · (QR วาดแยก)
  var by = QR_TOP + 1, bh = QR_H - by;
  if (QR.logo) ctx.drawImage(QR.logo, 3 * s, (by + (bh - 16) / 2) * s, 16 * s, 16 * s);
  var top = by + (bh - 13.8) / 2, cx = 45.5 * s, mw = 47 * s;
  qrText(ctx, ORG.short, 700, 3.9 * s, cx, (top + 2.44) * s, mw, '#1a1a1a');
  qrText(ctx, 'แจ้งซ่อมไฟฟ้าสาธารณะ', 700, 3.9 * s, cx, (top + 7.31) * s, mw, '#1a1a1a');
  qrText(ctx, 'สแกน QR code หรือ โทร. ' + (ORG.stickerPhone || ORG.phone), 400, 2.6 * s, cx, (top + 12.18) * s, mw, '#333');
  ctx.restore();
  ctx.strokeStyle = '#c8b78a'; ctx.lineWidth = lw;
  qrRound(ctx, lw / 2, lw / 2, W - lw, H - lw, r); ctx.stroke();
};
/** เลขเสาตัวใหญ่ ในกล่อง 89 x 25 มม. ที่มุม (ox, oy) */
QR.drawNumber = function (ctx, s, id, ox, oy) {
  qrText(ctx, id, 900, 24 * s, ox + 44.5 * s, oy + 12.5 * s, 87 * s, '#111');
};
/** ตำแหน่ง QR ในสติกเกอร์ (มม.) */
var QR_BOX = { x: 72, y: QR_TOP + 1 + (QR_H - QR_TOP - 1 - 20) / 2, size: 20 };
QR.drawQrCanvas = function (ctx, s, m) {
  var n = m.length, cell = QR_BOX.size / (n + 2) * s, x0 = QR_BOX.x * s + cell, y0 = QR_BOX.y * s + cell;
  ctx.fillStyle = '#000';
  for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (m[r][c]) ctx.fillRect(x0 + c * cell, y0 + r * cell, Math.ceil(cell), Math.ceil(cell));
};

/** สติกเกอร์ตัวอย่างบนจอ (canvas เดียวต่อดวง) */
QR.preview = function (r) {
  var s = 4 * Math.min(2, window.devicePixelRatio || 1), c = document.createElement('canvas');
  c.width = QR_W * s; c.height = QR_H * s; c.className = 'w-full h-auto block'; c.setAttribute('role', 'img');
  c.setAttribute('aria-label', 'สติกเกอร์เสา ' + r.pole_id);
  var ctx = c.getContext('2d');
  QR.drawBase(ctx, s); QR.drawNumber(ctx, s, r.pole_id, 3 * s, 9.5 * s); QR.drawQrCanvas(ctx, s, QR.matrix(QR.url(r)));
  return c;
};

QR.rowsFor = function (moo) { return (QR.data || []).filter(function (r) { return !moo || qrMoo(r.pole_id) === moo; }); };
QR.groups = function () {
  var g = {}, order = [];
  (QR.data || []).forEach(function (r) { var m = qrMoo(r.pole_id); if (!g[m]) { g[m] = []; order.push(m); } g[m].push(r); });
  return { g: g, order: order };
};

QR.init = async function (el) {
  if (QR.el) return;
  QR.el = el;
  el.innerHTML = '<div class="p-3 md:p-4"><div class="' + T.card + '">กำลังโหลดข้อมูลเสา…</div></div>';
  try {
    var j = await api('/api/poles?qr=1');
    QR.base = j.base; QR.signed = j.signed; QR.data = j.rows.sort(qrSort);
    var G = QR.groups();
    QR.moo = G.order.filter(function (m) { return m !== '1' || G.g[m].length > 1; })[0] || G.order[0] || '';
    QR.render();
    await QR.prepare();
    QR.renderPreview();
  } catch (e) {
    QR.el = null;
    el.innerHTML = '<div class="p-3 md:p-4"><div class="' + T.card + ' text-[var(--new)]">โหลดไม่สำเร็จ: ' + esc(e.message) + '</div></div>';
  }
};

QR.render = function () {
  var G = QR.groups(), other = QR.base.indexOf('//' + location.host + '/') < 0;
  var chips = [['', 'ทุกหมู่', QR.data.length]].concat(G.order.map(function (m) { return [m, 'หมู่ ' + m, G.g[m].length]; }));
  QR.el.innerHTML = '<div class="p-3 md:p-4 grid gap-3">' +
    '<div class="' + T.card + ' grid gap-2">' +
      '<h2 class="m-0 text-lg font-bold">สติกเกอร์ QR เสาไฟ</h2>' +
      '<p class="m-0 text-sm text-muted">เลือกหมู่ แล้วกดดาวน์โหลด PDF (กระดาษ A4 หน้าละ 8 ดวง ขนาดดวงละ 95 x 62.5 มม.) ตอนพิมพ์ให้ตั้ง <b>ขนาดจริง / 100%</b> เปิดได้ทุกเครื่องที่ล็อกอินแอดมิน</p>' +
      '<p class="m-0 text-sm">QR พาไปที่ <code class="bg-paper px-1 rounded break-all">' + esc(QR.base) + '</code>' +
        (QR.signed ? ' · <span class="text-[var(--done)] font-semibold">มีลายเซ็นกันปลอม ✓</span>' : ' · <span class="text-[var(--new)] font-semibold">ยังไม่ได้ตั้ง QR_SECRET ใน Vercel — QR ไม่มีลายเซ็น</span>') + '</p>' +
      (other ? '<p class="m-0 text-sm text-accent-dark bg-accent-soft rounded-[10px] px-3 py-2">กำลังเปิดจากโดเมนอื่น QR จะยังพาไปที่โดเมนหลักด้านบน ถ้าจะใช้โดเมนของตัวเองให้ตั้ง <code>QR_BASE_URL</code> ใน Vercel</p>' : '') +
    '</div>' +
    '<div class="' + T.card + ' grid gap-3">' +
      '<div class="flex flex-wrap gap-1.5" id="qr_chips">' + chips.map(function (c) {
        return '<button type="button" data-moo="' + c[0] + '" class="qr-chip px-3 py-1.5 rounded-full border-2 text-sm font-semibold cursor-pointer">' + esc(c[1]) + ' <span class="font-normal opacity-75">' + c[2] + '</span></button>';
      }).join('') + '</div>' +
      '<div class="flex flex-wrap items-center gap-2">' +
        '<input id="qr_q" type="search" inputmode="numeric" class="' + T.input + ' max-w-56" placeholder="ค้นหาเลขเสา เช่น 7/26" aria-label="ค้นหาเลขเสา">' +
        '<button type="button" id="qr_pdf" class="' + T.btn + '">' + ico('down') + '<span id="qr_pdf_t">ดาวน์โหลด PDF</span></button>' +
        '<span id="qr_msg" class="text-sm text-muted" role="status"></span>' +
      '</div>' +
      '<div id="qr_link" class="text-sm"></div>' +
    '</div>' +
    '<div id="qr_prev" class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))"></div>' +
  '</div>';
  QR.el.querySelectorAll('.qr-chip').forEach(function (b) { b.onclick = function () { QR.setMoo(b.dataset.moo); }; });
  document.getElementById('qr_pdf').onclick = function () { QR.download(); };
  document.getElementById('qr_q').oninput = function () { QR.find(this.value); };
  QR.paintChips();
};
QR.paintChips = function () {
  QR.el.querySelectorAll('.qr-chip').forEach(function (b) {
    var on = b.dataset.moo === QR.moo;
    b.className = 'qr-chip px-3 py-1.5 rounded-full border-2 text-sm font-semibold cursor-pointer ' + (on ? 'bg-brand border-brand text-white' : 'bg-white border-line text-ink hover:bg-brand-soft');
    b.setAttribute('aria-pressed', String(on));
  });
  var rows = QR.rowsFor(QR.moo), pages = QR.pageCount(QR.moo);
  document.getElementById('qr_pdf_t').textContent = 'ดาวน์โหลด PDF ' + (QR.moo ? 'หมู่ ' + QR.moo : 'ทุกหมู่') + ' (' + rows.length + ' ดวง · ' + pages + ' หน้า)';
};
QR.pageCount = function (moo) {
  var G = QR.groups(), n = 0;
  G.order.forEach(function (m) { if (!moo || m === moo) n += Math.ceil(G.g[m].length / 8); });
  return n;
};
QR.setMoo = function (m) {
  QR.moo = m; document.getElementById('qr_q').value = '';
  document.getElementById('qr_link').innerHTML = '';
  QR.paintChips(); QR.renderPreview();
};
QR.renderPreview = function () {
  var box = document.getElementById('qr_prev'); if (!box) return;
  box.innerHTML = '';
  if (!QR.moo) { box.innerHTML = '<p class="text-sm text-muted m-0">เลือกหมู่เพื่อดูตัวอย่างสติกเกอร์ (ปุ่มดาวน์โหลดจะรวมทุกหมู่ไว้ในไฟล์เดียว แยกหน้าตามหมู่)</p>'; return; }
  var rows = QR.rowsFor(QR.moo), i = 0, gen = QR.gen = (QR.gen || 0) + 1;
  (function chunk() {   // วาดทีละชุด จอไม่ค้างบนมือถือ (หยุดเมื่อผู้ใช้เปลี่ยนหมู่)
    if (gen !== QR.gen) return;
    var end = Math.min(rows.length, i + 12);
    for (; i < end; i++) {
      var w = document.createElement('div'); w.id = 'qrp-' + rows[i].pole_id; w.className = 'rounded-[6px]';
      w.appendChild(QR.preview(rows[i])); box.appendChild(w);
    }
    if (i < rows.length) setTimeout(chunk, 0);
  })();
};
QR.find = function (v) {
  var q = String(v || '').trim().replace(/[-\s]/g, '/'), msg = document.getElementById('qr_msg');
  QR.el.querySelectorAll('#qr_prev .ring-4').forEach(function (e) { e.classList.remove('ring-4', 'ring-accent'); });
  if (!q) { msg.textContent = ''; return; }
  var hit = (QR.data || []).filter(function (r) { return r.pole_id === q; })[0];
  if (!hit) { msg.textContent = 'ไม่พบเสา ' + q; return; }
  if (QR.moo !== qrMoo(q)) { QR.moo = qrMoo(q); QR.paintChips(); QR.renderPreview(); }
  msg.textContent = 'พบเสา ' + q + ' ในหมู่ ' + qrMoo(q);
  setTimeout(function () {
    var el = document.getElementById('qrp-' + q); if (!el) return;
    el.classList.add('ring-4', 'ring-accent');
    el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, 300);
};

/** วาด QR เป็นเวกเตอร์ใน PDF (คมทุกขนาด ไฟล์เล็ก) — รวมช่องดำที่ติดกันในแถวเป็นแท่งเดียว */
function qrPdfMatrix(doc, m, x, y) {
  var n = m.length, cell = QR_BOX.size / (n + 2), x0 = x + QR_BOX.x + cell, y0 = y + QR_BOX.y + cell;
  doc.setFillColor(0, 0, 0);
  for (var r = 0; r < n; r++) {
    var c = 0;
    while (c < n) {
      if (!m[r][c]) { c++; continue; }
      var st = c; while (c < n && m[r][c]) c++;
      doc.rect(x0 + st * cell, y0 + r * cell, (c - st) * cell, cell + 0.02, 'F');
    }
  }
}
function qrCanvasImg(wMm, hMm, s, draw, type) {
  var c = document.createElement('canvas'); c.width = Math.round(wMm * s); c.height = Math.round(hMm * s);
  var ctx = c.getContext('2d'); draw(ctx);
  return c.toDataURL(type || 'image/png');
}

QR.download = async function () {
  if (QR.busy) return;
  var btn = document.getElementById('qr_pdf'), msg = document.getElementById('qr_msg');
  QR.busy = true; btn.disabled = true;
  try {
    msg.textContent = 'กำลังเตรียมฟอนต์…';
    await QR.prepare();
    var S = 10, G = QR.groups(), moos = G.order.filter(function (m) { return !QR.moo || m === QR.moo; });
    var total = moos.reduce(function (a, m) { return a + G.g[m].length; }, 0), done = 0, pageNo = 0, pages = QR.pageCount(QR.moo);
    var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    doc.setProperties({ title: 'สติกเกอร์ QR เสาไฟ ' + ORG.short + (QR.moo ? ' หมู่ ' + QR.moo : ''), creator: ORG.short });
    var base = qrCanvasImg(QR_W, QR_H, S, function (ctx) { QR.drawBase(ctx, S); }, 'image/jpeg');
    for (var mi = 0; mi < moos.length; mi++) {
      var list = G.g[moos[mi]];
      for (var p = 0; p * 8 < list.length; p++) {
        if (pageNo++) doc.addPage();
        var title = ORG.short + ' · หมู่ ' + moos[mi] + ' · แผ่นที่ ' + (p + 1) + '/' + Math.ceil(list.length / 8) + ' · หน้า ' + pageNo + '/' + pages;
        doc.addImage(qrCanvasImg(194, 6, 8, function (ctx) {
          ctx.font = '700 ' + (3.4 * 8) + 'px ' + QR_FONT; ctx.fillStyle = '#555'; ctx.textBaseline = 'middle'; ctx.fillText(title, 0, 3 * 8);
        }), 'PNG', 8, 8, 194, 6);
        list.slice(p * 8, p * 8 + 8).forEach(function (r, i) {
          var x = QR_PAGE.x[i % 2], y = QR_PAGE.y0 + Math.floor(i / 2) * QR_PAGE.dy;
          doc.addImage(base, 'JPEG', x, y, QR_W, QR_H, 'sticker-base');
          doc.addImage(qrCanvasImg(89, 25, S, function (ctx) { QR.drawNumber(ctx, S, r.pole_id, 0, 0); }), 'PNG', x + 3, y + 9.5, 89, 25);
          qrPdfMatrix(doc, QR.matrix(QR.url(r)), x, y);
          done++;
        });
        msg.textContent = 'กำลังสร้าง PDF ' + done + '/' + total + ' ดวง…';
        await new Promise(function (ok) { setTimeout(ok, 0); });
      }
    }
    // ชื่อไฟล์ภาษาอังกฤษ: Chrome ไม่รับชื่อไทยที่มีวรรณยุกต์ (กลายเป็น "download")
    var name = 'QR_' + (ORG.slug || 'poles') + (QR.moo ? '_moo' + QR.moo : '_all') + '.pdf';
    var blob = doc.output('blob'), url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    msg.textContent = 'สร้างแล้ว ' + total + ' ดวง ' + pages + ' หน้า (' + Math.round(blob.size / 1024) + ' KB)';
    document.getElementById('qr_link').innerHTML = 'ถ้าไฟล์ไม่ดาวน์โหลดเอง <a class="text-brand font-semibold underline" target="_blank" rel="noopener" href="' + url + '">กดเปิด PDF ที่นี่</a> แล้วกดแชร์/บันทึก';
  } catch (e) {
    msg.textContent = 'สร้าง PDF ไม่สำเร็จ: ' + e.message;
  } finally { QR.busy = false; btn.disabled = false; }
};
