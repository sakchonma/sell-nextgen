# 📋 NEXTGEN Sale & Support — คู่มือการใช้งานระบบ
**เวอร์ชัน:** v2.0 | **วันที่จัดทำ:** เมษายน 2569  
**วัตถุประสงค์:** เอกสารสำหรับทีมตรวจสอบการทำงานของระบบ

---

## 🔐 บัญชีทดลองใช้งาน

บัญชี demo เดิมอาจถูกบังคับให้เปลี่ยนรหัสผ่านเมื่อ login ครั้งแรกตามนโยบาย password security ล่าสุด ส่วนบัญชี root ใช้รหัสแยกและเป็นบัญชีเดียวที่จัดการรหัสผ่านผู้ใช้อื่นได้

- Root admin: `root@nextgen.co.th` ใช้รหัสผ่านที่กำหนดแยกในระบบ
- บัญชี demo อื่น: ใช้รหัสเริ่มต้นสำหรับทดสอบใน dev เท่านั้น และระบบจะบังคับเปลี่ยนเมื่อยังเป็น default password

| ชื่อ | อีเมล | ตำแหน่ง | Rank |
|---|---|---|---|
| ดร.วิชัย สุริยา | exec@nextgen.co.th | ผู้บริหาร | 5 |
| พิชาภรณ์ วงศ์ศรี | assist@nextgen.co.th | ผู้ช่วยผู้บริหาร | 4 |
| จิราพร มั่นคง | manager@nextgen.co.th | Sales Manager | 4 |
| ธนกร รุ่งเรือง | sales1@nextgen.co.th | Sales (ภาคเหนือ) | 3 |
| นภัสสร ใจดี | sales2@nextgen.co.th | Sales (ภาคตะวันออก) | 3 |
| กฤษฎา สุขใส | sales3@nextgen.co.th | Sales (ภาคใต้) | 3 |
| อรอุมา พรมดี | sales4@nextgen.co.th | Sales (ภาคตะวันตก) | 3 |
| ปิยะ ศรีทอง | sales5@nextgen.co.th | Sales (ภาคอีสาน) | 3 |
| วรากร ดีงาม | central@nextgen.co.th | Admin Support | 2 |
| สุภาพร คลังทรัพย์ | finance@nextgen.co.th | Finance/Admin | 2 |
| ดร.ชนม์ชนก วิชัย | academic1@nextgen.co.th | ทีมวิชาการ | 2 |
| สรรเสริญ มานะ | academic2@nextgen.co.th | ทีมวิชาการ | 2 |
| ณัฐพล เครือสาร | prod1@nextgen.co.th | ทีม Production | 2 |
| พิมพ์นิภา ทองใส | prod2@nextgen.co.th | ทีม Production | 2 |

> **วิธีสลับบัญชี:** เฉพาะ `root@nextgen.co.th` เท่านั้นที่เห็น Quick Account Swapper และ production จะจำกัด/ปิดตามนโยบาย security

### Password Management ล่าสุด

- Root-only password reset/management
- Password hash ด้วย `crypto.scrypt`
- Password policy และ forced password change
- Login session 7 วัน พร้อม frontend auto logout เมื่อ token หมดอายุ
- Backend audit log เมื่อ login/logout/password/role/discount/product/workflow สำคัญเปลี่ยน

---

## 🗺️ ภาพรวมเมนูตามตำแหน่ง

| เมนู | Exec/Asst | Manager | Sales | Admin/Finance | วิชาการ/Production |
|---|:---:|:---:|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Leads & โรงเรียน | ✅ | ✅ | ✅ | ✅ | ✅ |
| Opportunity Pipeline | ✅ | ✅ | ✅ | ✅ | ✅ |
| งาน & นัดหมาย | ✅ | ✅ | ✅ | ✅ | ✅ |
| ปฏิทินกลาง | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI บันทึกด้วยการคุย | ❌ | ❌ | ✅ | ❌ | ❌ |
| ภาพรวมทีม | ✅ | ✅ | ❌ | ❌ | ❌ |
| รายงานกิจกรรม | ✅ | ✅ | ✅ | ✅ | ✅ |
| สินค้า & ราคา | ✅ | ✅ | ❌ | ❌ | ❌ |
| ตั้งค่าส่วนลด | ✅ | ✅ | ❌ | ❌ | ❌ |
| จัดการ Users & Roles | ✅ | ❌ | ❌ | ❌ | ❌ |
| ปฏิทินงาน Admin | ✅ (แก้ได้) | ✅ (ดูอย่างเดียว) | ❌ | ✅ (แค่ตัวเอง) | ✅ (แค่ตัวเอง) |
| Finance — ใบเสนอราคา | ✅ | ✅ | ✅ | ✅ | ❌ |
| Requests | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 📊 เมนูที่ 1: Dashboard
**เข้าถึงได้:** ทุกตำแหน่ง

**สิ่งที่ควรตรวจสอบ:**
- [ ] แสดง Pipeline Active, ปิดการขาย, Hot Leads, งานเกินกำหนด ถูกต้อง
- [ ] กดที่ตัวเลขแล้ว navigate ไปยังหน้าที่เกี่ยวข้องได้
- [ ] Lead Status Funnel แสดงสัดส่วนถูกต้อง
- [ ] กิจกรรมล่าสุดแสดงงานที่เกี่ยวข้องกับ user ที่ login
- [ ] Metric ใช้ข้อมูลจริงจาก API และ reports summary ตามสิทธิ์ user

---

## 🏫 เมนูที่ 2: Leads & โรงเรียน
**เข้าถึงได้:** ทุกตำแหน่ง (Sales เห็นเฉพาะ leads ที่ assign ให้ตัวเอง)

**สิ่งที่ควรตรวจสอบ:**
- [ ] Sales เห็นเฉพาะ leads ของตัวเอง / Manager-Exec เห็นทั้งหมด
- [ ] กดดู Lead Detail → เห็นข้อมูลโรงเรียน, contacts, appointments, notes
- [ ] เพิ่ม Lead ใหม่ → กรอกข้อมูล → บันทึก → ปรากฏในรายการ
- [ ] เปลี่ยน Stage (Cold/Warm/Hot/Customer) → อัปเดตทันที
- [ ] แท็บ "AI Coach" — กดรับคำแนะนำ AI สำหรับ lead นั้น
- [ ] กดสร้าง Quote จาก lead → เปิด QuoteBuilder
- [ ] กรองด้วย Status, Zone, Score ทำงานถูกต้อง

---

## 🔄 เมนูที่ 3: Opportunity Pipeline
**เข้าถึงได้:** ทุกตำแหน่ง

**สิ่งที่ควรตรวจสอบ:**
- [ ] แสดง opportunities แบ่งตาม stage (Qualified/Proposal/Demo/Negotiation/Won/Lost)
- [ ] กด card → ดู detail ของ opportunity
- [ ] เพิ่ม opportunity ใหม่ได้
- [ ] มูลค่ารวมแต่ละ stage แสดงถูกต้อง

---

## ✅ เมนูที่ 4: งาน & นัดหมาย
**เข้าถึงได้:** ทุกตำแหน่ง

**สิ่งที่ควรตรวจสอบ:**
- [ ] แสดงงานของตัวเองถูกต้อง (Sales/Admin เห็นเฉพาะงานตัวเอง, Manager/Exec เห็นทั้งทีม)
- [ ] Tab: รอดำเนินการ / เกินกำหนด / เสร็จแล้ว / ทั้งหมด ทำงานถูกต้อง
- [ ] View: รายการ / เดือน / สัปดาห์ / วัน สลับได้
- [ ] กดสร้างงานใหม่ → กรอกชื่องาน, วันที่, เวลา, ประเภท, เชิญผู้เข้าร่วม → บันทึก
- [ ] เชิญผู้เข้าร่วม → ผู้ที่ถูกเชิญเห็น banner "คำเชิญรอตอบรับ"
- [ ] ตอบรับคำเชิญ (เข้าร่วม/รับทราบ/ปฏิเสธ) → มีช่องใส่ข้อความชี้แจง
- [ ] ปฏิเสธในฐานะผู้ใต้บังคับบัญชา → บังคับใส่เหตุผล
- [ ] กดลบงาน → ขึ้น confirm dialog ก่อนลบ
- [ ] คำเชิญรอตอบรับ → กดตอบรับพร้อมข้อความ → ผู้สร้างได้รับแจ้งเตือน 📬

---

## 🗓️ เมนูที่ 5: ปฏิทินกลาง
**เข้าถึงได้:** ทุกตำแหน่ง

**สิ่งที่ควรตรวจสอบ:**
- [ ] View: เดือน / วัน / Agenda สลับได้
- [ ] Sales/Admin เห็นเฉพาะกิจกรรมที่เกี่ยวข้องกับตัวเอง
- [ ] Manager/Exec เห็นกิจกรรมทั้งทีม + มี Filter panel กรองรายคน
- [ ] กดสร้างกิจกรรม → เลือกประเภท (Online/Onsite), วันที่, เวลา, เชิญผู้เข้าร่วม
- [ ] กดกิจกรรมใดก็ตาม → ดู detail ได้ทุกรายการ (ไม่ error)
- [ ] ตอบรับในกิจกรรม → มีช่องใส่ข้อความชี้แจง
- [ ] 📬 Bell notification ผู้สร้าง → ได้รับแจ้งเมื่อมีการตอบรับ + ส่งข้อความโต้ตอบได้

---

## 🤖 เมนูที่ 6: AI บันทึกด้วยการคุย
**เข้าถึงได้:** Sales เท่านั้น

**สิ่งที่ควรตรวจสอบ:**
- [ ] พิมพ์หรือ dictate บันทึกการโทร/นัด → AI แปลงเป็น structured data
- [ ] ตัวอย่าง: พิมพ์ "โทรหาครูแอน ยืนยันนัด Demo วันพุธ บ่าย 2" → AI สร้าง task/appointment
- [ ] บันทึกถูก link กับ lead ที่เกี่ยวข้อง

---

## 👥 เมนูที่ 7: ภาพรวมทีม
**เข้าถึงได้:** Manager, Exec, Exec_asst

**สิ่งที่ควรตรวจสอบ:**
- [ ] แสดง card ของ Sales แต่ละคนพร้อมสถิติ (leads, tasks, deals)
- [ ] กดดู Sales คนใดคนหนึ่ง → เห็น leads และงานของคนนั้น
- [ ] กรองตาม zone/ภาค ทำงานได้

---

## 📅 เมนูที่ 8: รายงานกิจกรรม
**เข้าถึงได้:** ทุกตำแหน่ง

**สิ่งที่ควรตรวจสอบ:**
- [ ] แสดง timeline กิจกรรมที่ผ่านมา
- [ ] กรองตามช่วงเวลา / ประเภทกิจกรรม
- [ ] Sales เห็นเฉพาะกิจกรรมของตัวเอง
- [ ] Export CSV และ Print/PDF ได้
- [ ] มี funnel lead → opportunity → quote → won
- [ ] มีรายงาน quote approval, request SLA, task overdue และ sales performance by user/zone

---

## 🏷️ เมนูที่ 9: สินค้า & ราคา
**เข้าถึงได้:** Manager, Exec, Exec_asst

**สิ่งที่ควรตรวจสอบ:**
- [ ] แสดงรายการสินค้าพร้อมราคา
- [ ] เพิ่ม/แก้ไข/ลบสินค้า (พร้อม confirm ก่อนลบ)
- [ ] สินค้าที่ถูกใช้ใน quote แล้วจะ soft delete/inactive แทนการลบจริง
- [ ] มี import/export CSV, จัดการหมวดหมู่ และ price history
- [ ] Special Offers / โปรโมชั่น ตั้งค่าได้
- [ ] สินค้าที่เพิ่มปรากฏใน QuoteBuilder

---

## 🎚️ เมนูที่ 10: ตั้งค่าส่วนลด
**เข้าถึงได้:** Manager, Exec, Exec_asst

**สิ่งที่ควรตรวจสอบ:**
- [ ] Tab "ตาม Role" — ตั้งค่า % ส่วนลดสูงสุดของ Sales / Manager / Exec
- [ ] Manager ตั้งได้แค่ Sales limit / Exec ตั้งได้ทุก level
- [ ] Tab "รายบุคคล" — กำหนด limit ให้ Sales แต่ละคนได้
- [ ] บันทึกแล้ว limit ใช้งานได้จริงใน QuoteBuilder
- [ ] ประวัติการเปลี่ยนแปลงแสดงถูกต้อง
- [ ] Quote ที่ส่วนลดสูงกว่า Manager limit ต้องให้ Exec/Rank 5 อนุมัติ

---

## 👥 เมนูที่ 11: จัดการ Users & Roles
**เข้าถึงได้:** Exec และ Exec_asst เท่านั้น

**สิ่งที่ควรตรวจสอบ:**

**Tab ผู้ใช้งาน:**
- [ ] แสดง users ทั้งหมด แบ่งกลุ่มตาม Rank 1-5
- [ ] กด "เพิ่มผู้ใช้" → กรอกชื่อ, อีเมล, รหัสผ่าน, เลือก Role → บันทึก
- [ ] Role "ผู้ช่วยผู้บริหาร" → **เฉพาะ Exec เท่านั้นที่กด assign ได้** (Exec_asst กดไม่ได้)
- [ ] แก้ไขข้อมูล user → บันทึกได้
- [ ] ลบ user → ขึ้น confirm dialog ก่อนลบ (ลบตัวเองไม่ได้)

**Tab Roles & สิทธิ์:**
- [ ] แสดง roles ทั้งหมดพร้อม permission summary
- [ ] กด "สร้าง Role ใหม่" → ตั้งชื่อ, Rank, สี, เลือก Preset → toggle permissions รายข้อ
- [ ] Preview role ก่อน save
- [ ] ลบ Role ที่ไม่มี user ใช้งานได้ (System roles ลบไม่ได้)

---

## 📅 เมนูที่ 12: ปฏิทินงาน Admin (ปฏิทินภาพรวมองค์กร)
**เข้าถึงได้:** Manager (read-only), Exec/Exec_asst (แก้ไขได้), Admin/วิชาการ/Production (เฉพาะตัวเอง)

**สิ่งที่ควรตรวจสอบ:**
- [ ] **Exec/Exec_asst** — เห็นงานทุกแผนก, มี filter แผนก/บุคคล, แก้ไขได้เต็มที่
- [ ] **Manager** — เห็นทุกแผนก แต่มี badge "👁 ดูอย่างเดียว" ไม่มีปุ่มแก้ไข
- [ ] **Admin/วิชาการ/Production** — เห็นเฉพาะงานของตัวเองและแผนกตัวเอง
- [ ] กดวันในปฏิทิน → เห็น requests/tasks ของวันนั้น
- [ ] กด request → ดู detail ได้

---

## 💼 เมนูที่ 13: Finance — ใบเสนอราคา
**เข้าถึงได้:** Exec, Exec_asst, Manager, Sales, Finance

**สิ่งที่ควรตรวจสอบ:**
- [ ] แสดงรายการ quotations ทั้งหมด (Sales เห็นเฉพาะของตัวเอง)
- [ ] กดสร้าง Quote → QuoteBuilder เปิดขึ้น
- [ ] เพิ่มสินค้าจาก catalog → คำนวณราคา, ส่วนลด, VAT อัตโนมัติ
- [ ] ส่วนลดที่ใส่เกิน limit → แจ้งเตือน / ส่งอนุมัติต่อ
- [ ] Export เป็น PDF ได้
- [ ] ส่ง Quote → Manager/Exec อนุมัติ → status เปลี่ยน
- [ ] Tab: ทั้งหมด / รอฉัน / อนุมัติแล้ว / ปฏิเสธ
- [ ] Quote detail แสดง revision, approval trail, reject reason, email status, expiry, terms และ customer acceptance
- [ ] Approved/Accepted quote แปลงเป็น Won opportunity ได้

---

## 🔔 Notifications ล่าสุด

- Bell dropdown รองรับ filter ตาม category, unread-only, mark unread และ read all
- User ตั้ง notification preferences ได้
- Backend มี SSE endpoint สำหรับ realtime-ish delivery และ dedupe กัน spam
- Cleanup/archive notification เก่ากว่า 90 วันได้

---

## 📋 เมนูที่ 14: Request System
**เข้าถึงได้:** ทุกตำแหน่ง (สิทธิ์ต่างกัน)

### การสร้าง Request (Sales / ทุกคน)

**Step 1 — ประเภทและเหตุผล:**
- [ ] เลือกประเภท: ขอ Admin Support / ขอค่าใช้จ่าย / ขอของสนับสนุน
- [ ] เลือกประเภทย่อย (เลือกได้หลายรายการ) หรือพิมพ์ใหม่ + Enter
- [ ] **เลือกแผนกปลายทาง** (บังคับ): Admin Support / Finance / ทีมวิชาการ / Production / ให้ Manager กำหนด
- [ ] เลือกบุคคลเฉพาะในแผนกได้ (optional)
- [ ] กรอกชื่อ Request, เชื่อมโรงเรียน, เหตุผล

**Step 2 — รายละเอียดงาน:**
- [ ] เลือกวันที่ (calendar picker) + เวลา (24h dropdown)
- [ ] **Availability Check ปรากฏทันที:**
  - ✅ ว่าง → กรอกต่อได้
  - ⚠️ ว่างบางส่วน → เห็นว่าใครว่าง + time slots ที่ว่าง
  - ❌ ไม่ว่างทั้งหมด → แนะนำ 3 วันใกล้ที่สุดที่ว่าง
- [ ] กรอกสถานที่, ผู้เข้าร่วม, เป้าหมาย

**Step 3 — ยืนยันส่ง:**
- [ ] แสดงสรุปข้อมูลทั้งหมด
- [ ] แสดง flow การอนุมัติ: Sales → Manager/Exec อนุมัติ | Manager/Exec → อนุมัติอัตโนมัติ + แจ้งทีม
- [ ] "บันทึก Draft" หรือ "ส่ง Request"

### Approval Flow

**Sales สร้าง Request:**
- [ ] Status: submitted → รอ Manager/Exec อนุมัติ
- [ ] Manager เห็น badge แดง "รออนุมัติ" ใน Sidebar
- [ ] กด "✓ อนุมัติ" → กำหนด/เปลี่ยน route แผนกก่อนได้ → status: approved
- [ ] กด "✕ ปฏิเสธ" → popup บังคับใส่เหตุผล → Sales ได้รับแจ้ง

**Manager/Exec สร้าง Request:**
- [ ] Status: approved ทันที (auto-approve)
- [ ] Badge แจ้ง Manager + Exec_asst + Exec ทุกคน "📋 รอรับทราบ"
- [ ] กด "รับทราบ" ได้อิสระแต่ละคน (ไม่ต้องรอคนอื่น)
- [ ] แต่ละคนกด ack แล้ว badge ของตัวเองหาย

### Admin/Finance รับงาน

- [ ] เห็นเฉพาะ requests ที่ route มาแผนกตัวเอง
- [ ] Card แสดง "🆕 รอรับงาน" (pulse badge) สำหรับ request ที่ยังไม่มีคนรับ
- [ ] กด "🙋 รับงาน + ลงปฏิทิน" → task ถูกสร้างในปฏิทินของตัวเองอัตโนมัติ
- [ ] กด "❌ ไม่สามารถทำได้" → popup บังคับใส่เหตุผล → Sales รับแจ้ง
- [ ] **กด "🔀 ส่งต่อ"** → เลือกแผนกใหม่ + บุคคล + หมายเหตุ → บันทึก redirect history
- [ ] Admin คนที่ 2 เห็น "📌 รับงานแล้วโดย [ชื่อ]" ไม่มีปุ่มรับซ้ำ

### Sales ได้รับแจ้งเตือน

- [ ] เมื่อ request อนุมัติ → Bell notification ✅
- [ ] เมื่อ request ปฏิเสธ → Bell notification ✕ พร้อมเหตุผล
- [ ] เมื่อ request ถูกส่งต่อแผนก → Bell notification 🔀

---

## 🔔 ระบบแจ้งเตือน (Notifications)

**Sidebar badges:**
| Badge | ความหมาย | ใครเห็น |
|---|---|---|
| 🔴 ตัวเลขแดงที่ Requests | รออนุมัติ หรือ รอรับทราบ auto-approve | Manager/Exec/Exec_asst |
| 🔵 ตัวเลขฟ้าที่ปฏิทินกลาง | คำเชิญรอตอบรับ | ทุกคน |
| ⚪ ตัวเลขที่งาน&นัดหมาย | คำเชิญรอตอบรับในงาน | ทุกคน |
| 📬 การตอบรับกิจกรรม | คนตอบรับงาน/กิจกรรมที่สร้างไว้ | Manager/Exec ผู้สร้าง |

**Bell (กระดิ่ง) สำหรับ Sales:**
- ✅ Quote ได้รับอนุมัติ
- ✕ Quote ถูกปฏิเสธ
- ✅ Request ได้รับอนุมัติ
- ✕ Request ถูกปฏิเสธ (พร้อมเหตุผล)
- 🔀 Request ถูกส่งต่อแผนก

---

## 🔒 กฎ Role & Permission สำคัญ

### Approval Flow
| ผู้สร้าง | ใครอนุมัติ |
|---|---|
| Sales | Manager หรือ Exec หรือ Exec_asst |
| Manager | อนุมัติอัตโนมัติ + แจ้ง Exec/Exec_asst รับทราบ |
| Exec_asst | อนุมัติอัตโนมัติ + แจ้ง Exec/Exec_asst รับทราบ |
| Exec | อนุมัติอัตโนมัติ + แจ้ง Exec/Exec_asst รับทราบ |

### ลำดับชั้น (ใช้ตรวจบังคับเหตุผลปฏิเสธ)
- Exec (rank 4) > Exec_asst (rank 3.5) > Manager (rank 3) > Sales/Admin/Finance (rank 2)
- ผู้ใต้บังคับบัญชาปฏิเสธงานจากผู้สูงกว่า → **บังคับใส่เหตุผล**

### Exec_asst ข้อจำกัด
- ไม่สามารถ assign ตำแหน่ง "ผู้ช่วยผู้บริหาร" ให้คนอื่น — **เฉพาะ Exec เท่านั้น**

---

## 🧪 Checklist การทดสอบแนะนำ

### Test Scenario 1: Sales → Request → Admin รับงาน
1. Login: ธนกร (sales1) → สร้าง Request ขอ Admin Support → เลือกแผนก Admin Support → เลือกวันที่ → ดู Availability Check → ส่ง
2. Login: จิราพร (manager) → เห็น badge → อนุมัติ Request → กำหนด route
3. Login: วรากร (central) → เห็น Request ที่ route มา → รับงาน + ลงปฏิทิน
4. Login: ธนกร (sales1) → เห็น notification ว่า Request อนุมัติแล้ว

### Test Scenario 2: Manager สร้าง Request (Auto-approve)
1. Login: จิราพร (manager) → สร้าง Request ขอของสนับสนุน → เลือก Finance
2. ตรวจสอบ: status เป็น "approved" ทันที
3. Login: ดร.วิชัย (exec) → เห็น badge "รอรับทราบ" → กด รับทราบ
4. Login: พิชาภรณ์ (exec_asst) → ยังเห็น badge อยู่ → กด รับทราบของตัวเอง → badge หาย

### Test Scenario 3: คำเชิญและการตอบรับ
1. Login: จิราพร (manager) → สร้างงาน → เชิญ Sales 3 คน
2. Login: ธนกร (sales1) → เห็น banner คำเชิญ → กด "เข้าร่วม" + พิมพ์ข้อความ
3. Login: นภัสสร (sales2) → กด "ปฏิเสธ" → ต้องใส่เหตุผล (บังคับ เพราะ Manager rank สูงกว่า)
4. Login: จิราพร (manager) → กด 📬 → เห็นการตอบรับพร้อมข้อความ → ส่งข้อความตอบกลับได้

### Test Scenario 4: ส่งต่อ Request
1. Login: ธนกร (sales1) → สร้าง Request → เลือกผิดแผนก (เช่น เลือก Admin แต่ควรเป็น วิชาการ)
2. Login: วรากร (central) → เปิด Request → กด "🔀 ส่งต่อ" → เลือก ทีมวิชาการ + หมายเหตุ
3. Login: ดร.ชนม์ชนก (academic1) → เห็น Request ที่ route มาใหม่
4. Login: ธนกร (sales1) → เห็น notification 🔀 ว่า request ถูกส่งต่อ

### Test Scenario 5: User Management
1. Login: ดร.วิชัย (exec) → จัดการ Users & Roles → สร้าง Role ใหม่ → ตั้ง permission
2. เพิ่ม User ใหม่ → เลือก Role ที่สร้าง
3. ลอง assign role "ผู้ช่วยผู้บริหาร" → ทำได้ (เพราะเป็น Exec)
4. Login: พิชาภรณ์ (exec_asst) → ลอง assign role เดียวกัน → ปุ่มถูก lock

---

## ⚠️ ข้อจำกัดที่ทราบอยู่แล้ว

1. **User Management** — การเพิ่ม user ใหม่บันทึกใน localStorage แต่ยังไม่ได้ผูกกับระบบ Login จริง (users ที่ login ได้คือ 14 คนใน USERS array เท่านั้น)
2. **ข้อมูล INIT** — ข้อมูลตัวอย่าง (leads, requests, tasks) เป็น demo data จะรีเซ็ตเมื่อล้าง localStorage
3. **Availability Check** — ตรวจจาก tasks/requests/events ที่อยู่ใน system เท่านั้น ไม่ sync กับ calendar ภายนอก
4. **AI บันทึกด้วยการคุย** — เป็น simulation ยังไม่ได้เชื่อมกับ AI จริง
