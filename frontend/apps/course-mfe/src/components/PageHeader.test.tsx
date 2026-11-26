import { Button } from '@mantine/core';
import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test/render';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('브레드크럼 링크, 제목, 설명, 동작 버튼을 보여 준다', () => {
    renderWithProviders(
      <MemoryRouter>
        <PageHeader
          breadcrumbs={[{ label: '교육과정', to: '/courses' }, { label: '상세' }]}
          title="과정 상세"
          description="설명 문구"
          actions={<Button>신청</Button>}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: '교육과정' })).toHaveAttribute('href', '/courses');
    expect(screen.queryByRole('link', { name: '상세' })).toBeNull();
    expect(screen.getByRole('heading', { name: '과정 상세' })).toBeInTheDocument();
    expect(screen.getByText('설명 문구')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '신청' })).toBeInTheDocument();
  });
});
