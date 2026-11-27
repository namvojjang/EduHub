import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

// Mantine 컴포넌트는 Provider가 필요하므로 화면 테스트는 이 함수로 렌더한다.
// 확인 창(modals)과 토스트(notifications)도 화면에서 쓰므로 함께 감싼다.
// 테마는 shell에 있으므로 테스트는 Mantine 기본 테마를 쓴다. 라우터가 필요하면 테스트가 MemoryRouter로 감싼다.
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
