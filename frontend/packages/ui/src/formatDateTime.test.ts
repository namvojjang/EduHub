import { describe, expect, it } from 'vitest';
import { formatDateTime } from './formatDateTime';

describe('formatDateTime', () => {
  it('ISO 일시를 "날짜 시:분"으로 바꾼다', () => {
    expect(formatDateTime('2026-12-01T09:00:00')).toBe('2026-12-01 09:00');
  });

  it('값이 없으면 "-"를 돌려준다', () => {
    expect(formatDateTime(undefined)).toBe('-');
  });
});
