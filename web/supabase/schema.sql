-- ระบบแจ้งซ่อมไฟฟ้าสาธารณะ อบต.แม่ก๊า — โครงสร้างฐานข้อมูล Supabase (Postgres)
-- วิธีใช้: Supabase Dashboard > SQL Editor > วางทั้งไฟล์ > Run (ครั้งเดียว)
-- map จาก Google Sheet เดิม 1:1 (Poles / Reports / Blocklist)

-- ---------- เสาไฟ (สำรวจพิกัดล่วงหน้า) ----------
create table if not exists poles (
  pole_id    text primary key,          -- "หมู่/ต้นที่" เช่น 1/14  ※ ต้องเป็น text ห้ามเป็น date
  zone       text,                      -- หมู่
  address    text,                      -- จุดสังเกต
  lat        double precision,
  lng        double precision,
  note       text,
  created_at timestamptz default now()
);

-- ---------- รายการแจ้งซ่อม (incident) ----------
create table if not exists reports (
  report_id      text primary key,      -- Ryymmdd-HHmmss-xxx
  created_at     timestamptz not null default now(),
  pole_id        text not null,         -- อาจเป็นเสาที่ยังไม่มีในตาราง poles ได้ (ชาวบ้านกรอกเอง)
  lat            double precision,
  lng            double precision,
  reporter_name  text not null,
  reporter_phone text not null,         -- เก็บเฉพาะตัวเลข
  detail         text not null,
  status         text not null default 'แจ้งใหม่'
                 check (status in ('แจ้งใหม่','รับเรื่องแล้ว','กำลังดำเนินการ','เสร็จสิ้น','ปิดงาน/ไม่พบปัญหา','แจ้งเท็จ')),
  assigned_to    text default '',
  staff_note     text default '',
  updated_at     timestamptz not null default now(),
  done_at        timestamptz             -- เวลาที่เปลี่ยนเป็น เสร็จสิ้น/ปิดงาน (ใช้คำนวณ SLA)
);
create index if not exists reports_pole_status_idx on reports (pole_id, status);
create index if not exists reports_phone_created_idx on reports (reporter_phone, created_at desc);
create index if not exists reports_created_idx on reports (created_at desc);

-- ---------- ภาพที่ชาวบ้านแนบ (ชั่วคราว: ลบอัตโนมัติเมื่อปิดงาน) ----------
-- รันไฟล์นี้ซ้ำได้ปลอดภัย (if not exists) — ระบบที่ติดตั้งไปแล้วให้รันใหม่ทั้งไฟล์เพื่อเพิ่มส่วนนี้
alter table reports add column if not exists has_photo        boolean not null default false;
alter table reports add column if not exists photo_deleted_at timestamptz;   -- เวลาที่ระบบลบภาพตอนปิดงาน (แจ้งเตือนแอดมิน)
create table if not exists report_photos (
  report_id  text primary key references reports(report_id) on delete cascade,
  mime       text not null,             -- image/jpeg (ย่อขนาดจากมือถือแล้ว ~100–400 KB)
  data       text not null,             -- base64 เก็บแยกตาราง รายการงานจะได้โหลดเร็ว
  created_at timestamptz not null default now()
);

-- ---------- บัญชีดำเบอร์โทร ----------
create table if not exists blocklist (
  phone      text primary key,          -- เฉพาะตัวเลข
  reason     text,
  blocked_at timestamptz default now()
);

-- ---------- ความปลอดภัย ----------
-- เปิด RLS ทุกตาราง และ "ไม่สร้าง policy" = anon key อ่าน/เขียนอะไรไม่ได้เลย
-- ทุกอย่างผ่าน API ของเรา (Vercel) ที่ใช้ service_role key เท่านั้น → PII ไม่รั่วออกหน้าเว็บ
alter table poles     enable row level security;
alter table reports   enable row level security;
alter table blocklist enable row level security;
alter table report_photos enable row level security;

-- ---------- เสาทดลอง (ใช้ทดสอบระบบก่อนสำรวจจริง — ลบทิ้งได้ภายหลัง) ----------
insert into poles (pole_id, zone, address, lat, lng, note) values
  ('1/1', '1', 'เสาทดลองระบบ', 18.582125, 98.952782, 'TEST — ใช้ทดสอบ QR/แผนที่/นำทาง')
on conflict (pole_id) do nothing;

-- ---------- ผู้ใช้งานเจ้าหน้าที่ (ล็อกอินหน้าช่าง/แอดมิน) ----------
-- รหัสผ่านเก็บเป็น hash (scrypt) เท่านั้น ไม่มีรหัสจริงในฐานข้อมูล
-- บัญชีแรก: ล็อกอินด้วย username = admin / password = ค่า ADMIN_TOKEN ใน Vercel → แล้วสร้างบัญชีช่างจากหน้าแอดมิน
create table if not exists staff_users (
  username      text primary key,
  display_name  text not null,
  role          text not null check (role in ('admin','tech')),
  password_hash text not null,
  active        boolean not null default true,
  created_at    timestamptz default now(),
  last_login    timestamptz
);
alter table staff_users enable row level security;
