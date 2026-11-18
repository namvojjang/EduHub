import { createTheme } from '@mantine/core';

// 화면 공통 테마 (설계명세 2절): 주색 indigo, 둥근 모서리 md, 웹 폰트 없이 시스템 글꼴 사용.
export const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'md',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Malgun Gothic", sans-serif',
});
