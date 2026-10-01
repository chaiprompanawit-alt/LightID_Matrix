# ระบบแจ้งซ่อมไฟฟ้าสาธารณะ — เวอร์ชัน Vercel + Supabase

เว็บ 3 หน้า + API บน Vercel · ฐานข้อมูล Supabase (Postgres) · ไม่มี build step (HTML + Tailwind CDN)

| URL | ใคร | ทำอะไร |
|---|---|---|
| `/?pole=1/14&k=xxxxxx` | ชาวบ้าน (สแกน QR) | เห็นเสาอัตโนมัติ → กรอกชื่อ/เบอร์/อาการ → ส่ง |
| `/tech` | ช่างไฟ (ล็อกอิน) | แผนที่หมุดสีตามสถานะ · **🧭 นำทาง** Google Maps แตะเดียว · โทรผู้แจ้ง · เปลี่ยนสถานะ/บันทึกช่าง · "งานของฉัน" · รีเฟรชอัตโนมัติทุก 2 นาที |
| `/admin` | แอดมิน (ล็อกอิน) | ทุกอย่างของช่าง + **รายงานรายสัปดาห์/รายเดือน** (KPI, SLA 10 วันทำการ, กราฟ, ตารางหมู่, ผลงานช่าง, เสาแจ้งซ้ำ, พิมพ์ PDF, CSV) + นำเข้าเสา 1,300 ต้น + บัญชีดำ + จัดการบัญชีผู้ใช้ |

## โครงสร้าง
```
web/
├─ public/            หน้าเว็บ (index.html ชาวบ้าน · tech.html ช่าง · admin.html แอดมิน)
│  ├─ assets/         config.js = ชื่อ อบต./เบอร์/พิกัดศูนย์แผนที่ (เปลี่ยนที่เดียว) · common.js · app.css · logo.jpg
│  ├─ icons/          ไอคอนแอป (สร้างจาก logo.jpg)
│  ├─ manifest.webmanifest + sw.js   PWA: ติดตั้งเป็นแอปบนมือถือ/แท็บเล็ต/คอม เปิดได้แม้เน็ตสะดุด (API ไม่แคช)
├─ api/               Serverless Functions: pole, report, login, me, users, reports, update, block, poles, stats, ping
├─ lib/               db.js (Supabase + กฎกันแจ้งมั่ว) · auth.js (ล็อกอิน) · notify.js (อีเมล Resend) · mockdb.js (ทดลองในเครื่อง)
├─ supabase/schema.sql  สร้างตาราง poles / reports / blocklist / staff_users (มีเสาทดลอง 1/1 ที่ 18.582125, 98.952782)
├─ vercel.json        rewrites (/admin /tech) + cron กัน Supabase หลับ
└─ dev.js             เซิร์ฟเวอร์ทดลองในเครื่อง (ไม่ต้องมี Supabase)
```

## ทดลองในเครื่องก่อน (ไม่ต้องสมัครอะไร)
```bash
cd web && npm install && npm run dev
```
เปิด http://localhost:3000/?pole=1/1 (ชาวบ้าน) · /tech · /admin — ล็อกอิน `admin` / `admin1234` · ข้อมูลเป็นของจำลอง หายเมื่อปิด

## ติดตั้งจริง (~30 นาที)

### 1) Supabase (ฟรี)
1. สมัคร supabase.com → **New project** (Region: Singapore) → ตั้งรหัส DB เก็บไว้
2. **SQL Editor** → วางทั้งไฟล์ `supabase/schema.sql` → **Run**
3. **Project Settings → API** คัดลอก `Project URL` และ `service_role` key (ลับมาก)

### 2) Vercel (ฟรี)
1. push โค้ดขึ้น GitHub → vercel.com → **Add New Project** → เลือก repo → **Root Directory = `web`**
2. **Environment Variables** ใส่ตาม `.env.example`:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
   - `ADMIN_TOKEN` = รหัสผ่านบัญชี `admin` หลัก (ยาว เดายาก)
   - `SESSION_SECRET` = สุ่มตัวอักษรยาว ๆ
   - `QR_SECRET` = ต้องตรงกับที่ใส่ใน `docs/qr_generator.html`
   - (ไม่บังคับ) `RESEND_API_KEY`, `NOTIFY_EMAIL`, `NOTIFY_FROM`, `HOTLINE`, `PUBLIC_URL`, `QR_BASE_URL` (โดเมนของตัวเองที่ QR จะพาไป ถ้าไม่ตั้งใช้โดเมน production ของ Vercel)
3. **Deploy** → ได้ URL เช่น `https://xxx.vercel.app`

### 3) ตั้งต้นระบบ
1. เปิด `/admin` → ล็อกอิน `admin` + `ADMIN_TOKEN`
2. แท็บ **👥 ผู้ใช้** → สร้างบัญชีช่างแต่ละคน (สิทธิ์ "ช่าง") แจ้งรหัสให้ช่าง ให้เปลี่ยนเองที่หน้า `/tech`
3. แท็บ **🗼 เสาไฟ** → วางข้อมูลจาก Excel (`pole_id, zone, address, lat, lng, note`) → นำเข้า
4. แท็บ **สติกเกอร์ QR** → เลือกหมู่ → **ดาวน์โหลด PDF** (A4 หน้าละ 8 ดวง พิมพ์ขนาดจริง 100%) — ลายเซ็นคำนวณที่เซิร์ฟเวอร์จาก `QR_SECRET` ไม่ต้องกรอกเอง ใช้ได้ทุกเครื่องที่ล็อกอินแอดมิน (สำรองแบบออฟไลน์: `docs/qr_maeka.html`)
5. ทดสอบ: สแกน QR เสา 1/1 (เสาทดลอง) → แจ้ง → เปิด `/tech` กด 🧭 นำทาง → ต้องเปิด Google Maps ไปที่ 18.582125, 98.952782

## ระบบล็อกอิน
- รายบุคคล (`staff_users`) รหัสผ่านเก็บเป็น scrypt hash · session 12 ชม. · สิทธิ์ `admin` / `tech`
- บัญชี `admin` หลักใช้รหัสจาก `ADMIN_TOKEN` (กู้ระบบได้เสมอ) · เปลี่ยน `SESSION_SECRET` = บังคับทุกคนล็อกอินใหม่
- ตาราง Supabase เปิด RLS ไม่มี policy → หน้าเว็บเข้าถึง DB ตรงไม่ได้ ทุกอย่างผ่าน API (PII ไม่รั่ว)

## กันแจ้งมั่ว 6 ชั้น (เหมือน Apps Script เดิม)
ซ้ำเสาเดิม · โควตา 3 ครั้ง/เบอร์/วัน · บัญชีดำ · honeypot + ส่งเร็ว <3 วิ · ลายเซ็น QR `k` · สถานะแจ้งเท็จ + ป้ายเตือน — อยู่ใน `api/report.js`

## ข้อควรรู้
- **Supabase Free หลับถ้าไม่ใช้ 7 วัน** → `vercel.json` มี cron เรียก `/api/ping` ทุกวัน 10:15 น. แล้ว (Vercel Hobby รองรับ cron วันละครั้ง) — ทดสอบเองได้โดยเปิด `/api/ping` ต้องเห็น `"ok":true`
- **Vercel Hobby ห้ามใช้เชิงพาณิชย์** → วันที่ หจก. รับเงิน ให้ย้ายไป Vercel Pro หรือ Cloudflare Pages (โค้ดส่วน `api/` ต้องปรับเป็น Pages Functions)
- โลโก้: วางไฟล์ที่ `public/assets/logo.png` จะขึ้นหัวหน้าชาวบ้านอัตโนมัติ
- เปลี่ยนไปใช้กับ อบต. อื่น: แก้ `public/assets/config.js` (ชื่อ, เบอร์, `mapCenter`, `navFrom` = จุดเริ่มนำทางของช่าง) + สีใน `@theme` ของแต่ละหน้า + `HOTLINE`
- ปุ่ม 🧭 นำทาง เริ่มเส้นทางจากที่ทำการ อบต. (`ORG.navFrom`) เสมอ — ลบ `navFrom` ถ้าอยากให้เริ่มจาก GPS มือถือ
- SLA ในรายงานนับวันจันทร์–ศุกร์ ยังไม่หักวันหยุดนักขัตฤกษ์
