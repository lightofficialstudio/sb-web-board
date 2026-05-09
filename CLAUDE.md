# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Behavioral Guidelines (Karpathy Principles)

### 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.

### 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**
- Transform tasks into verifiable goals before starting.
- For multi-step tasks, state a brief plan with verify steps.
- Run `bun run build` after every change to confirm success.

---

# CLAUDE.md — KAM-WEB-SCHOOLJOB

Thai education job marketplace — เชื่อม **ครู (EMPLOYEE)** กับ **โรงเรียน (EMPLOYER)**
UI ภาษาไทย, ฟอนต์ Kanit, comments ภาษาไทย

---

## Commands

```bash
bun dev            # dev server
bun build          # production build — รันทุกครั้งหลังแก้โค้ด
bun lint           # ESLint
bun run seed       # seed ข้อมูลตัวอย่างลง DB

bunx prisma db push        # push schema → DB (ใช้ DIRECT_URL เสมอ)
bunx prisma generate       # re-generate client
bunx prisma studio         # GUI

# E2E Tests (Playwright — starts dev server automatically)
bunx playwright test                             # รัน test ทั้งหมด
bunx playwright test tests/auth/auth-flow.spec.ts  # รัน test file เดียว
bunx playwright test -g "Employee.*Signup"       # รัน test เดียวโดยชื่อ
bunx playwright test --ui                        # interactive UI mode
bunx playwright show-report                      # ดู HTML report
```

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Framework | Next.js 16 (App Router) + React 19 |
| UI | Ant Design 6 + Tailwind CSS 4 |
| State | Zustand 5 (localStorage persist) |
| DB | PostgreSQL + Prisma 7 |
| Auth | Supabase Auth + Prisma Profile sync |
| Validation | Zod 4 |
| Package Manager | Bun |
| Font | Kanit (Thai + Latin) |

---

## Rules (ห้ามละเมิด)

- **Comments** → ภาษาไทยเสมอ + emoji (`// ✨ ดึงรายการ...`)
- **API calls (client)** → Axios เท่านั้น — ห้าม native `fetch()`
- **State** → Zustand `_stores/` เสมอ — ห้าม `useState` สำหรับ shared state
- **Build** → `bun run build` ทุกครั้งหลังแก้ไข ตรวจ error ก่อนรายงาน done
- **Scope** → ห้ามเพิ่ม feature / refactor นอก scope ที่ขอ
- **Response format** → `{ status_code, message_th, message_en, data }` ทุก API

---

## Architecture

### Page Module Pattern

ทุก page ที่มี state/data จะมี local modules ในรูปแบบ:

```
app/pages/<role>/<page>/
├── page.tsx               # Server/Client component หลัก
├── _components/           # UI components เฉพาะหน้านี้
├── _state/                # Zustand store เฉพาะหน้า (ส่วนใหญ่ใช้ชื่อนี้)
├── _stores/               # Zustand store เฉพาะหน้า (employee/* ใช้ชื่อนี้)
└── _api/                  # Axios API calls ไปยัง /api/v1/...
```

- ชื่อโฟลเดอร์ state: admin/*, employer/*, blog, job, landing, signin, signup ใช้ `_state/` — employee/* ใช้ `_stores/`
- บางหน้า (employer/profile) มีทั้ง `_state/` และ `_stores/` พร้อมกัน
- `_state/` และ `_stores/` คือ page-level Zustand ที่ไม่ persist — ต่างจาก `app/stores/` (global, persisted)
- `_api/` รับผิดชอบ Axios calls ทั้งหมด ไม่มี fetch() ใน component

### API Layer Pattern

ทุก API route ใช้โครงสร้าง 3 ชั้น:

```
app/api/v1/<domain>/<action>/
├── route.ts               # HTTP handler: validate → call service → return JSON
├── validation/            # Zod schemas
└── service/               # Business logic + Prisma queries
```

- `route.ts` ไม่มี Prisma โดยตรง — delegate ทั้งหมดไปที่ service
- Service ใช้ `prisma.$transaction()` สำหรับ upsert หลาย relation พร้อมกัน
- Soft-delete: ใช้ `isDeleted: true` แทนการลบจริง — query ทุกจุดต้อง filter `where: { isDeleted: false }`

### Dual Auth System

Signup/Signin ใช้สองระบบพร้อมกัน:

1. **Supabase Auth** — จัดการ credential, session, JWT
2. **Prisma `Profile`** — เก็บ role, name, school info, และ relations ทั้งหมด

Flow:
- Signup: สร้าง Supabase user → upsert Prisma Profile (fail gracefully ถ้า Prisma error)
- Signin: auth กับ Supabase → ดึง Prisma Profile (รวม schoolProfile สำหรับ EMPLOYER) → merge เป็น `User` object ใน `useAuthStore`
- `useAuthStore` (persisted localStorage) คือ source of truth ฝั่ง client

### Layout & Routing Guard

`app/components/layouts/layout-selector.tsx` wrap ทุก page:
- path `/pages/admin/*` → `AdminLayout` + `AdminGuard` (client component)
- ทุก path อื่น → `LandingLayout`
- Role-home map: `EMPLOYEE → /pages/employee/profile`, `EMPLOYER → /pages/employer/profile`

`AdminGuard` (`admin-guard.tsx`) รอ localStorage hydrate ก่อน redirect — ดังนั้น render `null` ในช่วงแรก เพื่อป้องกัน flash of admin content ก่อน auth check เสร็จ

### Theme System

`app/contexts/theme-context.tsx` wrap ทั้งแอปด้วย Ant Design `ConfigProvider`:
- primary color: `#11b6f5` — ห้าม hardcode สีอื่น
- dark mode toggle เก็บใน localStorage `"app-theme"`
- ใช้ `antTheme.useToken()` เพื่อดึง token ใน component — ห้าม hardcode hex ที่ไม่ใช่ primary

---

## Pages Inventory

### Public
| Path | หน้า |
|------|------|
| `/pages/landing` | Landing Page |
| `/pages/signin` | เข้าสู่ระบบ |
| `/pages/signup` | สมัครสมาชิก |
| `/pages/job` | ค้นหางาน (Lazy Loading) |
| `/pages/job/[job_id]/apply` | สมัครงาน |
| `/pages/blog` | รายการบทความ |
| `/pages/blog/[blog_id]` | อ่านบทความ |

### EMPLOYEE (ครู)
| Path | หน้า |
|------|------|
| `/pages/employee/profile` | โปรไฟล์ครู |
| `/pages/employee/applications` | ใบสมัครของฉัน |
| `/pages/employee/school` | ค้นหาโรงเรียน |
| `/pages/employee/account-setting` | ตั้งค่าบัญชี |

### EMPLOYER (โรงเรียน)
| Path | หน้า |
|------|------|
| `/pages/employer/profile` | โปรไฟล์โรงเรียน |
| `/pages/employer/job/post` | ประกาศงานใหม่ |
| `/pages/employer/job/post/[id]` | แก้ไขประกาศงาน |
| `/pages/employer/job/read` | จัดการประกาศงาน |
| `/pages/employer/school-management` | จัดการสมาชิก + RBAC |
| `/pages/employer/delegated-access` | การเข้าถึงแบบมอบหมาย |
| `/pages/employer/account-setting` | ตั้งค่าบัญชี |

### Special
| Path | หน้า |
|------|------|
| `/maintenance` | หน้า maintenance mode (ดึง title/message จาก API) |

### ADMIN
| Path | หน้า |
|------|------|
| `/pages/admin` | Dashboard |
| `/pages/admin/user-management` | จัดการผู้ใช้ |
| `/pages/admin/announcement` | ส่ง Broadcast ถึงผู้ใช้ |
| `/pages/admin/blog` | จัดการบทความ (Kanban + AI assistant + SEO) |
| `/pages/admin/config` | จัดการ Config Options |
| `/pages/admin/job-management/create` | สร้างงาน (admin) |
| `/pages/admin/job-management/read` | รายการงานทั้งหมด + Audit Logs |
| `/pages/admin/job-management/edit/[id]` | แก้ไขงาน (admin) |
| `/pages/admin/menu-management` | จัดการ Menu/Navigation |
| `/pages/admin/package-management` | จัดการ Subscription Plans |

---

## API Inventory

### Public
```
GET  /api/v1/jobs                    ค้นหางาน (cursor-based lazy loading)
GET  /api/v1/jobs/latest             งานล่าสุด 8 อัน (landing)
GET  /api/v1/jobs/[job_id]           รายละเอียดงาน
GET  /api/v1/blogs/read              รายการบทความ
GET  /api/v1/blogs/[blog_id]         รายละเอียดบทความ
```

### Auth
```
POST /api/v1/authenticate/signup     สมัครสมาชิก
POST /api/v1/authenticate/signin     เข้าสู่ระบบ
```

### Employee
```
GET  /api/v1/employee/profile/read              ดึงโปรไฟล์ครู
PUT  /api/v1/employee/profile/update            อัปเดตโปรไฟล์
GET  /api/v1/employee/applications/read         ดึงใบสมัครของฉัน
POST /api/v1/employee/applications/create       สมัครงาน
GET  /api/v1/employee/schools/read              ค้นหาโรงเรียน
GET/POST   /api/v1/employee/educations          การศึกษา (CRUD + /[id])
GET/POST   /api/v1/employee/licenses            ใบอนุญาต (CRUD + /[id])
GET/POST   /api/v1/employee/resumes             เรซูเม่ (CRUD + /[id])
GET/POST   /api/v1/employee/work-experiences    ประสบการณ์ทำงาน (CRUD + /[id])
PUT        /api/v1/employee/work-location/update สถานที่ทำงาน
POST       /api/v1/employee/account-setting/change-password เปลี่ยนรหัสผ่าน
```

### Employer
```
GET  /api/v1/employer/profile/read             ดึงโปรไฟล์โรงเรียน
PUT  /api/v1/employer/profile/update           อัปเดตโปรไฟล์
POST /api/v1/employer/jobs/create              สร้างประกาศงาน
GET  /api/v1/employer/jobs/read                รายการประกาศงาน
PUT  /api/v1/employer/jobs/update              แก้ไขประกาศงาน
PUT  /api/v1/employer/jobs/close               ปิดรับสมัคร
GET  /api/v1/employer/jobs/stats/read          สถิติงาน
GET  /api/v1/employer/jobs/applicants/read     รายการผู้สมัคร
PUT  /api/v1/employer/jobs/applicants/update-status  อัปเดตสถานะผู้สมัคร
GET  /api/v1/employer/jobs/pipeline            pipeline ผู้สมัคร
GET  /api/v1/employer/organization/roles       จัดการ Roles (RBAC)
PUT  /api/v1/employer/organization/roles/permissions  แก้ไข permissions
GET  /api/v1/employer/organization/members     รายการสมาชิก
GET  /api/v1/employer/organization/invites     คำเชิญ
POST /api/v1/employer/organization/invites/accept  ยอมรับคำเชิญ
GET  /api/v1/employer/organization/delegated   delegated access
```

### Admin
```
GET  /api/v1/admin/users                          รายการผู้ใช้
PUT  /api/v1/admin/users/[id]                     อัปเดตผู้ใช้
GET  /api/v1/admin/schools/read                   รายการโรงเรียน (admin)
GET  /api/v1/admin/audit-logs                     Audit logs ระบบ

POST /api/v1/admin/announcements/broadcast        ส่ง Broadcast
GET  /api/v1/admin/announcements/history          ประวัติ Announcement
GET  /api/v1/admin/announcements/count            จำนวน Announcement

POST /api/v1/admin/blogs/create                   สร้างบทความ
GET  /api/v1/admin/blogs/read                     รายการบทความ
PUT  /api/v1/admin/blogs/update                   แก้ไขบทความ
DELETE /api/v1/admin/blogs/delete                 ลบบทความ
POST /api/v1/admin/blogs/bulk-delete              ลบหลายบทความ
POST /api/v1/admin/blogs/bulk-update              แก้ไขหลายบทความ
GET  /api/v1/admin/blogs/stats                    สถิติบทความ
POST /api/v1/admin/blogs/ai                       AI ช่วยเขียนบทความ

GET  /api/v1/admin/config                         ดึง Config Options
POST /api/v1/admin/config/reorder                 เรียงลำดับ Config

POST /api/v1/admin/jobs/create                    สร้างงาน (admin)
GET  /api/v1/admin/jobs/read                      รายการงาน (admin)
GET  /api/v1/admin/jobs/get-one                   ดึงงาน 1 รายการ
PUT  /api/v1/admin/jobs/update                    แก้ไขงาน
PUT  /api/v1/admin/jobs/update-status             อัปเดตสถานะงาน
DELETE /api/v1/admin/jobs/delete                  ลบงาน
GET  /api/v1/admin/jobs/applicants                ผู้สมัครงาน (admin)

GET  /api/v1/admin/packages/read                  รายการ Package
PUT  /api/v1/admin/packages/update                แก้ไข Package
GET  /api/v1/admin/packages/plans                 รายการ Plan
GET  /api/v1/admin/packages/plans/[plan]          Plan รายละเอียด
POST /api/v1/admin/packages/bulk-update           แก้ไขหลาย Plan
GET  /api/v1/admin/packages/school-detail         รายละเอียดโรงเรียน + Package
```

### Employer (เพิ่มเติม)
```
GET  /api/v1/employer/package/read                ดึง Package plan ของโรงเรียน
```

### Admin (เพิ่มเติม)
```
GET  /api/v1/admin/dashboard                      สถิติ Dashboard
GET  /api/v1/admin/site-settings                  ดึงการตั้งค่าระบบ (SiteSetting)
PATCH /api/v1/admin/site-settings                 แก้ไขการตั้งค่าระบบ
```

### System
```
GET  /api/v1/system/maintenance                   ตรวจสอบ maintenance mode (public, ใช้โดย middleware)
```

### Notifications & Config (Public/Auth)
```
GET  /api/v1/config/options                       ดึง Config Options (public)
GET  /api/v1/notifications/read                   ดึง Notification
GET  /api/v1/notifications/read-all               Mark all read
```

### Storage
```
POST   /api/v1/storage/upload          อัปโหลดไฟล์ → Supabase Storage
DELETE /api/v1/storage/delete          ลบไฟล์
```

---

## Directory Structure

```
app/
├── api/v1/                  # REST APIs (route → validation → service)
│   ├── authenticate/
│   ├── jobs/
│   ├── blogs/
│   ├── employee/
│   ├── employer/
│   ├── admin/
│   └── storage/
├── pages/                   # UI pages — แต่ละหน้ามี _components/, _stores/, _api/
├── maintenance/             # หน้า maintenance mode (/maintenance) — ดึง message จาก /api/v1/system/maintenance
├── components/
│   ├── layouts/             # LandingLayout, AdminLayout, LayoutSelector, Modals
│   ├── admin/
│   │   ├── card/            # SummaryCard สำหรับ admin pages
│   │   └── header/          # Breadcrumb + Header component สำหรับ admin pages
│   ├── card/                # SummaryCard สำหรับ landing-side pages
│   └── modal/               # Shared modal component
├── stores/                  # Global stores: auth-store.ts, notification-modal-store.ts
├── contexts/                # theme-context.tsx (light/dark + Ant Design ConfigProvider)
└── lib/                     # supabase.ts (client)
lib/
└── prisma.ts                # Prisma client singleton
prisma/
└── schema.prisma            # DB schema
.claude/skills/              # Project-local Claude Skills
```

---

## Key Files (อย่า read ซ้ำถ้าไม่จำเป็น — ดูจาก Skills แทน)

| ข้อมูล | ดูจาก |
|--------|-------|
| DB Models/Enums/Relations | Skill: `prisma-pattern` |
| Auth flow / useAuthStore | Skill: `auth-pattern` |
| สี / gradient / theme tokens | Skill: `ui-theme` |
| Frontend structure / Zustand pattern | Skill: `frontend-standard` |
| API structure / response format | Skill: `backend-standard` |

---

## Environment Variables

```env
DATABASE_URL          # port 6543 — PgBouncer Transaction Pooler (runtime)
DIRECT_URL            # port 5432 — direct connection (prisma db push/migrate เท่านั้น)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_MAILER_HOST   # SMTP สำหรับ Nodemailer (email notifications)
NEXT_PUBLIC_MAILER_PORT
NEXT_PUBLIC_MAILER_USER
NEXT_PUBLIC_MAILER_PASS
```

## Build Notes

- `ignoreBuildErrors: true` ใน next.config.ts (TypeScript errors ไม่หยุด build)
- Remote images: unsplash.com, dicebear.com, supabase.co storage
- `optimizePackageImports` สำหรับ Ant Design
- Prisma ใช้ `@prisma/adapter-pg` กับ PgBouncer — connection pool max: 2 (Supabase free tier)
- Deployment target: **Netlify** (มี `netlify.toml` ที่ root)

---

## MCP Server

`.mcp.json` กำหนด MCP server ชื่อ `antd-docs` ที่รันจาก `mcp-servers/antd-docs/index.ts`:
- ใช้ tool `antd-docs` เพื่อดึง Ant Design docs ล่าสุดก่อนใช้ component ใหม่
- ป้องกันการใช้ deprecated API (antd 6.x เปลี่ยน API หลายจุดจาก v5)
