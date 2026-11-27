import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

// Mantine 컴포넌트는 Provider가 필요하므로 화면 테스트는 이 함수로 렌더한다.
// 확인 창(modals)과 토스트(notifications)도 화면에서 쓰므로 함께 감싼다.
// 테마는 shell 소관이라 가져오지 않는다(remote끼리·shell과 코드를 공유하지 않는다).
export function renderWithProviders(ui: ReactElement) {
  return render(
    <MantineProvider>
      <ModalsProvider>
        <Notifications />
        {ui}
      </ModalsProvider>
    </MantineProvider>,
  );
}

type Route = string | { pathname: string; state?: unknown };

// 라우터(MemoryRouter)가 필요한 화면 테스트용. remote는 로그인 상태를 모른다(로그인 보장은 shell의 RequireAuth, D-06).
export function renderWithRouter(ui: ReactElement, options: { route?: Route } = {}) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[options.route ?? '/']}>{ui}</MemoryRouter>,
  );
}
