import { describe, expect, it } from 'vitest';
import { parseNumericInput, stripLeadingZeros } from './numeric-input';

describe('stripLeadingZeros', () => {
  it('keeps a single zero', () => {
    expect(stripLeadingZeros('0')).toBe('0');
    expect(stripLeadingZeros('00')).toBe('0');
  });

  it('removes zeros in front of whole numbers', () => {
    expect(stripLeadingZeros('01')).toBe('1');
    expect(stripLeadingZeros('00015')).toBe('15');
    expect(stripLeadingZeros('10')).toBe('10');
    expect(stripLeadingZeros('100')).toBe('100');
  });

  it('normalizes decimal values', () => {
    expect(stripLeadingZeros('0.5', true)).toBe('0.5');
    expect(stripLeadingZeros('00.50', true)).toBe('0.50');
    expect(stripLeadingZeros('05.2', true)).toBe('5.2');
    expect(stripLeadingZeros('.', true)).toBe('0.');
  });
});

describe('parseNumericInput', () => {
  it('parses cleaned numeric text', () => {
    expect(parseNumericInput('')).toBe(0);
    expect(parseNumericInput('15')).toBe(15);
    expect(parseNumericInput('0.5')).toBe(0.5);
  });
});
