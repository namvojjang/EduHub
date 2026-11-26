import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test/render';
import { CourseCard } from './CourseCard';

describe('CourseCard', () => {
  it('분류, 제목, 상세로 가는 링크를 보여 준다', () => {
    renderWithProviders(
      <MemoryRouter>
        <CourseCard id={7} title="Java 기초" category="개발" />
      </MemoryRouter>,
    );

    expect(screen.getByText('개발')).toBeInTheDocument();
    expect(screen.getByText('Java 기초')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Java 기초 자세히 보기' })).toHaveAttribute('href', '/courses/7');
  });

  it('id가 없으면 링크 대신 비활성 버튼을 보여 준다', () => {
    renderWithProviders(
      <MemoryRouter>
        <CourseCard title="Java 기초" category="개발" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Java 기초 자세히 보기' })).toBeDisabled();
  });
});
