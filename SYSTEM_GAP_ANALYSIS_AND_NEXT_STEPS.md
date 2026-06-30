# NEXTGEN Sale & Support - System Gap Analysis & Next Steps

วันที่จัดทำ: 26 มิถุนายน 2026  
สถานะเอกสาร: วิเคราะห์ระบบปัจจุบันจาก roadmap, mockup, frontend/backend source และคู่มือทดสอบ  
ขอบเขต: เอกสารวิเคราะห์เท่านั้น ยังไม่ลงมือแก้ code

---

## 1. สรุปภาพรวม

ระบบ NEXTGEN Sale & Support ปัจจุบันมีแกนหลักครบแล้วในระดับ prototype-to-MVP ได้แก่ Authentication, Users/Roles, Leads, Pipeline, Tasks, Calendar, Quote Builder, Discount Control, Request System, Notification, AI Coach, AI Logger, Reports, Products และ Admin Calendar

อย่างไรก็ตาม หากมองในมุมระบบใช้งานจริง ยังมีส่วนที่ควรเพิ่มเติมเพื่อให้ระบบปลอดภัยขึ้น ตรวจสอบย้อนหลังได้ดีขึ้น ลดข้อมูลผิดพลาด และรองรับการใช้งานหลายคนพร้อมกัน โดยเฉพาะเรื่อง security, permission enforcement, audit trail, data validation, database persistence, workflow completeness และ deployment readiness

---

## 2. สิ่งที่ควรทำเป็นลำดับแรก

### P0 - ต้องทำก่อนใช้งานจริง

- [x] **Password security**
  - [x] ตรวจว่ารหัสผ่านยังเก็บแบบ plain text ใน field `passwordHash`
  - [x] เปลี่ยนเป็น password hash จริงด้วย Node.js `crypto.scrypt`
  - [x] เพิ่ม password policy เช่น ความยาวขั้นต่ำ, complexity, กันรหัสซ้ำกับ default
  - [x] เพิ่ม forced password change สำหรับบัญชี demo/default
  - [x] เพิ่ม audit log เมื่อ root เปลี่ยนรหัสผ่านผู้ใช้

- [x] **Permission enforcement ฝั่ง backend**
  - [x] ตรวจ route ที่ frontend ซ่อนเมนูแล้ว แต่ backend ยังอิง rank แบบกว้างหรือยังเปิดให้ทุก user ที่ login เรียกได้
  - [x] เพิ่ม middleware กลาง เช่น `requirePermission('manageProducts')`, `requireRank(4)`
  - [x] Enforce ทุก route สำคัญ ไม่เชื่อ frontend อย่างเดียว
  - [x] ตรวจซ้ำ route: users, roles, products, discounts, quotes approval, requests approval, admin-calendar edit, AI access

- [x] **Audit log แบบถาวร**
  - [x] ออกแบบ collection `audit_logs`
  - [x] เก็บ action สำคัญ เช่น login, logout, create/update/delete, approve/reject, password reset, role change, discount change
  - [x] เก็บ actor, action, target, before/after บางส่วน, IP, user agent, timestamp

- [x] **Database persistence readiness**
  - [x] ตรวจ memory fallback ที่ทำให้ข้อมูลหายเมื่อ restart
  - [x] เพิ่ม production guard เช่น `ALLOW_MEMORY_DB=false`
  - [x] เพิ่ม health check ที่บอกสถานะ DB ชัดเจน
  - [x] ปิด write สำคัญถ้าเป็น memory mode ใน production
  - [x] กำหนดให้ memory DB เป็น dev/test fallback เท่านั้น โดย production จะ fail fast ถ้า MongoDB ต่อไม่ได้และไม่ได้เปิด `ALLOW_MEMORY_DB=true`

- [x] **Input validation/schema validation**
  - [x] ตรวจ route ที่รับ `req.body` ตรงและแปลงค่าเอง
  - [x] เพิ่ม Zod หรือ validation middleware กลาง
  - [x] Validate date ranges, enum, email, phone, discount percent, quantity, price, rank, roleId, targetDepartment
  - [x] ลดข้อมูลเสียและ bug จาก frontend ที่ส่ง payload ผิด
  - [x] ครอบ route สำคัญ: auth, users, roles, products, quotes, discount settings, requests, admin calendar, AI Logger

---

## 3. Security & Authentication

สิ่งที่มีแล้ว:
- [x] JWT login
- [x] Session 7 วัน
- [x] Auto logout ฝั่ง frontend เมื่อ token หมดอายุ
- [x] Root-only password management
- [x] ไม่ส่ง `passwordHash` จาก `/api/users`

สิ่งที่ควรเพิ่ม:
- [x] Hash password จริง
- [ ] Refresh token หรือ sliding session หากต้องการ UX แบบใช้งานต่อเนื่อง
- [x] Logout endpoint เพื่อล้าง cookie ฝั่ง server
- [x] Rate limiting สำหรับ `/api/auth/login`
- [x] Account lockout เมื่อ login ผิดหลายครั้ง
- [x] CSRF strategy หากใช้ cookie auth จริงจัง
- [x] Secure cookie flags ใน production: `secure: true`, sameSite ตาม deployment
- [x] แยก JWT secret จาก default และบังคับ env ใน production
- [x] ปิด Quick Account Swapper ใน production หรือจำกัดเฉพาะ root/dev mode

---

## 4. Users, Roles & Permissions

สิ่งที่มีแล้ว:
- [x] Users/Roles UI
- [x] Permission matrix เป็น object
- [x] Root-only password reset
- [x] จำกัดบาง action ด้วย rank

สิ่งที่ควรเพิ่ม:
- [x] Role assignment UI แบบเลือกจาก dropdown แทนกรอก `roleId` ตรง
- [x] ป้องกันลบตัวเอง
- [x] ป้องกันลบ system role
- [x] ป้องกันลบ role ที่ยังมี user ใช้งาน
- [x] Preview permission ก่อน save ตาม roadmap
- [x] แสดง grouped users ตาม rank/role
- [x] เพิ่ม field สถานะ user: active/inactive/suspended
- [x] เพิ่ม lastLoginAt
- [x] เพิ่ม passwordChangedAt
- [x] เพิ่ม createdBy/updatedBy
- [x] ทำ permission middleware กลางฝั่ง backend

---

## 5. Leads & School CRM

สิ่งที่มีแล้ว:
- [x] Leads list/detail
- [x] Contacts, notes
- [x] Status update
- [x] AI Coach
- [x] Quote navigation

สิ่งที่ควรเพิ่ม:
- [x] Lead ownership transfer และ assignment history
- [x] Duplicate detection จากชื่อโรงเรียน/เบอร์โทร/email
- [x] Import/export leads CSV/XLSX
- [x] Activity timeline รวม notes, tasks, quotes, requests ในหน้า lead เดียว
- [x] Search/filter ขั้นสูง เช่น zone, status, score range, assigned user
- [x] Lead source/campaign field
- [x] Attachments เช่น เอกสารโรงเรียน, รูป, proposal
- [x] Note type เช่น call note, meeting note, coaching note
- [x] Soft delete/archive lead แทนลบทิ้ง

---

## 6. Opportunity Pipeline

สิ่งที่มีแล้ว:
- [x] Kanban stages
- [x] Create opportunity
- [x] Stage update
- [x] Dashboard ใช้ข้อมูล pipeline จริง

สิ่งที่ควรเพิ่ม:
- [x] Opportunity detail modal/page
- [x] Drag-and-drop stage update
- [x] Stage change history
- [x] Probability/win chance
- [x] Expected close date validation
- [x] Lost reason เมื่อเปลี่ยนเป็น Lost
- [x] Link opportunity กับ quote หลายใบ
- [x] Forecast report รายเดือน/ราย sales
- [x] Permission: Sales เห็นของตัวเอง, Manager เห็นทีม, Exec เห็นทั้งหมด

---

## 7. Tasks & Calendar

สิ่งที่มีแล้ว:
- [x] Task create
- [x] Participant invitation
- [x] RSVP
- [x] Decline reason กรณี rank ต่ำกว่า
- [x] Comments
- [x] Delete task
- [x] Calendar month/agenda/detail
- [x] Notification เมื่อ invite/respond/delete

สิ่งที่ควรเพิ่ม:
- [x] Weekly/day view จริง
- [x] Edit task หลังสร้าง
- [x] Mark complete/reopen task
- [x] Recurring tasks
- [x] Time conflict warning ก่อนสร้าง task
- [x] Reminder notification ก่อนถึงเวลา
- [x] Calendar color ตาม type/status/user
- [x] Link task กับ lead/opportunity/request ชัดเจนใน UI
- [x] Export calendar หรือ sync external calendar
- [x] Permission สำหรับ Manager/Exec ดูทีมใน `/api/tasks` ยังควรตรวจให้ตรงคู่มือ เพราะปัจจุบัน route task หลักอาจยังคืนเฉพาะ creator/participant

---

## 8. Quotes & Finance

สิ่งที่มีแล้ว:
- [x] Quote Builder
- [x] Product catalog
- [x] Discount limit check
- [x] Pending approval
- [x] Approve/reject
- [x] PDF export
- [x] Notifications

สิ่งที่ควรเพิ่ม:
- [x] Quote detail page
- [x] Quote versioning/revision
- [x] Quote number sequence ที่ไม่ random
- [x] Approval audit trail
- [x] Reject reason display ใน list/detail
- [x] Send quote to customer/email status
- [x] Expiry date ของ quote
- [x] Terms & conditions
- [x] Customer signature/acceptance status
- [x] Convert approved quote to won opportunity
- [x] Finance role permission ที่ชัดเจนขึ้น
- [x] PDF template branding และภาษา/รูปแบบเลขเอกสารแบบ production

---

## 9. Requests System

สิ่งที่มีแล้ว:
- [x] Create request 3 steps
- [x] Availability check
- [x] Manager approval
- [x] Claim/decline/forward/ack
- [x] Notifications
- [x] Request cards และ tabs

สิ่งที่ควรเพิ่ม:
- [x] Request detail page/modal
- [x] Draft request
- [x] Attachments
- [x] Comment thread ใน request
- [x] SLA/priority
- [x] Status transition rules แบบ explicit state machine
- [x] Completion flow หลัง claim งานแล้วทำเสร็จ
- [x] Assigned user acceptance กรณีส่งให้บุคคลเฉพาะ
- [x] Better availability: เช็คตาม targetUserId ด้วย ไม่ใช่แค่ department
- [x] Forward history UI แบบละเอียด
- [x] Notification ให้ target department/support users เมื่อ request พร้อม claim
- [x] Filter/search request ตาม department, status, date, creator, assignee

---

## 10. Admin Calendar

สิ่งที่มีแล้ว:
- [x] Admin Calendar รวม tasks/requests
- [x] Permission scope บางส่วน
- [x] Exec edit mode

สิ่งที่ควรเพิ่ม:
- [x] Create admin event โดยตรง
- [x] Event detail สำหรับ read-only users
- [x] Department/user filters ขั้นสูง
- [x] Drag/reschedule event สำหรับผู้มีสิทธิ์
- [x] Change history
- [x] Conflict detection ระหว่าง task/request/admin event
- [x] Export/print view

---

## 11. Notifications

สิ่งที่มีแล้ว:
- [x] Notification collection
- [x] Bell dropdown
- [x] Read all/read item
- [x] Badge quote/request
- [x] Trigger หลักจาก tasks, quotes, requests

สิ่งที่ควรเพิ่ม:
- [x] Notification preferences ราย user
- [x] Real-time delivery ผ่าน WebSocket/SSE
- [x] Notification categories/filter
- [x] Deep link ไปยัง entity detail เฉพาะ เช่น `/requests/:id`, `/quotes/:id`
- [x] Notification deduplication กัน spam
- [x] Mark unread
- [x] Pagination/limit
- [x] Cleanup policy เช่น archive หลัง 90 วัน

---

## 12. AI Coach & AI Logger

สิ่งที่มีแล้ว:
- [x] Gemini service
- [x] AI Coach per lead
- [x] AI conversational logger
- [x] Parse/confirm log
- [x] Link lead และ create task จาก AI log

สิ่งที่ควรเพิ่ม:
- [x] AI usage log/cost tracking
- [x] Retry/fallback เมื่อ Gemini error
- [x] Human confirmation ทุก action ที่ AI สร้าง
- [x] Confidence threshold ที่บังคับ user ตรวจ field สำคัญ
- [x] Prompt/version management
- [x] Guardrails ไม่ให้ AI สร้างข้อมูลผิด role/permission
- [x] Voice input integration หากต้องการ dictate จริง
- [x] Summary export เข้า note/timeline

---

## 13. Reports & Dashboard

สิ่งที่มีแล้ว:
- [x] Dashboard API-driven
- [x] Reports มี filter date/type
- [x] Activity summary

สิ่งที่ควรเพิ่ม:
- [x] Report export CSV/PDF
- [x] Date range dashboard
- [x] Sales performance by user/zone
- [x] Conversion funnel lead -> opportunity -> quote -> won
- [x] Quote approval report
- [x] Request SLA report
- [x] Task completion/overdue report
- [x] Drill-down จาก metric card ไปหน้ารายการที่ filter แล้ว
- [x] Role-aware report access

---

## 14. Products & Discount Settings

สิ่งที่มีแล้ว:
- [x] Product CRUD
- [x] Product ใช้ใน quote builder
- [x] Discount role/individual limits
- [x] History บางส่วน

สิ่งที่ควรเพิ่ม:
- [x] Product categories management
- [x] Product import/export
- [x] Price history
- [x] Soft delete/inactive product flow
- [x] Prevent delete product used in quotes
- [x] Discount approval matrix มากกว่า 1 step หากยอดสูงมาก
- [x] Manager แก้เฉพาะ Sales limit ตามคู่มือ ส่วน Exec แก้ทุกระดับ
- [x] Audit log สำหรับ product/discount changes

---

## 15. Architecture & Codebase

สิ่งที่ควรพิจารณา:
- [x] `backend/src/app.ts` ใหญ่มาก ควรแยก routes/controllers/services ตาม roadmap
- [x] เพิ่ม shared backend middleware: auth, permission, validation, error handler
- [x] เพิ่ม frontend API service/domain hooks แทน fetch กระจายหลายหน้า
- [x] เพิ่ม frontend types กลาง แทน `any[]` หลายจุด
- [x] เพิ่ม reusable UI components: Modal, Table, Badge, Tabs, FormField
- [x] เพิ่ม error boundary และ loading/empty states แบบมาตรฐาน
- [x] เพิ่ม pagination สำหรับ list ใหญ่
- [x] เพิ่ม test coverage ของ route behavior และ permission

หมายเหตุ: รอบนี้ทำเป็น refactor foundation และแยก route เพิ่มแบบ incremental ยังไม่ได้ full split controller/service ทั้งระบบ

---

## 16. Deployment & Operations

สิ่งที่ควรเพิ่ม:
- [x] README วิธี run frontend/backend
- [x] Dockerfile/docker-compose สำหรับ MongoDB + backend + frontend
- [x] Environment validation ตอน startup
- [x] Production build/serve strategy
- [x] CI pipeline: install, typecheck, test, build
- [x] GitHub Actions
- [x] Backup/restore MongoDB
- [x] Log rotation
- [x] Monitoring/alerting
- [x] Seed command แยก dev/prod
- [x] CORS/allowed hosts ตาม environment

---

## 17. Documentation ที่ควรอัปเดต

ควรแก้เอกสารต่อไปนี้ให้ตรงกับระบบล่าสุด:
- [x] `nextgen-sell.md`
  - [x] ตอนนี้ยังระบุว่าบัญชีทดลองทุกบัญชีใช้ `1234` แต่ root ใช้รหัสแยก
  - [x] ควรเพิ่มเรื่อง root-only password management
  - [x] ควรอัปเดต feature ที่ทำจริงแล้ว เช่น notification, reports filter, dashboard real data
- [x] `SYSTEM_ARCHITECTURE_AND_ROADMAP.md`
  - [x] ควรเพิ่มสถานะล่าสุดของ phase หลังเฟส 9
  - [x] ควรเพิ่ม phase ใหม่สำหรับ production hardening
  - [x] ควรปรับโครงสร้าง folder roadmap ให้ตรง source จริง หรือระบุว่าเป็น target architecture

---

## 18. แผน Phase ถัดไปที่แนะนำ

### Phase 10 - Production Hardening
- [x] Hash password
- [x] Permission middleware กลาง
- [x] Validation schema ทุก critical endpoint
- [x] Audit logs
- [x] Disable quick swap in production
- [x] Production DB guard

### Phase 11 - Workflow Completion
- [x] Request detail/comments/completion
- [x] Quote detail/versioning/sequence
- [x] Opportunity detail/stage history
- [x] Task edit/complete/recurring/conflict warning

### Phase 12 - Reporting & Export
- [x] CSV/PDF reports
- [x] Sales forecast
- [x] Request SLA report
- [x] Quote approval report
- [x] Drill-down dashboard

### Phase 13 - Architecture Refactor
- [x] Split `app.ts` into route/controller/service modules
- [x] Shared types
- [x] Frontend reusable components
- [x] API domain hooks
- [x] Broader automated tests

หมายเหตุ: Phase 13 ปิดในระดับ foundation/incremental refactor แล้ว แต่การแยก `app.ts` เป็น controller/service เต็มรูปแบบยังเหมาะเป็นงาน technical debt ระยะถัดไป

### Phase 14 - Deployment
- [x] Docker compose
- [x] README runbook
- [x] GitHub Actions CI
- [x] Env validation
- [x] Monitoring/log rotation

---

## 19. บทสรุป

ระบบตอนนี้ถือว่าเดินมาถึงระดับ MVP ที่มีฟีเจอร์ครบแกนธุรกิจแล้ว จุดที่ควรทำต่อไม่ใช่การเพิ่มเมนูใหม่เป็นหลัก แต่เป็นการทำให้ระบบน่าเชื่อถือพอสำหรับใช้งานจริง ได้แก่ security, permission, validation, audit trail, workflow completeness, report/export และ deployment readiness

Phase 10-14 ถูกปิดในระดับ MVP hardening แล้ว ลำดับถัดไปที่แนะนำคือ production rollout แบบมี staging environment, migration/seed policy ที่ชัดเจน, monitoring จริง, automated route permission tests เพิ่มเติม และ incremental refactor แยก `backend/src/app.ts` ออกเป็น controller/service ตาม bounded context
