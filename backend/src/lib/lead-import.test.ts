import { describe, expect, it } from 'vitest';
import {
  buildLeadFromImportRow,
  collapseImportDrafts,
  mapLegacyStepToLeadStage,
  parseStatusOccurredAt,
  resolveAssignedUserId,
  resolveImportStage,
  splitRemarkLogs,
  statusFromStage,
} from './lead-import.js';

describe('resolveImportStage', () => {
  it('maps remapped status labels to funnel stages', () => {
    expect(resolveImportStage('Call', 'รอยื่นหนังสือ')).toBe('Call');
    expect(resolveImportStage('นัดหมาย', 'ยื่นหนังสือ ติดตามผล')).toBe('Meeting');
    expect(resolveImportStage('Presentation', 'Present')).toBe('Presentation');
    expect(resolveImportStage('Lost', 'ผอ.ไม่สนใจ ')).toBe('Lost');
    expect(resolveImportStage('Pending', 'รร. จะติดต่อกลับมา')).toBe('Call');
  });

  it('maps original Thai steps when status is empty', () => {
    expect(mapLegacyStepToLeadStage('รอยื่นหนังสือ')).toBe('Call');
    expect(mapLegacyStepToLeadStage('ยื่นหนังสือ ติดตามผล')).toBe('Meeting');
    expect(mapLegacyStepToLeadStage('โทรติดตาม ซ้ำ')).toBe('Meeting');
    expect(mapLegacyStepToLeadStage('Present')).toBe('Presentation');
    expect(mapLegacyStepToLeadStage('ผอ.ไม่สนใจ')).toBe('Lost');
    expect(mapLegacyStepToLeadStage('ไม่มีคนรับสาย ติดต่อซ้ำ')).toBe('Call');
  });
});

describe('statusFromStage', () => {
  it('derives lead temperature from funnel stage', () => {
    expect(statusFromStage('Call')).toBe('Cold');
    expect(statusFromStage('Meeting')).toBe('Warm');
    expect(statusFromStage('Presentation')).toBe('Warm');
    expect(statusFromStage('Lost')).toBe('Cold');
    expect(statusFromStage('Call', 'Pending')).toBe('Cold');
    expect(statusFromStage('Call', 'Warm')).toBe('Warm');
  });
});

describe('buildLeadFromImportRow', () => {
  it('reads Thai Excel headers including leading-space school name', () => {
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
    expect(lead.stage).toBe('Call');
    expect(lead.status).toBe('Cold');
    expect(lead.educationAuthority).toBe('สช.');
    expect(lead.legacySaleName).toBe('พิมพ์สุดา พิทักษ์วงค์');
    expect(lead.documentStatus).toBe('ยื่นหนังสือ 10/06/69');
    expect(lead.statusOccurredAt).toBe('2026-06-10');
    expect(lead.remarkLogs?.[0]?.content).toBe('ยื่น นส รร');
    expect(lead.contacts[0]?.email).toBe('assumption@ac.ac.th');
    expect(lead.studentCount).toBe(2174);
    expect(lead.upperElementaryStudentCount).toBeUndefined();
  });

  it('maps นัดหมาย to Meeting / Warm', () => {
    const lead = buildLeadFromImportRow({
      โรงเรียน: 'โรงเรียนกาญจนะวิทยา',
      สถานะ: 'นัดหมาย',
      อยู่ในขั้นตอน: 'ยื่นหนังสือ ติดตามผล',
      จังหวัด: 'ชลบุรี',
    }, { index: 1, currentUserId: 'u1' });

    expect(lead.stage).toBe('Meeting');
    expect(lead.status).toBe('Warm');
    expect(lead.zone).toBe('ภาคตะวันออก');
  });

  it('collapses same school + district + province', () => {
    const a = buildLeadFromImportRow({
      โรงเรียน: 'โรงเรียนเจริญสุขวิทยา',
      เขต: 'อำเภอเมืองชลบุรี',
      จังหวัด: 'ชลบุรี',
      สถานะ: 'นัดหมาย',
    }, { index: 0, currentUserId: 'u1' });
    const b = buildLeadFromImportRow({
      โรงเรียน: 'โรงเรียนเจริญสุขวิทยา',
      เขต: 'อำเภอเมืองชลบุรี',
      จังหวัด: 'ชลบุรี',
      สถานะ: 'Presentation',
    }, { index: 1, currentUserId: 'u1' });

    const merged = collapseImportDrafts([a, b]);
    expect(merged).toHaveLength(1);
    expect(merged[0].stage).toBe('Presentation');
  });
});

describe('parseStatusOccurredAt', () => {
  it('parses Buddhist and short dates from column P', () => {
    expect(parseStatusOccurredAt('ยื่นหนังสือ 10/06/69')).toBe('2026-06-10');
    expect(parseStatusOccurredAt('Ps 29/05/26')).toBe('2026-05-29');
    expect(parseStatusOccurredAt('ยื่นหนังสือ 30/06')).toBe('2026-06-30');
    expect(parseStatusOccurredAt('Email 2/7')).toBe('2026-07-02');
    expect(parseStatusOccurredAt('kst2540@gmail.com')).toBeUndefined();
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
