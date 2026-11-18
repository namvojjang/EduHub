import { MantineProvider } from '@mantine/core';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { theme } from '../theme';

// Mantine 컴포넌트는 Provider가 필요하므로 화면 테스트는 이 함수로 렌더한다.
export function renderWithProviders(ui: ReactElement) {
  return render(<MantineProvider theme={theme}>{ui}</MantineProvider>);
}
