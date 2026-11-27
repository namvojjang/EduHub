import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { theme } from '../theme';

// Mantine 컴포넌트는 Provider가 필요하므로 화면 테스트는 이 함수로 렌더한다.
// 확인 창(modals)과 토스트(notifications)도 화면에서 쓰므로 함께 감싼다.
export function renderWithProviders(ui: ReactElement) {
  return render(
    <MantineProvider theme={theme}>
      <ModalsProvider>
        <Notifications />
        {ui}
      </ModalsProvider>
    </MantineProvider>,
  );
}

type Route = string | { pathname: string; state?: unknown };

// 로그인 상태(AuthProvider)와 라우터(MemoryRouter)가 필요한 화면 테스트용.
// 로그인 상태는 렌더 전에 tokenStore.save(...)로 미리 넣고, authApi는 vi.mock('@eduhub/http')로 대체한다.
export function renderWithAuth(ui: ReactElement, options: { route?: Route } = {}) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[options.route ?? '/']}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>,
  );
}
