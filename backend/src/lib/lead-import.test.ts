import { describe, expect, it } from 'vitest';
import {
  buildLeadFromImportRow,
  collapseImportDrafts,
  mapLegacyStepToLeadStage,
  resolveAssignedUserId,
  resolveImportStage,
  splitRemarkLogs,
  statusFromStage,
} from './lead-import.js';

describe('resolveImportStage', () => {
  it('uses Excel column J as the source of truth', () => {
    expect(resolveImportStage('Call', 'รอยื่นหนังสือ')).toBe('Called');
    expect(resolveImportStage('นัดหมาย', 'ยื่นหนังสือ ติดตามผล')).toBe('DocumentSent');
    expect(resolveImportStage('Presentation', 'Present')).toBe('Presented');
    expect(resolveImportStage('Lost', 'ผอ.ไม่สนใจ ')).toBe('Lost');
    expect(resolveImportStage('Pending', 'รร. จะติดต่อกลับมา')).toBe('DocumentSent');
    expect(resolveImportStage('', '')).toBe('TargetSchool');
  });

  it('maps original Thai steps when status is empty', () => {
    expect(mapLegacyStepToLeadStage('รอยื่นหนังสือ')).toBe('Called');
    expect(mapLegacyStepToLeadStage('ยื่นหนังสือ ติดตามผล')).toBe('DocumentSent');
    expect(mapLegacyStepToLeadStage('โทรติดตาม ซ้ำ')).toBe('DocumentSent');
    expect(mapLegacyStepToLeadStage('ยื่นหนังสือ')).toBe('DocumentSent');
    expect(mapLegacyStepToLeadStage('Present')).toBe('Presented');
    expect(mapLegacyStepToLeadStage('ผอ.ไม่สนใจ')).toBe('Lost');
    expect(mapLegacyStepToLeadStage('ไม่มีคนรับสาย ติดต่อซ้ำ')).toBe('Called');
    expect(mapLegacyStepToLeadStage('')).toBe('TargetSchool');
  });
});

describe('statusFromStage', () => {
  it('derives lead temperature from the new funnel stage', () => {
    expect(statusFromStage('TargetSchool')).toBe('Cold');
    expect(statusFromStage('Called')).toBe('Cold');
    expect(statusFromStage('DocumentSent')).toBe('Cold');
    expect(statusFromStage('Appointed')).toBe('Cold');
    expect(statusFromStage('Presented')).toBe('Warm');
    expect(statusFromStage('DemoWorkshop')).toBe('Hot');
    expect(statusFromStage('Quotation')).toBe('Customer');
    expect(statusFromStage('Won')).toBe('Customer');
    expect(statusFromStage('Lost')).toBe('Cold');
  });
});

describe('buildLeadFromImportRow', () => {
  it('reads Thai Excel headers and ignores column P', () => {
    const lead = buildLeadFromImportRow({
      ' โรงเรียน': 'โรงเรียนอัสสัมชัญ บางรัก',
      ระดับชั้น: 'มัธยมศึกษาต้น-ปลาย',
      สังกัด: 'สช.',
      เขต: 'เขตบางรัก',
      จังหวัด: 'กรุงเทพฯ',
      'จำนวน นร.': '2174',
      'จำนวน นร. ป.4-6': '-',
      สถานะ: 'Pending',
      อยู่ในขั้นตอน: 'รร. จะติดต่อกลับมา',
      เบอร์โทร: '02-630-7111',
      อีเมล: 'assumption@ac.ac.th',
      'Ps / ยื่นหนังสือ /Trial': 'ยื่นหนังสือ 10/06/69',
      Remarks: 'ยื่น นส รร',
      Sale: 'พิมพ์',
    }, { index: 0, currentUserId: 'u1' });

    expect(lead.schoolName).toBe('โรงเรียนอัสสัมชัญ บางรัก');
    expect(lead.stage).toBe('DocumentSent');
    expect(lead.status).toBe('Cold');
    expect(lead.educationAuthority).toBe('สช.');
    expect(lead.legacySaleName).toBe('พิมพ์สุดา พิทักษ์วงค์');
    expect((lead as any).documentStatus).toBeUndefined();
    expect((lead as any).statusOccurredAt).toBeUndefined();
    expect(lead.remarkLogs?.[0]?.content).toBe('ยื่น นส รร');
    expect(lead.contacts[0]?.email).toBe('assumption@ac.ac.th');
    expect(lead.studentCount).toBe(2174);
    expect(lead.upperElementaryStudentCount).toBeUndefined();
  });

  it('maps ยื่นหนังสือ to DocumentSent / Cold', () => {
    const lead = buildLeadFromImportRow({
      โรงเรียน: 'โรงเรียนกาญจนะวิทยา',
      สถานะ: 'นัดหมาย',
      อยู่ในขั้นตอน: 'ยื่นหนังสือ ติดตามผล',
      จังหวัด: 'ชลบุรี',
    }, { index: 1, currentUserId: 'u1' });

    expect(lead.stage).toBe('DocumentSent');
    expect(lead.status).toBe('Cold');
    expect(lead.zone).toBe('ภาคตะวันออก');
  });

  it('merges unlabeled column R into remark logs', () => {
    const lead = buildLeadFromImportRow({
      โรงเรียน: 'โรงเรียนทดสอบ',
      Remarks: 'ยื่น นส รร',
      ผู้ติดต่อ: 'ครูสมศรี',
      เบอร์โทร: '0811111111',
    }, { index: 2, currentUserId: 'u1' });

    expect(lead.remarkLogs?.map(item => item.content)).toEqual(['ยื่น นส รร', 'ครูสมศรี']);
    expect(lead.contacts[0]?.name).toBe('ผู้ติดต่อจากไฟล์นำเข้า');
  });

  it('collapses same school + district + province using later J stage', () => {
    const a = buildLeadFromImportRow({
      โรงเรียน: 'โรงเรียนเจริญสุขวิทยา',
      เขต: 'อำเภอเมืองชลบุรี',
      จังหวัด: 'ชลบุรี',
      อยู่ในขั้นตอน: 'รอยื่นหนังสือ',
    }, { index: 0, currentUserId: 'u1' });
    const b = buildLeadFromImportRow({
      โรงเรียน: 'โรงเรียนเจริญสุขวิทยา',
      เขต: 'อำเภอเมืองชลบุรี',
      จังหวัด: 'ชลบุรี',
      อยู่ในขั้นตอน: 'Present',
    }, { index: 1, currentUserId: 'u1' });

    const merged = collapseImportDrafts([a, b]);
    expect(merged).toHaveLength(1);
    expect(merged[0].stage).toBe('Presented');
  });
});

describe('splitRemarkLogs', () => {
  it('splits Excel remarks into a log set', () => {
    const logs = splitRemarkLogs('ยื่น นส รร -> 22/06 คุณครูได้รับหนังสือ');
    expect(logs).toHaveLength(2);
    expect(logs[0].content).toBe('ยื่น นส รร');
    expect(logs[1].content).toContain('22/06');
  });
});

describe('resolveAssignedUserId', () => {
  const users = [
    { _id: 'root', name: 'ผู้ดูแลระบบ (Root Admin)', email: 'root@nextgen.co.th', roleId: 'r_exec' },
    { _id: 'u_p', name: 'พิมพ์สุดา พิทักษ์วงค์', email: 'pimsuda.nextgen@gmail.com', roleId: 'r_sales' },
    { _id: 'u_y', name: 'วีรินท์รดา พูนสวัสดิ์', email: 'yimewerinrada.nextgen@gmail.com', roleId: 'r_sales' },
  ];

  it('maps nicknames to real users', () => {
    expect(resolveAssignedUserId('พิมพ์', users, 'fallback').userId).toBe('u_p');
    expect(resolveAssignedUserId('ยิ้ม', users, 'fallback').userId).toBe('u_y');
    expect(resolveAssignedUserId('พี่เกรซ', users, 'fallback').userId).toBe('root');
  });
});
