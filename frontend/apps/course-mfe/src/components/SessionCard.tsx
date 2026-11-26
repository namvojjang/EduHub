import { Badge, Card, Group, Progress, Stack, Text } from '@mantine/core';
import { IconMapPin } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { SESSION_STATUS_COLOR, SESSION_STATUS_LABEL } from '../constants/statusLabels';

interface SessionCardProps {
  startAt?: string;
  place?: string;
  capacity?: number; // 생성된 API 타입이 모두 선택값이라 그대로 받는다
  remainingSeats?: number;
  status?: string;
  /** 카드 오른쪽 아래에 그릴 동작(신청 버튼 등). 이 컴포넌트는 내용을 모른다. */
  action?: ReactNode;
}

/** "2026-12-01T09:00:00" → "2026-12-01 09:00" */
export function formatDateTime(value?: string): string {
  return value ? value.replace('T', ' ').slice(0, 16) : '-';
}

const NEARLY_FULL_RATIO = 0.2; // 남은/정원이 이 값 이하면 마감 임박

// 회차 한 장: 일정, 장소, 상태, 남은 자리(Progress). 신청 버튼 등은 action 슬롯에 페이지가 끼운다.
export function SessionCard({
  startAt,
  place,
  capacity,
  remainingSeats,
  status,
  action,
}: SessionCardProps) {
  const known = capacity !== undefined && capacity > 0 && remainingSeats !== undefined;
  const full = remainingSeats === 0;
  // 마감 임박은 모집 중인 회차에만 붙인다
  const nearlyFull =
    status === 'RECRUITING' && known && !full && remainingSeats / capacity <= NEARLY_FULL_RATIO;
  const color = full ? 'red' : nearlyFull ? 'orange' : 'teal';
  // 진행 막대는 확정된 비율(정원 - 남은) / 정원
  const filled = known
    ? Math.min(100, Math.max(0, ((capacity - remainingSeats) / capacity) * 100))
    : 0;

  return (
    <Card withBorder padding="md">
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
        <Stack gap={4}>
          <Text fw={700} size="xl">
            {formatDateTime(startAt)}
          </Text>
          <Group gap={4} c="dimmed" wrap="nowrap">
            <IconMapPin size={16} aria-hidden />
            <Text size="sm" c="dimmed">
              {place ?? '-'}
            </Text>
          </Group>
        </Stack>
        <Group gap="xs">
          {nearlyFull && (
            <Badge variant="light" color="orange">
              마감 임박
            </Badge>
          )}
          {status && (
            <Badge variant="light" color={SESSION_STATUS_COLOR[status] ?? 'gray'}>
              {SESSION_STATUS_LABEL[status] ?? status}
            </Badge>
          )}
        </Group>
      </Group>

      <Group justify="space-between" align="flex-end" wrap="wrap" gap="md" mt="md">
        <Stack gap={6} style={{ flex: 1, minWidth: 200 }}>
          <Progress value={filled} color={color} size="sm" aria-label="신청 현황" />
          <Text size="sm">
            {'남은 자리 '}
            <Text span fw={600} c={full ? 'red' : undefined}>
              {full ? '0 (정원 마감)' : (remainingSeats ?? '-')}
            </Text>
            {` / ${capacity ?? '-'}`}
          </Text>
        </Stack>
        {action}
      </Group>
    </Card>
  );
}
