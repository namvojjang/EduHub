import { createTheme } from '@mantine/core';

// 화면 공통 테마 (설계명세 6.2): Pretendard 우선 글꼴, 주색 indigo, 둥근 모서리 md(카드·종이는 lg).
const FONT_FAMILY =
  '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Malgun Gothic", sans-serif';

export const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'md',
  fontFamily: FONT_FAMILY,
  headings: { fontFamily: FONT_FAMILY },
  components: {
    Card: { defaultProps: { radius: 'lg' } },
    Paper: { defaultProps: { radius: 'lg' } },
    Button: { defaultProps: { radius: 'md' } },
  },
});
