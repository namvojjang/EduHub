import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test/render';
import { SessionCard } from './SessionCard';

type Status = 'RECRUITING' | 'CLOSED';

function renderCard(capacity?: number, remainingSeats?: number, status: Status = 'RECRUITING') {
  return renderWithProviders(
    <SessionCard
      startAt="2026-12-01T09:00:00"
      place="본사 3층"
      capacity={capacity}
      remainingSeats={remainingSeats}
      status={status}
    />,
  );
}

describe('SessionCard', () => {
  it('일정·장소·상태·남은 자리를 보여 주고 action이 없으면 버튼도 없다', () => {
    renderCard(20, 10);

    expect(screen.getByText('2026-12-01 09:00')).toBeInTheDocument();
    expect(screen.getByText('본사 3층')).toBeInTheDocument();
    expect(screen.getByText('모집 중')).toBeInTheDocument();
    expect(screen.getByText(/^남은 자리/)).toHaveTextContent('남은 자리 10 / 20');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('수강 신청 화면 준비 중')).not.toBeInTheDocument();
  });

  it('action으로 받은 내용을 그 자리에 그린다', () => {
    renderWithProviders(<SessionCard action={<button type="button">신청하기</button>} />);

    expect(screen.getByRole('button', { name: '신청하기' })).toBeInTheDocument();
  });

  it('정원·남은 자리가 없어도 깨지지 않는다', () => {
    renderWithProviders(<SessionCard />);

    expect(screen.getByText(/^남은 자리/)).toHaveTextContent('남은 자리 - / -');
    expect(screen.queryByText('마감 임박')).not.toBeInTheDocument();
  });

  it('정원이 0이면 마감 임박 없이 안전하게 보여 준다', () => {
    renderCard(0, 0);

    expect(screen.getByText('0 (정원 마감)')).toBeInTheDocument();
    expect(screen.queryByText('마감 임박')).not.toBeInTheDocument();
  });

  it('정원이 없고 남은 자리만 있어도 마감 임박을 띄우지 않는다', () => {
    renderCard(undefined, 3);

    expect(screen.getByText(/^남은 자리/)).toHaveTextContent('남은 자리 3 / -');
    expect(screen.queryByText('마감 임박')).not.toBeInTheDocument();
  });

  it('4/20은 마감 임박, 5/20은 아니다', () => {
    const { unmount } = renderCard(20, 4);
    expect(screen.getByText('마감 임박')).toBeInTheDocument();
    unmount();

    renderCard(20, 5);
    expect(screen.queryByText('마감 임박')).not.toBeInTheDocument();
  });

  it('모집 중이 아니면(CLOSED) 마감 임박 비율이어도 Badge를 띄우지 않는다', () => {
    renderCard(20, 2, 'CLOSED');

    expect(screen.queryByText('마감 임박')).not.toBeInTheDocument();
  });

  it('Progress는 확정 비율(정원 - 남은)/정원을 값으로 가진다', () => {
    renderCard(20, 5);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
  });
});
