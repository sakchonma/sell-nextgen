export function provinceToZone(province?: string) {
  const normalized = String(province || '').replace(/\s/g, '');
  if (!normalized) return 'ภาคกลาง';
  const east = ['ชลบุรี', 'ระยอง', 'จันทบุรี', 'ตราด', 'ฉะเชิงเทรา', 'ปราจีนบุรี', 'สระแก้ว'];
  const north = ['เชียงใหม่', 'เชียงราย', 'ลำพูน', 'ลำปาง', 'แพร่', 'น่าน', 'พะเยา', 'แม่ฮ่องสอน', 'อุตรดิตถ์', 'พิษณุโลก', 'สุโขทัย', 'ตาก', 'กำแพงเพชร', 'พิจิตร', 'เพชรบูรณ์'];
  const south = ['สุราษฎร์ธานี', 'นครศรีธรรมราช', 'สงขลา', 'ภูเก็ต', 'กระบี่', 'ตรัง', 'พัทลุง', 'ชุมพร', 'ระนอง', 'พังงา', 'สตูล', 'ปัตตานี', 'ยะลา', 'นราธิวาส'];
  const west = ['กาญจนบุรี', 'ราชบุรี', 'เพชรบุรี', 'ประจวบคีรีขันธ์'];
  const isan = ['นครราชสีมา', 'ขอนแก่น', 'อุดรธานี', 'อุบลราชธานี', 'บุรีรัมย์', 'สุรินทร์', 'ศรีสะเกษ', 'ร้อยเอ็ด', 'มหาสารคาม', 'กาฬสินธุ์', 'สกลนคร', 'นครพนม', 'มุกดาหาร', 'เลย', 'หนองคาย', 'บึงกาฬ', 'หนองบัวลำภู', 'ชัยภูมิ', 'ยโสธร', 'อำนาจเจริญ'];
  if (east.some(item => normalized.includes(item))) return 'ภาคตะวันออก';
  if (north.some(item => normalized.includes(item))) return 'ภาคเหนือ';
  if (south.some(item => normalized.includes(item))) return 'ภาคใต้';
  if (west.some(item => normalized.includes(item))) return 'ภาคตะวันตก';
  if (isan.some(item => normalized.includes(item))) return 'ภาคอีสาน';
  return 'ภาคกลาง';
}
