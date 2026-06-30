import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LENGTH = 64;
const SCRYPT_PREFIX = 'scrypt';
const SCRYPT_PARAMS = {
  cost: 16384,
  blockSize: 8,
  parallelization: 1
};

export function validatePasswordPolicy(password: string) {
  const errors: string[] = [];
  if (password.length < 8) errors.push('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
  if (!/[A-Z]/.test(password)) errors.push('ต้องมีตัวอักษรภาษาอังกฤษตัวพิมพ์ใหญ่');
  if (!/[a-z]/.test(password)) errors.push('ต้องมีตัวอักษรภาษาอังกฤษตัวพิมพ์เล็ก');
  if (!/[0-9]/.test(password)) errors.push('ต้องมีตัวเลขอย่างน้อย 1 ตัว');
  if (['1234', 'password', 'Password1', 'Password123'].includes(password)) {
    errors.push('ห้ามใช้รหัสผ่าน default หรือรหัสที่เดาง่าย');
  }
  return { valid: errors.length === 0, errors };
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS).toString('hex');
  return [
    SCRYPT_PREFIX,
    SCRYPT_PARAMS.cost,
    SCRYPT_PARAMS.blockSize,
    SCRYPT_PARAMS.parallelization,
    salt,
    hash
  ].join('$');
}

export function isPasswordHash(value: string) {
  return value.startsWith(`${SCRYPT_PREFIX}$`);
}

export function verifyPassword(password: string, storedValue: string) {
  if (!isPasswordHash(storedValue)) {
    return {
      valid: password === storedValue,
      needsRehash: password === storedValue
    };
  }

  const [, costRaw, blockSizeRaw, parallelizationRaw, salt, expectedHashHex] = storedValue.split('$');
  if (!salt || !expectedHashHex) {
    return { valid: false, needsRehash: false };
  }

  const actual = scryptSync(password, salt, KEY_LENGTH, {
    cost: Number(costRaw) || SCRYPT_PARAMS.cost,
    blockSize: Number(blockSizeRaw) || SCRYPT_PARAMS.blockSize,
    parallelization: Number(parallelizationRaw) || SCRYPT_PARAMS.parallelization
  });
  const expected = Buffer.from(expectedHashHex, 'hex');
  if (actual.length !== expected.length) {
    return { valid: false, needsRehash: false };
  }

  return {
    valid: timingSafeEqual(actual, expected),
    needsRehash: false
  };
}
