"""Convert the two NEXTGEN Excel files into backend/data/segment-leads.json.

Usage: python3 convert.py <corporate.xlsx> <faculty.xlsx> <out.json>
"""
import datetime as dt
import json
import re
import sys

import openpyxl

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"\+?\d[\d\-\s()]{4,18}\d")
URL_RE = re.compile(r"^https?://", re.I)


def clean(v):
    if v is None:
        return None
    if isinstance(v, (dt.datetime, dt.date)):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, float):
        if v != v:  # NaN
            return None
        return int(v) if v.is_integer() else v
    if isinstance(v, str):
        s = v.strip()
        return s or None
    return v


def read_table(ws, header_row, id_col_name, id_pattern):
    headers = [clean(c.value) for c in ws[header_row]]
    rows = []
    for r in ws.iter_rows(min_row=header_row + 1, values_only=True):
        rec = {}
        for h, v in zip(headers, r):
            if h:
                rec[h] = clean(v)
        rid = rec.get(id_col_name)
        if isinstance(rid, str) and re.fullmatch(id_pattern, rid):
            rows.append(rec)
    return rows


def pick(rec, mapping):
    out = {}
    for key, col in mapping.items():
        v = rec.get(col)
        if v is not None:
            out[key] = v
    return out


def split_contact(raw):
    """Return (phone or None, emails list) from a free-text channel cell."""
    if not raw:
        return None, []
    text = str(raw)
    emails = EMAIL_RE.findall(text)
    rest = EMAIL_RE.sub(" ", text)
    phone = None
    m = PHONE_RE.search(rest)
    if m:
        cand = re.sub(r"\s+", " ", m.group(0)).strip()
        # keep the extension so faculties sharing a university switchboard stay distinct
        ext = re.match(r"\s*ต่อ\s*(\d{1,5})", rest[m.end():])
        if ext and len(f"{cand} ({ext.group(1)})") <= 20:
            cand = f"{cand} ({ext.group(1)})"
        if 6 <= len(cand) <= 20 and len(re.sub(r"\D", "", cand)) >= 6:
            phone = cand
    return phone, emails


REGION_TO_ZONE = {
    "กลาง": "ภาคกลาง",
    "เหนือ": "ภาคเหนือ",
    "ใต้": "ภาคใต้",
    "ตะวันออก": "ภาคตะวันออก",
    "ตะวันตก": "ภาคตะวันตก",
    "ตะวันออกเฉียงเหนือ": "ภาคอีสาน",
}

# ---------------------------------------------------------------- corporate
CORP_MASTER = {
    "code": "ID", "region": "ภูมิภาค", "orgType": "ประเภทองค์กร", "locationNote": "สถานะที่ตั้ง",
    "tier": "ลำดับ (สูตร)", "evidence": "หลักฐานที่พบ", "serviceOffer": "บริการที่ควรเสนอ",
    "targetRole": "บทบาทที่ควรสอบถาม", "directProjectEvidence": "หลักฐานโครงการตรง",
    "confirmedNeed": "โจทย์ยืนยัน", "confirmedOwner": "เจ้าของโครงการยืนยัน",
    "confirmedWithin6Months": "จัดภายใน 6 เดือนยืนยัน", "confirmedBudget": "งบและวิธีซื้อยืนยัน",
    "officialChannelUrl": "ช่องทางกลางทางการ", "centralContact": "เบอร์กลาง/ทางเข้าหา",
    "toVerify": "สิ่งที่ต้องตรวจเพิ่ม", "budgetGroup": "กลุ่มงบที่ต้องตรวจ", "checkedAt": "ตรวจข้อมูลเมื่อ",
    "evidenceUrl": "URL หลักฐาน", "evidenceYear": "ปีของหลักฐาน (พ.ศ.)", "evidenceYearBasis": "ฐานปีของหลักฐาน",
    "activityKind": "ลักษณะกิจกรรม", "eventStatus2569": "สถานะงานปี 2569",
    "confirmedEventDate": "วันจัดที่ยืนยัน (ค.ศ.)", "newsDate": "วันเผยแพร่ข่าว (ค.ศ.)",
    "procurementStatus": "สถานะจัดซื้อ", "recommendedRound": "รอบขายแนะนำ",
    "nextAction": "สิ่งที่ทีมขายควรทำต่อ", "statusEvidenceLevel": "ระดับหลักฐานสถานะ",
    "checkScope": "ขอบเขตที่ตรวจ", "statusUrl": "URL ยืนยันสถานะ", "reviewedAt": "วันที่ทบทวน (ค.ศ.)",
}
CORP_DEAL = {
    "followerRole": "ผู้ติดตามหลัก", "dealStep": "ขั้นตอน", "lastContactedAt": "ติดต่อครั้งล่าสุด",
    "nextAppointmentAt": "วันที่นัดถัดไป", "nextTask": "งานถัดไป", "needOrConfirmedDate": "โจทย์/วันจัดที่ยืนยัน",
    "buyerChannel": "ผู้ซื้อ/ช่องทางยืนยัน", "proposedValue": "มูลค่าเสนอ (บาท)", "expectedDecision": "คาดตัดสินใจ",
    "contractValue": "มูลค่าสัญญายืนยัน (บาท)", "receivedAmount": "เงินรับจริง (บาท)",
    "lostReason": "เหตุผลแพ้/เลื่อน", "lastContactResult": "ผลติดต่อล่าสุด",
    "dealEventStatus": "สถานะงานปี 2569", "dealProcurementStatus": "สถานะจัดซื้อ",
    "followupFromStatus": "งานต่อจากสถานะกิจกรรม",
}
CORP_TOP20 = {
    "initialOffer": "ข้อเสนอเริ่มต้น", "approach": "ทางเข้าหา",
    "top20Channel": "เบอร์ / อีเมลกลาง", "contactUrl": "URL ช่องทางติดต่อ",
    "infoToAsk": "ข้อมูลที่ต้องถามเพิ่ม", "confirmedContactName": "ชื่อผู้ดูแลที่ยืนยันแล้ว",
}
CORP_DEAL_STEP_TO_STAGE = {"ยังไม่ติดต่อ": "TargetSchool"}


def corporate_records(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    master = read_table(wb["รายชื่อทั่วประเทศ"], 6, "ID", r"L\d+")
    deals = {r["ID"]: r for r in read_table(wb["ติดตามดีล"], 6, "ID", r"L\d+")}
    top = {r["ID"]: r for r in read_table(wb["ลูกค้าเป้าหมาย"], 6, "ID", r"L\d+")}
    out = []
    for m in master:
        code = m["ID"]
        profile = pick(m, CORP_MASTER)
        deal = deals.get(code, {})
        dprof = pick(deal, CORP_DEAL)
        # sheet artefacts: "0" / "ค่า" in follower column are not real values
        if str(dprof.get("followerRole", "")) in {"0", "ค่า"}:
            dprof.pop("followerRole")
        for k in ("dealEventStatus", "dealProcurementStatus"):
            base = profile.get("eventStatus2569" if k == "dealEventStatus" else "procurementStatus")
            if dprof.get(k) == base:
                dprof.pop(k)
        profile.update(dprof)
        if code in top:
            profile.update(pick(top[code], CORP_TOP20))
            profile["isTop20"] = True
        else:
            profile["isTop20"] = False

        contacts = []
        phone, emails = split_contact(profile.get("centralContact") or profile.get("top20Channel"))
        if phone or emails:
            raw = profile.get("centralContact") or profile.get("top20Channel")
            contacts.append({
                "name": "ช่องทางกลาง",
                "position": f"{profile.get('targetRole', '')} · {raw}".strip(" ·"),
                **({"phone": phone} if phone else {}),
                **({"email": emails[0]} if emails else {}),
            })
        if profile.get("confirmedContactName"):
            contacts.append({"name": profile["confirmedContactName"], "position": "ผู้ดูแลที่ยืนยันแล้ว"})

        step = deal.get("ขั้นตอน")
        stage = CORP_DEAL_STEP_TO_STAGE.get(step, "TargetSchool")
        out.append({
            "externalRef": f"corporate:{code}",
            "segment": "corporate",
            "name": m["องค์กร/หน่วยเป้าหมาย"],
            "province": m.get("จังหวัดเป้าหมาย"),
            "zone": REGION_TO_ZONE.get(m.get("ภูมิภาค"), "ภาคกลาง"),
            "stage": stage,
            "lastContactedAt": profile.get("lastContactedAt"),
            "nextCallAt": profile.get("nextAppointmentAt"),
            "campaign": "Corporate Sales Launch 2569",
            "contacts": contacts,
            "profile": profile,
        })
    return out


# --------------------------------------------------------------- university
UNI_MAIN = {
    "facultyCode": "รหัสคณะ", "approachOrder": "ลำดับเข้าหาเสนอ", "institutionType": "ประเภท",
    "university": "มหาวิทยาลัย", "faculty": "คณะ / วิทยาลัย", "meetingArea": "พื้นที่นัดหมาย",
    "tier": "ระดับหลักฐาน", "activityEvidence": "กิจกรรม / หลักฐานที่พบ",
    "evidenceYear": "ปีหลักฐาน / วันจัด", "facultyVoice": "เสียงคณะที่เผยแพร่ (สรุป)",
    "pastBudget": "งบปฐมนิเทศย้อนหลัง (บาท)", "fiscalYear": "ปีงบประมาณ", "newBudgetStatus": "สถานะงบรอบใหม่",
    "pitchAngle": "มุมเสนอ BEYOND FIRST MEET (เสนอ)", "insight": "Insight ที่ควรคุย (เสนอ)",
    "selectionReason": "เหตุผลคัดเข้าหา", "evidenceLimit": "ข้อจำกัดหลักฐาน", "nextRound": "รอบกิจกรรมถัดไป",
    "activityUrl": "URL กิจกรรม / งบ", "supportUrl": "URL ประกอบ", "webCheckedAt": "วันที่ตรวจเว็บ",
}
UNI_CONTACT = {
    "targetRole": "ผู้ที่ควรขอคุย", "phoneRaw": "โทรศัพท์จากเว็บ", "emailRaw": "อีเมลจากเว็บ",
    "channelScope": "ขอบเขตช่องทาง", "openQuestion": "คำถามเปิดฟังเสียงคณะ",
    "painQuestion": "คำถามเจาะปัญหา / ผลลัพธ์", "budgetQuestion": "คำถามงบ / ผู้อนุมัติ / วิธีซื้อ",
    "realVoice": "เสียงจากคณะจริง (รอกรอก)", "confirmedBuyer": "ผู้ซื้อ / ผู้อนุมัติยืนยัน",
    "confirmedNewBudget": "งบรอบใหม่ยืนยัน (บาท)", "purchaseMethod": "วิธีซื้อ / งบร่วม",
    "confirmedDecisionDate": "วันที่ตัดสินใจยืนยัน", "confirmedEventDate": "วันจัดยืนยัน",
    "followerRole": "ผู้ติดตามหลัก", "nextTask": "งานถัดไปเสนอ", "followUpDate": "กำหนดติดตามเสนอ",
    "contactStatus": "สถานะติดต่อ", "newBudgetStatusDetail": "สถานะงบรอบใหม่",
    "limitation": "ข้อจำกัด / จุดต้องตรวจสอบ", "contactUrl": "URL ช่องทางติดต่อ",
}
UNI_START5 = {"startFirstReason": "เหตุผลที่เริ่มก่อน", "pastBudgetText": "งบย้อนหลัง / สถานะ", "firstQuestion": "คำถามแรก"}
UNI_STATUS_TO_STAGE = {"ติดต่อแล้ว": "Called", "นัดเก็บโจทย์": "Appointed", "เก็บโจทย์แล้ว": "Presented"}
AREA_TO_PROVINCE = [("ปทุมธานี", "ปทุมธานี"), ("นครปฐม", "นครปฐม"), ("กรุงเทพ", "กรุงเทพมหานคร")]


def university_records(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    main = read_table(wb["เจาะรายคณะ"], 8, "รหัสคณะ", r"FAC-\d+")
    contacts = {r["รหัสคณะ"]: r for r in read_table(wb["ติดต่อและฟังเสียง"], 8, "รหัสคณะ", r"FAC-\d+")}
    start5 = {r["รหัสคณะ"]: r for r in read_table(wb["เริ่มที่5คณะ"], 12, "รหัสคณะ", r"FAC-\d+")}
    out = []
    for m in main:
        code = m["รหัสคณะ"]
        profile = pick(m, UNI_MAIN)
        c = contacts.get(code, {})
        cprof = pick(c, UNI_CONTACT)
        if cprof.get("newBudgetStatusDetail") == profile.get("newBudgetStatus"):
            cprof.pop("newBudgetStatusDetail", None)
        profile.update(cprof)
        profile["startFirst"] = code in start5
        if code in start5:
            profile.update(pick(start5[code], UNI_START5))

        lead_contacts = []
        phone, _ = split_contact(profile.get("phoneRaw"))
        _, emails = split_contact(profile.get("emailRaw"))
        if phone or emails:
            lead_contacts.append({
                "name": "สำนักงานคณะ (ช่องทางกลาง)",
                "position": f"{profile.get('targetRole', '')} · {profile.get('phoneRaw', '')}".strip(" ·"),
                **({"phone": phone} if phone else {}),
                **({"email": emails[0]} if emails else {}),
            })
        buyer = profile.get("confirmedBuyer")
        if buyer and not buyer.startswith("ยังไม่พบ"):
            lead_contacts.append({"name": buyer, "position": "ผู้ประสาน/ผู้มีอำนาจ (รอยืนยัน)"})

        area = profile.get("meetingArea", "")
        province = next((p for key, p in AREA_TO_PROVINCE if key in area), "กรุงเทพมหานคร")
        out.append({
            "externalRef": f"university:{code}",
            "segment": "university",
            "name": f"{profile['faculty']} {profile['university']}",
            "province": province,
            "zone": "ภาคกลาง",
            "stage": UNI_STATUS_TO_STAGE.get(profile.get("contactStatus"), "TargetSchool"),
            "lastContactedAt": None,
            "nextCallAt": profile.get("followUpDate"),
            "campaign": "BEYOND FIRST MEET — Faculty Orientation 2570",
            "contacts": lead_contacts,
            "profile": profile,
        })
    return out


def main():
    corp_path, uni_path, out_path = sys.argv[1:4]
    corp = corporate_records(corp_path)
    uni = university_records(uni_path)
    for rec in corp + uni:
        for k in [k for k, v in rec.items() if v is None]:
            rec.pop(k)
    payload = {
        "generatedFrom": {
            "corporate": corp_path.split("/")[-1].split("-", 1)[-1],
            "university": uni_path.split("/")[-1].split("-", 1)[-1],
        },
        "records": corp + uni,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    print(f"corporate={len(corp)} university={len(uni)} -> {out_path}")


if __name__ == "__main__":
    main()
