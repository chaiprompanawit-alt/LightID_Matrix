// โค้ดใช้ร่วมหน้าช่าง/แอดมิน: ล็อกอิน, เรียก API, แผนที่ Leaflet, รายการงาน (markup เป็น Tailwind)
var STATUS = ['แจ้งใหม่','รับเรื่องแล้ว','กำลังดำเนินการ','เสร็จสิ้น','ปิดงาน/ไม่พบปัญหา','แจ้งเท็จ'];
var OPEN_STATUS = STATUS.slice(0,3);
var CLS = { 'แจ้งใหม่':['s-new','p-new','#b42318'], 'รับเรื่องแล้ว':['s-recv','p-recv','#b54708'],
  'กำลังดำเนินการ':['s-prog','p-prog','#1e4e9a'], 'เสร็จสิ้น':['s-done','p-done','#067647'],
  'ปิดงาน/ไม่พบปัญหา':['s-close','p-close','#475467'], 'แจ้งเท็จ':['s-fake','p-fake','#101828'] };
// สัญลักษณ์ประจำสถานะ (อักขระมาตรฐาน แสดงเหมือนกันทุกเครื่อง) ใช้คู่กับสีเสมอ เพื่อคนตาบอดสีหรือจอกลางแดด
var SYM = { 'แจ้งใหม่':'●', 'รับเรื่องแล้ว':'◔', 'กำลังดำเนินการ':'◑', 'เสร็จสิ้น':'✓', 'ปิดงาน/ไม่พบปัญหา':'○', 'แจ้งเท็จ':'✕' };
var MAP_CENTER = (window.ORG && ORG.mapCenter) || [18.582125, 98.952782];
var HOME = (window.ORG && ORG.navFrom) || MAP_CENTER;   // ที่ทำการ อบต. = จุดเริ่มนำทาง (แสดงหมุดบนแผนที่เสมอ)
var SLA_DAYS = (window.ORG && ORG.sla_days) || 10;

// ไอคอน SVG inline (Tabler Icons, MIT) ไม่ต้องโหลดไลบรารี
var ICO = {
  nav:'<path d="M16.54 19.977a.34 .34 0 0 0 .357 -.07a.33 .33 0 0 0 .084 -.352l-4.98 -14.28a.31 .31 0 0 0 -.115 -.157a.32 .32 0 0 0 -.478 .157l-5.024 14.28a.33 .33 0 0 0 .084 .352a.34 .34 0 0 0 .357 .071l5.026 -3.06l5.03 3.06z"/>',
  phone:'<path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2"/>',
  lock:'<path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z"/><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0"/><path d="M8 11v-4a4 4 0 1 1 8 0v4"/>',
  warn:'<path d="M12 9v4"/><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z"/><path d="M12 16h.01"/>',
  check:'<path d="M5 12l5 5l10 -10"/>',
  pin:'<path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"/>',
  refresh:'<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>',
  clock:'<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 7v5l3 3"/>',
  user:'<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"/><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/>',
  bell:'<path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6"/><path d="M9 17v1a3 3 0 0 0 6 0v-1"/>',
  x:'<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>',
  app:'<path d="M6 5a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/><path d="M11 4h2"/><path d="M12 17v.01"/>',
  print:'<path d="M17 17h2a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2h-14a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2"/><path d="M17 9v-4a2 2 0 0 0 -2 -2h-6a2 2 0 0 0 -2 2v4"/><path d="M7 13m0 2a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2z"/>',
  down:'<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4v12"/>',
  map:'<path d="M3 7l6 -3l6 3l6 -3v13l-6 3l-6 -3l-6 3v-13"/><path d="M9 4v13"/><path d="M15 7v13"/>',
  list:'<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M5 6v.01"/><path d="M5 12v.01"/><path d="M5 18v.01"/>',
  search:'<path d="M3 10a7 7 0 1 0 14 0a7 7 0 0 0 -14 0"/><path d="M21 21l-6 -6"/>',
  save:'<path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2"/><path d="M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M14 4l0 4l-6 0l0 -4"/>',
  camera:'<path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2"/><path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/>',
  trash:'<path d="M4 7l16 0"/><path d="M10 11l0 6"/><path d="M14 11l0 6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
  edit:'<path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1"/><path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z"/><path d="M16 5l3 3"/>'
};
function ico(n, cls){ return '<svg class="ic '+(cls||'')+'" viewBox="0 0 24 24" aria-hidden="true">'+ICO[n]+'</svg>'; }
/** pill สถานะ = สี + สัญลักษณ์ + ข้อความ */
function pill(status, extra){ var c=CLS[status]||['','','']; return '<span class="'+T.pill+' '+c[1]+' '+(extra||'')+'"><span aria-hidden="true">'+(SYM[status]||'')+'</span>'+esc(status)+'</span>'; }
/** จำนวนวันที่เกิน SLA (0 = ยังไม่เกิน / งานปิดแล้ว) นับวันปฏิทินโดยประมาณ */
function slaOver(r){ if(OPEN_STATUS.indexOf(r.status)<0) return 0; var d=Math.floor((Date.now()-new Date(r.created_at))/864e5)-SLA_DAYS; return d>0?d:0; }

// ชุด class Tailwind ที่ใช้บ่อย (กฎรัศมี: ปุ่ม/ช่องกรอก 10px · การ์ด 16px · ป้าย/ชิป = pill)
var T = {
  input: 'w-full px-3 py-2.5 rounded-[10px] border border-line bg-white text-ink text-base placeholder:text-slate-500 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30',
  btn: 'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[10px] bg-brand text-white font-bold text-base hover:bg-brand-dark disabled:opacity-60 cursor-pointer no-underline',
  btnSm: 'inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-[10px] text-sm font-semibold cursor-pointer no-underline',
  btnOut: 'inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-[10px] text-sm font-semibold cursor-pointer no-underline border-2 border-brand text-brand bg-white hover:bg-brand-soft',
  pill: 'inline-flex items-center gap-1 text-xs text-white px-2.5 py-0.5 rounded-full font-semibold whitespace-nowrap',
  card: 'bg-white border border-line rounded-2xl p-4',
  stat: 'bg-white border border-line rounded-[10px] px-3 py-1.5 text-sm text-muted cursor-pointer select-none hover:bg-brand-soft'
};

function esc(s){ return String(s==null?'':s).replace(/[<>&"]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c];}); }
function mooOf(id){ var m=String(id||'').split('/'); return m.length>1?m[0]:''; }
function fmtDT(iso){ if(!iso) return ''; return new Date(iso).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}); }
function fmtD(iso){ if(!iso) return ''; return new Date(iso).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'}); }
function gmaps(lat,lng){   // เปิดโหมดนำทางทันที เริ่มจาก อบต. (ORG.navFrom) ถ้าตั้งไว้ ไม่งั้นเริ่มจาก GPS มือถือ
  var o = window.ORG && ORG.navFrom;
  return 'https://www.google.com/maps/dir/?api=1'+(o?'&origin='+o[0]+','+o[1]:'')+'&destination='+lat+','+lng;
}
function ago(iso){ var h=(Date.now()-new Date(iso))/36e5; if(h<1) return Math.round(h*60)+' นาที'; if(h<48) return Math.round(h)+' ชม.'; return Math.round(h/24)+' วัน'; }

/* ---------- PWA: ติดตั้งเป็นแอปบนมือถือ/แท็บเล็ต/คอม ---------- */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function(){});
var _installEvt = null;
window.addEventListener('beforeinstallprompt', function(e){
  e.preventDefault(); _installEvt = e;
  if (localStorage.getItem('saofi_install_hide')) return;
  var bar=document.createElement('div'); bar.id='installBar';
  bar.className='noprint bg-brand-dark text-white text-sm px-4 py-2.5 flex items-center gap-3 shadow-lg';
  bar.innerHTML='<span class="flex-1 inline-flex items-center gap-2">'+ico('app')+'ติดตั้งเป็นแอปบนเครื่อง เปิดใช้เร็วขึ้น ไม่ต้องพิมพ์ลิงก์</span>'+
    '<button class="bg-white text-brand font-bold rounded-[10px] px-3 py-1.5" id="installGo">ติดตั้ง</button>'+
    '<button class="opacity-70 px-2" id="installNo" aria-label="ปิด">'+ico('x')+'</button>';
  document.body.appendChild(bar);
  document.getElementById('installGo').onclick=function(){ bar.remove(); if(_installEvt){ _installEvt.prompt(); _installEvt=null; } };
  document.getElementById('installNo').onclick=function(){ bar.remove(); localStorage.setItem('saofi_install_hide','1'); };
});

/* ---------- session ---------- */
var Auth = {
  get: function(){ try { return JSON.parse(localStorage.getItem('saofi_session')||'null'); } catch(e){ return null; } },
  set: function(s){ localStorage.setItem('saofi_session', JSON.stringify(s)); },
  clear: function(){ localStorage.removeItem('saofi_session'); location.reload(); }
};
async function api(path, opts){
  opts = opts||{}; var s = Auth.get();
  var headers = Object.assign({'Content-Type':'application/json'}, s ? {'Authorization':'Bearer '+s.token} : {});
  var r = await fetch(path, { method: opts.method||'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (r.status === 401 && s) { Auth.clear(); return; }
  var j = await r.json().catch(function(){ return {}; });
  if (!r.ok) throw new Error(j.error || ('ผิดพลาด '+r.status));
  return j;
}

/* ---------- หน้าล็อกอิน (ใช้ทั้งช่างและแอดมิน) ---------- */
function renderGate(rootId, title, onOk){
  document.getElementById(rootId).innerHTML =
    '<div class="max-w-sm mx-auto mt-10 md:mt-16 px-4">'+
    '<div class="flex items-center gap-3 mb-5"><img src="'+ORG.logo+'" alt="" class="h-14 w-14 rounded-full bg-white border border-line object-cover" onerror="this.remove()">'+
    '<div><div class="font-extrabold text-brand text-lg leading-tight">'+esc(ORG.short)+'</div><div class="text-sm text-muted">'+esc(ORG.dept)+' · สำหรับเจ้าหน้าที่</div></div></div>'+
    '<div class="'+T.card+' p-6">'+
    '<h2 class="text-xl font-bold m-0 mb-4 flex items-center gap-2">'+ico('lock','text-brand')+esc(title)+'</h2>'+
    '<label class="block font-bold mb-1">ชื่อผู้ใช้</label><input id="lg_u" class="'+T.input+'" autocomplete="username" autocapitalize="off">'+
    '<label class="block font-bold mt-4 mb-1">รหัสผ่าน</label><input id="lg_p" type="password" class="'+T.input+'" autocomplete="current-password">'+
    '<div class="text-[var(--new)] text-sm mt-2 min-h-5" id="lg_e" role="alert"></div>'+
    '<button class="'+T.btn+' w-full mt-2 py-3" id="lg_b">เข้าสู่ระบบ</button></div></div>';
  var go = async function(){
    var b=document.getElementById('lg_b'); b.disabled=true;
    try {
      var j = await api('/api/login',{method:'POST',body:{username:document.getElementById('lg_u').value,password:document.getElementById('lg_p').value}});
      Auth.set(j); onOk(j);
    } catch(e){ document.getElementById('lg_e').textContent=e.message; b.disabled=false; }
  };
  document.getElementById('lg_b').onclick=go;
  document.getElementById('lg_p').onkeydown=function(e){ if(e.key==='Enter') go(); };
}
/** แถบบนสุด: ชื่อระบบ + ผู้ใช้ + ออกจากระบบ */
function topbarHtml(title, extra){
  var me=Auth.get()||{};
  return '<header class="noprint sticky top-0 z-[1000] bg-brand text-white px-3 md:px-4 py-2 flex items-center justify-between gap-2">'+
    '<div class="flex items-center gap-2.5 min-w-0"><img src="'+ORG.logo+'" alt="" class="h-9 w-9 rounded-full bg-white object-cover flex-none" onerror="this.remove()">'+
    '<div class="min-w-0 leading-tight"><h1 class="text-sm sm:text-base md:text-lg font-extrabold m-0 leading-tight">'+title+'</h1><div class="text-xs opacity-85 hidden sm:block">'+esc(ORG.short)+' · '+esc(ORG.dept)+'</div></div></div>'+
    '<div class="flex items-center gap-1.5 md:gap-2 text-sm flex-none">'+(extra||'')+
    '<span class="hidden sm:inline-flex items-center gap-1 opacity-90">'+ico('user')+esc(me.name||'')+' <span class="opacity-70">('+(me.role==='admin'?'แอดมิน':'ช่าง')+')</span></span>'+
    '<button onclick="Auth.clear()" class="bg-white/15 hover:bg-white/25 rounded-[10px] px-2.5 py-1 cursor-pointer">ออกจากระบบ</button></div></header>';
}

/* ---------- แดชบอร์ดงาน (แผนที่ + รายการ) ---------- */
var Board = { data:[], map:null, markers:null, filter:{status:'',moo:'',q:'',mine:false}, onBlock:null };

Board.initMap = function(){
  Board.map = L.map('map').setView(HOME, 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(Board.map);
  // หมุดที่ทำการ อบต. (จุดเริ่มนำทาง) — อยู่บนแผนที่ตลอด ไม่ถูกล้างตอนกรองงาน
  var homeIcon = L.divIcon({ className:'', iconSize:[38,46], iconAnchor:[19,44], popupAnchor:[0,-40],
    html:'<div style="position:relative;width:38px;height:46px"><svg viewBox="0 0 38 46" width="38" height="46" aria-hidden="true">'+
      '<path d="M19 45C19 45 3 28.5 3 18a16 16 0 1 1 32 0C35 28.5 19 45 19 45z" fill="#1e4e9a" stroke="#fff" stroke-width="2.5"/>'+
      '<path d="M11 19.5l8-7 8 7M13.5 17.5v8h11v-8M17 25.5v-4.5h4v4.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' });
  L.marker(HOME, { icon:homeIcon, zIndexOffset:1000, title:'ที่ทำการ '+ORG.short, keyboard:true }).addTo(Board.map)
    .bindPopup('<b class="text-base">ที่ทำการ '+esc(ORG.short)+'</b><br><span class="text-sm text-muted">จุดเริ่มนำทางของช่าง</span>');
  // ปุ่มกลับไปที่ อบต. (ใต้ปุ่มซูม)
  var Home = L.Control.extend({ options:{ position:'topleft' }, onAdd:function(){
    var b = L.DomUtil.create('a','leaflet-bar'); b.href='#'; b.title='กลับไปที่ '+ORG.short; b.setAttribute('role','button'); b.setAttribute('aria-label', b.title);
    b.style.cssText='display:flex;align-items:center;justify-content:center;width:34px;height:34px;background:#fff;color:#1e4e9a';
    b.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l-2 0l9 -9l9 9l-2 0"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"/><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6"/></svg>';
    L.DomEvent.on(b,'click',function(e){ L.DomEvent.preventDefault(e); L.DomEvent.stopPropagation(e); Board.fit(); });
    return b; } });
  Board.map.addControl(new Home());
  Board.markers = L.layerGroup().addTo(Board.map);
  // Tailwind (CDN) ใส่สไตล์หลัง Leaflet วัดขนาดกล่องไปแล้ว → วัดใหม่อีกรอบ ไม่งั้นแผนที่/หมุดเพี้ยน
  [300, 1000, 2500].forEach(function(ms){ setTimeout(function(){ Board.map.invalidateSize(); Board.fit(); }, ms); });
  window.addEventListener('resize', function(){ Board.map.invalidateSize(); });
};
/** อบต. อยู่กลางจอเสมอ แล้วซูมออกพอให้เห็นงานทุกจุด (ใส่จุดสะท้อนรอบ อบต. ให้กรอบสมมาตร) */
Board.fit = function(){
  var pts = Board._pts || [];
  if (!pts.length) { Board.map.setView(HOME, 15); return; }
  var b = [HOME];
  pts.forEach(function(p){ b.push(p, [2*HOME[0]-p[0], 2*HOME[1]-p[1]]); });
  Board.map.fitBounds(b, {padding:[30,30], maxZoom:16});
};
/** ระยะทางเส้นตรงจาก อบต. (ประมาณ) */
function fromHome(lat,lng){ var m=L.latLng(HOME).distanceTo([+lat,+lng]); return m<1000? Math.round(m/10)*10+' ม.' : (m/1000).toFixed(1)+' กม.'; }
Board.load = async function(){
  Board.data = await api('/api/reports') || [];
  var sel=document.getElementById('f_moo'), cur=sel.value, moos={};
  Board.data.forEach(function(r){ var m=mooOf(r.pole_id); if(m) moos[m]=1; });
  sel.innerHTML='<option value="">ทุกหมู่</option>'+Object.keys(moos).sort(function(a,b){return a-b;}).map(function(m){return '<option value="'+m+'"'+(m===cur?' selected':'')+'>หมู่ '+m+'</option>';}).join('');
  Board.render();
};
Board.render = function(){
  var f=Board.filter, me=Auth.get()||{};
  f.status=document.getElementById('f_status').value; f.moo=document.getElementById('f_moo').value; f.q=document.getElementById('f_q').value.trim().toLowerCase();
  var rows = Board.data.filter(function(r){
    if(f.status==='__open'){ if(OPEN_STATUS.indexOf(r.status)<0) return false; }
    else if(f.status==='__over'){ if(!slaOver(r)) return false; }
    else if(f.status && r.status!==f.status) return false;
    if(f.moo && mooOf(r.pole_id)!==f.moo) return false;
    if(f.mine && r.assigned_to!==me.name) return false;
    if(f.q && (r.pole_id+' '+r.reporter_name+' '+r.reporter_phone+' '+r.detail+' '+r.report_id).toLowerCase().indexOf(f.q)<0) return false;
    return true;
  });
  // งานเกิน SLA ขึ้นก่อน → งานค้าง → ที่เหลือ (ใหม่สุดก่อน)
  rows.sort(function(a,b){ var oa=slaOver(a), ob=slaOver(b); if(!!oa!==!!ob) return ob-oa; var pa=OPEN_STATUS.indexOf(a.status)>=0, pb=OPEN_STATUS.indexOf(b.status)>=0; if(pa!==pb) return pb-pa; return new Date(b.created_at)-new Date(a.created_at); });
  document.getElementById('f_count').textContent='แสดง '+rows.length+' รายการ';
  Board.renderPhotoNotice();

  var cnt={}, open=0, over=0; Board.data.forEach(function(r){ cnt[r.status]=(cnt[r.status]||0)+1; if(OPEN_STATUS.indexOf(r.status)>=0) open++; if(slaOver(r)) over++; });
  var on=function(v){ return f.status===v?' ring-2 ring-brand border-brand':''; };
  // กล่องหลัก 2 ใบ (งานค้าง / เกิน SLA) ใหญ่กว่า แล้วค่อยตามด้วยตัวกรองสถานะย่อย
  document.getElementById('stats').innerHTML =
    '<div class="flex gap-2 w-full sm:w-auto">'+
    '<button type="button" class="flex-1 sm:flex-none text-left rounded-2xl border-2 px-4 py-2.5 bg-white cursor-pointer '+(f.status==='__open'?'border-brand ring-2 ring-brand/30':'border-line')+'" onclick="Board.setStatus(\'__open\')"><div class="text-xs font-semibold text-muted">งานค้าง</div><div class="text-3xl font-extrabold leading-none text-[var(--new)]">'+open+'</div></button>'+
    '<button type="button" class="flex-1 sm:flex-none text-left rounded-2xl border-2 px-4 py-2.5 cursor-pointer '+(f.status==='__over'?'border-accent-dark ring-2 ring-accent/50':'border-accent')+' bg-accent-soft" onclick="Board.setStatus(\'__over\')"><div class="text-xs font-semibold text-accent-dark inline-flex items-center gap-1">'+ico('warn')+'เกิน SLA '+SLA_DAYS+' วัน</div><div class="text-3xl font-extrabold leading-none text-accent-dark">'+over+'</div></button></div>'+
    '<div class="flex flex-wrap gap-1.5 items-center">'+
    '<span class="'+T.stat+on('')+'" onclick="Board.setStatus(\'\')">ทั้งหมด <b class="text-ink ml-1">'+Board.data.length+'</b></span>'+
    STATUS.map(function(k){ return cnt[k]?'<span class="'+T.stat+on(k)+'" onclick="Board.setStatus(\''+k+'\')"><span aria-hidden="true" style="color:'+CLS[k][2]+'">'+SYM[k]+'</span> '+k+' <b class="text-ink ml-1">'+cnt[k]+'</b></span>':''; }).join('')+'</div>';

  Board.markers.clearLayers(); var pts=[];
  rows.forEach(function(r){
    if(r.lat&&r.lng){
      var c=(CLS[r.status]||['','','#888'])[2];
      var ov=slaOver(r);
      var m=L.circleMarker([+r.lat,+r.lng],{radius:ov?12:10,color:ov?'#f2b632':'#fff',weight:ov?4:2,fillColor:c,fillOpacity:.95});
      m.bindPopup('<b class="text-base">เสา '+esc(r.pole_id)+'</b> '+pill(r.status)+(ov?' <span class="'+T.pill+' bg-accent-soft text-accent-dark border border-accent">เกิน SLA '+ov+' วัน</span>':'')+'<br>'+esc(r.detail)+
        '<br><span class="text-xs text-muted">ห่างจาก '+esc(ORG.short)+' ~'+fromHome(r.lat,r.lng)+' (เส้นตรง)</span>'+
        '<br><a class="'+T.btnSm+' bg-brand text-white mt-1.5" style="color:#fff" href="'+gmaps(r.lat,r.lng)+'" target="_blank" rel="noopener">'+ico('nav')+'นำทางจาก '+esc(ORG.short)+'</a>');
      Board.markers.addLayer(m); pts.push([+r.lat,+r.lng]);
    }
  });
  Board._pts = pts;
  Board.fit();

  document.getElementById('list').innerHTML = rows.map(function(r){
    var c=CLS[r.status]||['','',''], id=r.report_id.replace(/[^A-Za-z0-9]/g,''), ov=slaOver(r), isOpen=OPEN_STATUS.indexOf(r.status)>=0;
    var nav=(r.lat&&r.lng)?'<a class="'+T.btn+' py-2 flex-1 sm:flex-none" href="'+gmaps(r.lat,r.lng)+'" target="_blank" rel="noopener">'+ico('nav')+'นำทาง</a>':'<span class="text-sm text-muted self-center">ไม่มีพิกัด</span>';
    var opts=STATUS.map(function(s){return '<option'+(s===r.status?' selected':'')+'>'+s+'</option>';}).join('');
    var fake = r.fake_count>0 ? ' <span class="'+T.pill+' p-fake" title="เบอร์นี้เคยถูกตีเป็นแจ้งเท็จ">'+SYM['แจ้งเท็จ']+' เคยแจ้งเท็จ '+r.fake_count+' ครั้ง</span>' : '';
    var blk = (Board.onBlock && r.fake_count>0) ? ' <a href="#" onclick="Board.onBlock(\''+esc(r.reporter_phone)+'\');return false" class="text-[var(--new)] underline">บล็อกเบอร์</a>' : '';
    return '<div class="bg-white border border-line border-l-[6px] rounded-2xl p-3.5 mb-2.5 '+c[0]+(ov?' sla-over':'')+'" id="it_'+id+'">'+
      '<div class="flex justify-between items-start gap-2">'+
        '<div><h3 class="m-0 text-lg font-extrabold leading-tight">เสา '+esc(r.pole_id)+'</h3>'+(mooOf(r.pole_id)?'<div class="text-sm text-muted">หมู่ '+esc(mooOf(r.pole_id))+'</div>':'')+'</div>'+
        '<div class="flex flex-col items-end gap-1">'+pill(r.status)+'<span class="sla-tag '+T.pill+' bg-accent-soft text-accent-dark border border-accent">'+ico('warn')+'เกิน SLA '+ov+' วัน</span></div></div>'+
      '<p class="m-0 mt-2 text-base text-ink font-semibold">'+esc(r.detail)+'</p>'+
      '<div class="text-sm text-muted mt-1.5 leading-relaxed">'+
        '<span class="inline-flex items-center gap-1">'+ico('clock')+fmtDT(r.created_at)+'</span> <span class="'+(isOpen?'font-bold text-ink':'')+'">('+ago(r.created_at)+'ที่แล้ว)</span>'+
        ' · <span class="font-mono text-xs bg-brand-soft text-brand px-1.5 rounded">'+esc(r.report_id)+'</span><br>'+
        'ผู้แจ้ง '+esc(r.reporter_name)+' <a class="text-brand font-semibold" href="tel:'+esc(r.reporter_phone)+'">'+esc(r.reporter_phone)+'</a>'+fake+blk+
        (r.assigned_to?'<br>ผู้รับผิดชอบ <b class="text-ink">'+esc(r.assigned_to)+'</b>':'')+
        (r.staff_note?'<br>บันทึกช่าง: '+esc(r.staff_note):'')+'</div>'+
      (r.has_photo?'<div class="mt-2" id="ph_'+id+'"><button class="'+T.btnOut+' py-2" onclick="Board.photo(\''+esc(r.report_id)+'\',\''+id+'\')">'+ico('camera')+'ดูภาพที่ผู้แจ้งแนบ</button></div>':'')+
      (r.photo_deleted_at?'<div class="mt-2 text-sm text-muted inline-flex items-center gap-1">'+ico('trash')+'ภาพที่ผู้แจ้งแนบถูกลบแล้ว '+fmtDT(r.photo_deleted_at)+' (ปิดงาน)</div>':'')+
      '<div class="flex flex-wrap gap-2 mt-3">'+nav+
        '<a class="'+T.btnOut+' py-2" href="tel:'+esc(r.reporter_phone)+'">'+ico('phone')+'โทรผู้แจ้ง</a></div>'+
      '<details class="mt-2.5 group"><summary class="'+T.btnOut+' py-2 list-none [&::-webkit-details-marker]:hidden">'+ico('edit')+'อัปเดตงาน</summary>'+
      '<div class="mt-2 border-t border-line pt-2.5">'+
      '<div class="flex flex-wrap gap-1.5"><select class="'+T.input+' flex-1 min-w-[140px] py-2 text-sm" id="st_'+id+'" aria-label="สถานะ">'+opts+'</select><input class="'+T.input+' flex-1 min-w-[140px] py-2 text-sm" id="as_'+id+'" placeholder="ผู้รับผิดชอบ" value="'+esc(r.assigned_to)+'"></div>'+
      '<div class="flex flex-wrap gap-1.5 mt-1.5"><input class="'+T.input+' flex-1 min-w-[160px] py-2 text-sm" id="nt_'+id+'" placeholder="บันทึกช่าง (สาเหตุ/อะไหล่ที่เปลี่ยน)" value="'+esc(r.staff_note)+'">'+
        '<button class="'+T.btnSm+' bg-brand text-white hover:bg-brand-dark px-4" onclick="Board.save(\''+esc(r.report_id)+'\',\''+id+'\')">'+ico('save')+'บันทึก</button></div>'+
      '</div></details>'+
    '</div>';
  }).join('') || '<div class="text-center text-muted py-10"><div class="text-lg font-bold text-ink">ไม่มีรายการ</div><div class="text-sm">ลองเปลี่ยนตัวกรองสถานะหรือหมู่</div></div>';
};
/** มือถือ/แท็บเล็ตแนวตั้ง: เลือกดูแผนที่หรือรายการทีละอย่าง (จอกว้าง ≥1024px แสดงคู่กันเสมอ) */
Board.view=function(v){
  var b=document.getElementById('board'); b.classList.toggle('board-map',v==='map'); b.classList.toggle('board-list',v==='list');
  document.querySelectorAll('#viewToggle button').forEach(function(x,i){ var on=(i===0)===(v==='map'); x.className='flex-1 py-2 inline-flex items-center justify-center gap-1.5 '+(on?'bg-brand text-white':'bg-white text-muted'); });
  if(v==='map') setTimeout(function(){ Board.map.invalidateSize(); Board.fit(); },50);
};
Board.setStatus=function(v){ document.getElementById('f_status').value=v; Board.render(); };
Board.save = async function(rid,id){
  var st=document.getElementById('st_'+id).value, r=Board.data.filter(function(x){ return x.report_id===rid; })[0];
  if (r && r.has_photo && OPEN_STATUS.indexOf(st)<0 &&
      !confirm('เปลี่ยนเป็น "'+st+'" = ปิดงาน\nภาพที่ผู้แจ้งแนบจะถูกลบถาวร ดูย้อนหลังไม่ได้อีก\n\nดำเนินการต่อ?')) return;
  try {
    var j = await api('/api/update',{method:'POST',body:{report_id:rid,status:st,
      assigned_to:document.getElementById('as_'+id).value,staff_note:document.getElementById('nt_'+id).value}});
    if (j && j.photo_deleted) alert('บันทึกแล้ว — ลบภาพที่ผู้แจ้งแนบของงาน '+rid+' เรียบร้อย');
    await Board.load();
  } catch(e){ alert('บันทึกไม่สำเร็จ: '+e.message); }
};
/** โหลดภาพที่ผู้แจ้งแนบมาแสดงในการ์ด (ภาพไม่อยู่ในรายการงาน โหลดเมื่อกดเท่านั้น) */
Board.photo = async function(rid,id){
  var box=document.getElementById('ph_'+id); box.innerHTML='<span class="text-sm text-muted">กำลังโหลดภาพ…</span>';
  try {
    var j = await api('/api/photo?id='+encodeURIComponent(rid)); if(!j) return;
    var src='data:'+j.mime+';base64,'+j.data;
    box.innerHTML='<a href="'+src+'" target="_blank" rel="noopener"><img src="'+src+'" alt="ภาพที่ผู้แจ้งแนบ" class="max-h-72 max-w-full rounded-[10px] border border-line"></a>'+
      '<div class="text-xs text-muted mt-1">ภาพนี้จะถูกลบอัตโนมัติเมื่อปิดงาน</div>';
  } catch(e){ box.innerHTML='<span class="text-sm text-[var(--new)]">'+esc(e.message)+'</span>'; }
};
/** แอดมิน: แจ้งเตือนภาพที่ถูกลบอัตโนมัติตอนปิดงาน (กด "รับทราบ" แล้วซ่อนจนกว่าจะมีรายการใหม่ — จำไว้เฉพาะเครื่องนี้) */
Board.photoNotice = false;
Board.ackKey = function(){ return 'saofi_photo_ack_'+((Auth.get()||{}).username||''); };
Board.renderPhotoNotice = function(){
  var el=document.getElementById('photoNotice'); if(!el) return;
  if(!Board.photoNotice){ el.innerHTML=''; return; }
  var ack=''; try { ack=localStorage.getItem(Board.ackKey())||''; } catch(e){}
  var since=Date.now()-7*864e5;
  var rows=Board.data.filter(function(r){ return r.photo_deleted_at && new Date(r.photo_deleted_at)>since && r.photo_deleted_at>ack; })
    .sort(function(a,b){ return a.photo_deleted_at<b.photo_deleted_at?1:-1; });
  if(!rows.length){ el.innerHTML=''; return; }
  var latest=rows[0].photo_deleted_at;
  el.innerHTML='<div class="mx-3 mt-3 bg-white border border-line border-l-[6px] border-l-[var(--close)] rounded-2xl p-3.5" role="status">'+
    '<div class="flex flex-wrap justify-between items-start gap-2"><div class="font-bold text-ink inline-flex items-center gap-1.5">'+ico('trash')+'ภาพที่ผู้แจ้งแนบถูกลบอัตโนมัติ '+rows.length+' งาน <span class="font-normal text-sm text-muted">(ปิดงานแล้ว · 7 วันล่าสุด)</span></div>'+
    '<button class="'+T.btnOut+' py-1.5" onclick="Board.ackPhotos(\''+esc(latest)+'\')">'+ico('check')+'รับทราบ</button></div>'+
    '<ul class="m-0 mt-2 pl-5 text-sm text-muted">'+rows.slice(0,10).map(function(r){
      return '<li>เสา <b class="text-ink">'+esc(r.pole_id)+'</b> · <span class="font-mono text-xs">'+esc(r.report_id)+'</span> · '+esc(r.status)+' · ลบเมื่อ '+fmtDT(r.photo_deleted_at)+(r.assigned_to?' · '+esc(r.assigned_to):'')+'</li>';
    }).join('')+(rows.length>10?'<li>และอีก '+(rows.length-10)+' งาน</li>':'')+'</ul></div>';
};
Board.ackPhotos = function(latest){ try { localStorage.setItem(Board.ackKey(), latest); } catch(e){} Board.renderPhotoNotice(); };
/** HTML ส่วนสถิติ+ฟิลเตอร์+แผนที่+รายการ (ใช้ซ้ำทั้งสองหน้า) */
Board.html = function(){
  var sel=T.input+' w-auto flex-1 min-w-[120px] py-2 text-sm';
  return '<div id="photoNotice" class="noprint"></div><div class="flex flex-wrap gap-2 items-center px-3 pt-3" id="stats"></div>'+
    '<div class="flex flex-wrap items-center gap-2 px-3 py-2.5 noprint"><select id="f_status" class="'+sel+'" onchange="Board.render()" aria-label="กรองสถานะ"><option value="">ทุกสถานะ</option><option value="__open">งานค้างทั้งหมด</option><option value="__over">เกิน SLA</option>'+
      STATUS.map(function(s){return '<option>'+s+'</option>';}).join('')+'</select>'+
    '<select id="f_moo" class="'+sel+'" onchange="Board.render()" aria-label="กรองหมู่"><option value="">ทุกหมู่</option></select>'+
    '<input id="f_q" class="'+sel+' min-w-[180px]" placeholder="ค้นเลขเสา / ชื่อ / เบอร์ / เลขที่" oninput="Board.render()" aria-label="ค้นหา">'+
    '<label class="text-sm text-muted flex items-center gap-1.5 cursor-pointer"><input type="checkbox" class="size-4 accent-brand" onchange="Board.filter.mine=this.checked;Board.render()"> งานของฉัน</label>'+
    '<button class="'+T.btnOut+'" onclick="Board.load()">'+ico('refresh')+'รีเฟรช</button><span class="text-sm text-muted" id="f_count"></span></div>'+
    '<div id="viewToggle" class="noprint px-3 pb-2"><div class="flex rounded-[10px] border border-line overflow-hidden text-sm font-semibold"><button class="flex-1 py-2 inline-flex items-center justify-center gap-1.5 bg-white text-muted" onclick="Board.view(\'map\')">'+ico('map')+'แผนที่</button><button class="flex-1 py-2 inline-flex items-center justify-center gap-1.5 bg-brand text-white" onclick="Board.view(\'list\')">'+ico('list')+'รายการ</button></div></div>'+
    '<div id="board" class="board-list flex flex-wrap gap-3 px-3 pb-3"><div id="map" class="flex-[1_1_380px] h-[40vh] min-h-[260px] lg:h-[65vh] lg:min-h-[380px] rounded-2xl border border-line"></div><div class="flex-[1_1_420px] lg:max-h-[65vh] lg:overflow-auto" id="list"></div></div>';
};
