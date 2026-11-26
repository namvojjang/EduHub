import { Button } from '@mantine/core';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test/render';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('제목, 설명, 동작 버튼을 보여 준다', () => {
    renderWithProviders(
      <EmptyState title="과정이 없습니다" description="조건을 바꿔 보세요" action={<Button>초기화</Button>} />,
    );

    expect(screen.getByText('과정이 없습니다')).toBeInTheDocument();
    expect(screen.getByText('조건을 바꿔 보세요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '초기화' })).toBeInTheDocument();
  });
});
