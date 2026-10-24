# 🚀 Java Easy Learn - แพลตฟอร์มเรียนภาษา Java เบื้องต้น (ภาษาไทย)

**Java Easy Learn** เป็นเว็บแอปพลิเคชันแบบ Full-Stack ที่ออกแบบขึ้นเพื่อผู้เริ่มต้นเรียนเขียนโปรแกรมภาษา Java ในประเทศไทย ตัวเว็บประกอบด้วยระบบบทเรียน บทความโค้ดตัวอย่างพร้อมไฮไลต์สีไวยากรณ์ (Syntax Highlighting) แบบทดสอบท้ายบทเรียนแบบโต้ตอบ (ปรนัย และ ลากวางเรียงลำดับซอร์สโค้ด) ระบบสถิติ แดชบอร์ดติดตามความคืบหน้า และระบบจัดการหลังบ้าน (Admin Dashboard)

---

## 🛠️ สแต็คเทคโนโลยี (Tech Stack)

- **Frontend**: React 19, Tailwind CSS v4, Motion (Framer Motion)
- **Backend**: Node.js + Express.js
- **Database / Auth**: Supabase (PostgreSQL + Supabase Auth)
- **Deployment**: Render (Express + Vite Static Assets Server)

---

## 🗂️ 1. โครงสร้างฐานข้อมูลและการตั้งค่า Supabase SQL

คุณสามารถนำคำสั่ง SQL ด้านล่างนี้ไปรันใน **Supabase SQL Editor** เพื่อสร้างตารางฐานข้อมูลและตั้งค่า Row Level Security (RLS) ให้ตรงตามเงื่อนไขของแอปพลิเคชัน:

```sql
-- ==========================================
-- 1. ตารางข้อมูลโปรไฟล์ผู้ใช้งาน (Profiles)
-- ==========================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null unique,
  full_name text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- เปิดใช้งาน RLS สำหรับ profiles
alter table public.profiles enable row level security;

-- นโยบายสิทธิ์ (RLS Policies) ของ profiles
create policy "Users can view all profiles" on public.profiles
  for select using (true);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- ==========================================
-- 2. ตารางข้อมูลบทเรียน (Lessons)
-- ==========================================
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  code_examples jsonb default '[]'::jsonb,
  order_index integer not null,
  is_free boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- เปิดใช้งาน RLS สำหรับ lessons
alter table public.lessons enable row level security;

-- นโยบายสิทธิ์ (RLS Policies) ของ lessons
create policy "Anyone can read free lessons" on public.lessons
  for select using (is_free = true);

create policy "Authenticated users can read all lessons" on public.lessons
  for select using (auth.role() = 'authenticated');

create policy "Only admin can write/update/delete lessons" on public.lessons
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- ==========================================
-- 3. ตารางข้อมูลแบบทดสอบ (Quiz Questions)
-- ==========================================
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.lessons(id) on delete cascade not null,
  type text not null check (type in ('multiple_choice', 'drag_drop')),
  question text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer jsonb not null,
  order_index integer not null
);

-- เปิดใช้งาน RLS สำหรับ quiz_questions
alter table public.quiz_questions enable row level security;

-- นโยบายสิทธิ์ (RLS Policies) ของ quiz_questions
create policy "Authenticated users can view quiz questions" on public.quiz_questions
  for select using (auth.role() = 'authenticated');

create policy "Anyone can view quiz questions for free lessons" on public.quiz_questions
  for select using (
    exists (
      select 1 from public.lessons
      where lessons.id = quiz_questions.lesson_id and lessons.is_free = true
    )
  );

create policy "Only admin can manage quiz questions" on public.quiz_questions
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- ==========================================
-- 4. ตารางบันทึกความคืบหน้าผู้เรียน (User Progress)
-- ==========================================
create table public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  lesson_id uuid references public.lessons(id) on delete cascade not null,
  completed boolean default false not null,
  quiz_score numeric default 0 not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, lesson_id)
);

-- เปิดใช้งาน RLS สำหรับ user_progress
alter table public.user_progress enable row level security;

-- นโยบายสิทธิ์ (RLS Policies) ของ user_progress
create policy "Users can manage their own progress records" on public.user_progress
  for all using (auth.uid() = user_id);

create policy "Admins can view all progress records" on public.user_progress
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- ==========================================
-- 5. Trigger สำหรับสร้างข้อมูลโปรไฟล์อัตโนมัติเมื่อสมัครสมาชิก
-- ==========================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'ผู้เรียนนิรนาม'),
    case 
      when new.email = 'admin@gmail.com' then 'admin'
      else 'user'
    end,
    'active'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## 🔑 2. ตัวแปรสภาพแวดล้อม (Environment Variables)

คัดลอกไฟล์ `.env.example` ไปเป็น `.env` และกำหนดค่าข้อมูลของคุณ (หากไม่ตั้งค่า ระบบจะทำงานในโหมด Local Fallback อัตโนมัติทันที):

```env
# พอร์ตที่ต้องการเปิดรันเซิร์ฟเวอร์ (ค่าเริ่มต้น 3000)
PORT=3000

# คีย์ลับสำหรับสร้างและตรวจสอบความปลอดภัยของ JWT Session Token
JWT_SECRET=your_super_secret_jwt_key_here

# ระบุอีเมลที่ต้องการให้ได้รับสิทธิ์ Admin เพิ่มเติม (คั่นด้วยเครื่องหมายจุลภาค)
ADMIN_EMAILS=admin@gmail.com,teacher@school.ac.th

# URL สำหรับเชื่อมต่อ Supabase API (หากมี)
# หากปล่อยว่างไว้ ระบบเซิร์ฟเวอร์ Express จะเปิดระบบจัดเก็บข้อมูลในไฟล์สำรองอัตโนมัติ (database.json)
# ทำให้เปิดใช้งาน ตรวจสอบ ทำแบบทดสอบ เพิ่มข้อมูลแอดมิน และสถิติวิเคราะห์ได้ 100% ทันทีโดยไม่ต้องสมัครบัญชีใดๆ
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# ตั้งค่าระบบส่งอีเมลยืนยันตัวตนจริง (SMTP หรือ Resend)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
RESEND_API_KEY=your_resend_api_key
```

*หมายเหตุ: ในสภาพแวดล้อม Google AI Studio, พอร์ตจะถูกบังคับเป็น 3000 เพื่อความเสถียรของการแสดงผล Iframe เสมอ*

---

## 💻 3. ขั้นตอนการเปิดใช้งานใน Visual Studio Code (VS Code)

โปรเจกต์นี้ได้รับการทดสอบและพร้อมเปิดทำงานบน **VS Code** ได้ทันที 100% โดยทำตามขั้นตอนดังนี้:

### 1. เปิดโฟลเดอร์โปรเจกต์ใน VS Code
เปิดโปรแกรม VS Code แล้วเลือกเมนู **File > Open Folder...** จากนั้นเลือกโฟลเดอร์ของโปรเจกต์นี้

### 2. ติดตั้ง Dependencies
เปิด Integrated Terminal ใน VS Code (`Ctrl + ~` หรือ `Cmd + ~`) แล้วพิมพ์คำสั่ง:
```bash
npm install
```

### 3. ตั้งค่าไฟล์ Environment (ทางเลือก)
คัดลอกไฟล์ `.env.example` เป็น `.env`:
```bash
cp .env.example .env
```
*(หากไม่ใส่ค่าใดๆ ระบบจะใช้ฐานข้อมูลจำลอง `database.json` ให้โดยอัตโนมัติทันที พร้อมบทเรียนและข้อสอบเริ่มต้นครบชุด)*

### 4. รันเซิร์ฟเวอร์ในโหมดพัฒนา (Development Mode)
```bash
npm run dev
```
- เปิดเบราว์เซอร์ไปที่: **`http://localhost:3000`**
- ระบบจะรันทั้ง **Express API Backend** และ **Vite React Frontend** พร้อมกันในพอร์ตเดียว ไม่ต้องเปิด 2 terminal!

### 5. ตรวจสอบไวยากรณ์ (Type-Check & Lint)
```bash
npm run lint
```

### 6. ส่วนขยายแนะนำใน VS Code (Recommended Extensions)
- **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`): ช่วยแนะนำคลาส Tailwind CSS v4
- **ESLint** (`dbaeumer.vscode-eslint`): ช่วยตรวจจับข้อผิดพลาดในโค้ด
- **Prettier - Code formatter** (`esbenp.prettier-vscode`): จัดรูปแบบโค้ดให้อ่านง่าย

---

## 🌐 4. ขั้นตอนการนำไปติดตั้งบนเว็บคลาวด์ (Render Deployment Steps)

บนแพลตฟอร์ม **Render** คุณสามารถใช้งานแอปพลิเคชันนี้ร่วมกันได้ในรูปแบบ "Web Service" โดยทำตามขั้นตอนดังนี้:

### ขั้นตอนที่ 1: เตรียมโปรเจกต์ของคุณขึ้น GitHub
- สร้าง Repository ใหม่บน GitHub
- ทำการ Commit โค้ดทั้งหมดและ Push ขึ้นไป:
  ```bash
  git init
  git add .
  git commit -m "feat: complete java learning platform"
  git branch -M main
  git remote add origin <your-github-repo-url>
  git push -u origin main
  ```

### ขั้นตอนที่ 2: ตั้งค่าบริการบนเว็บแดชบอร์ดของ Render
1. ไปที่ [Render Dashboard](https://dashboard.render.com/) และล็อกอินเข้าใช้งาน
2. คลิกปุ่ม **New +** และเลือก **Web Service**
3. เชื่อมต่อบัญชี GitHub ของคุณและเลือก Repository ของโปรเจกต์นี้
4. กำหนดค่าข้อมูลดังนี้:
   - **Name**: `java-easy-learn` (หรือชื่ออื่นๆ ที่คุณต้องการ)
   - **Region**: เลือกโฮสต์ที่ใกล้ประเทศไทย เช่น `Singapore` (ap-southeast-1)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`

### ขั้นตอนที่ 3: กำหนดค่าตัวแปรสภาพแวดล้อม (Environment Variables) บน Render
ในแท็บ **Environment** ของหน้าตั้งค่าบริการบน Render ให้เพิ่มตัวแปรดังนี้:
- `NODE_ENV` = `production`
- `PORT` = `3000`
- `JWT_SECRET` = (ระบุคีย์ลับของคุณ เช่น รหัสยาว 32 ตัวอักษร)
- `SUPABASE_URL` = (ระบุ URL โครงการ Supabase ของคุณเพื่อเชื่อมระบบจริง)
- `SUPABASE_KEY` = (ระบุ Anon Key ของคุณ)
- `SUPABASE_SERVICE_ROLE_KEY` = (ระบุ Service Role Key ของคุณสำหรับการควบคุม API สิทธิ์สูงสุดฝั่ง Admin)

### ขั้นตอนที่ 4: เปิดใช้งานและทดสอบ
- กดปุ่ม **Deploy Web Service**
- ระบบของ Render จะดึงข้อมูลและทำสเต็ป `Build` เพื่อเปลี่ยน TypeScript เป็นเซิร์ฟเวอร์ที่รันด้วยความเร็วสูง และพร้อมให้บริการทาง URL ที่จัดเตรียมไว้ให้ทันที!

---

## 🏆 บัญชีทดสอบสำหรับแอดมิน (Admin Credentials)
สามารถเข้าสู่ระบบเพื่อจัดการเนื้อหาและดูสถิติระบบด้วยบัญชีแอดมิน:
- **สิทธิ์แอดมิน (Admin User)**:
  - **อีเมล**: `admin@gmail.com`
  - **รหัสผ่าน**: `admin`
*(สำหรับผู้เรียนใหม่ สามารถกด "สมัครสมาชิกใหม่" ผ่านหน้าเว็บได้ทันที)*
