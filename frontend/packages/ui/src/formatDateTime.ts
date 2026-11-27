/** "2026-12-01T09:00:00" → "2026-12-01 09:00" */
export function formatDateTime(value?: string): string {
  return value ? value.replace('T', ' ').slice(0, 16) : '-';
}
