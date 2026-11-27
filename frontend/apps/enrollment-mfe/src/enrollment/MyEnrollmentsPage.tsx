import type { MyEnrollmentResponse } from '@eduhub/api-client';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Container,
  Group,
  Paper,
  SegmentedControl,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../api/errorMessage';
import { EmptyState } from '../components/EmptyState';
import { formatDateTime } from '../components/SessionCard';
import {
  ENROLLMENT_STATUS_COLOR,
  ENROLLMENT_STATUS_LABEL,
  enrollmentErrorMessage,
} from './enrollmentLabels';
import { useEnrollmentActions } from './useEnrollmentActions';
import { useMyEnrollments } from './useMyEnrollments';
import type { MyEnrollmentStatus } from './useMyEnrollments';

const FILTERS: { value: string; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'CONFIRMED', label: '확정' },
  { value: 'WAITING', label: '대기' },
  { value: 'CANCELLED', label: '취소' },
  { value: 'COMPLETED', label: '수료' },
  { value: 'NOT_COMPLETED', label: '미수료' },
];

function statusText(e: MyEnrollmentResponse): string {
  const label = ENROLLMENT_STATUS_LABEL[e.status ?? ''] ?? e.status ?? '-';
  if (e.status === 'WAITING' && typeof e.waitingNumber === 'number') {
    return `${label} ${e.waitingNumber}번`;
  }
  return label;
}

// 내 신청 내역: 상태 필터, 표, 취소 (FR-06, FR-07).
export function MyEnrollmentsPage() {
  const [filter, setFilter] = useState('ALL');
  const [reloadKey, setReloadKey] = useState(0);
  const status = filter === 'ALL' ? undefined : (filter as MyEnrollmentStatus);
  const { data, loading, error } = useMyEnrollments(status, reloadKey);
  const { pending, cancel } = useEnrollmentActions();

  // 확인 모달은 닫히는 동안에도 확인 버튼이 남아 더블클릭이 onConfirm을 두 번 부를 수 있다. ref로 막는다.
  const inFlight = useRef(false);
  // 떠날 때 이 화면이 연 확인 모달만 닫는다(closeAll은 다른 모달까지 닫는다).
  const modalId = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (modalId.current) modals.close(modalId.current);
    },
    [],
  );

  const doCancel = async (id: number) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await cancel(id);
      notifications.show({ color: 'teal', message: '신청을 취소했습니다.' });
      setReloadKey((k) => k + 1);
    } catch (e) {
      const message = enrollmentErrorMessage(e);
      // 401은 인터셉터가 로그인 화면으로 보내므로 알림을 띄우지 않는다.
      if (message !== null) notifications.show({ color: 'red', message });
      // 409·404는 화면이 서버 상태와 달라졌다는 뜻(이미 취소·승급·시작·삭제)이라 다시 불러온다.
      if (axios.isAxiosError(e) && (e.response?.status === 409 || e.response?.status === 404)) {
        setReloadKey((k) => k + 1);
      }
    } finally {
      inFlight.current = false;
    }
  };

  const confirmCancel = (enrollment: MyEnrollmentResponse) => {
    const id = enrollment.enrollmentId;
    if (id === undefined) return;
    // 모달 하나당 한 번만 실행한다: 닫히는 애니메이션 동안 확인 버튼이 남아 요청이 끝난 뒤에도 다시 눌릴 수 있다.
    let confirmed = false;
    modalId.current = modals.openConfirmModal({
      title: '신청 취소',
      children: (
        <Text size="sm">
          {enrollment.status === 'CONFIRMED'
            ? '신청을 취소할까요? 대기 1순위가 있으면 자동으로 확정됩니다.'
            : '신청을 취소할까요?'}
        </Text>
      ),
      labels: { confirm: '신청 취소', cancel: '닫기' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        if (confirmed) return;
        confirmed = true;
        void doCancel(id);
      },
    });
  };

  const rows = data ?? [];

  return (
    <Container size="xl" p={0}>
      <Stack gap="md">
        <Title order={2}>내 신청 내역</Title>
        <SegmentedControl
          data={FILTERS}
          value={filter}
          onChange={setFilter}
          aria-label="상태 필터"
        />

        {error !== null && (
          <Alert color="red" title="내 신청 내역을 불러오지 못했습니다.">
            {getErrorMessage(error)}
          </Alert>
        )}

        {error === null && loading && data === null && (
          <Stack role="status" aria-label="불러오는 중" aria-busy="true">
            <Skeleton height={200} />
          </Stack>
        )}

        {error === null && data !== null && rows.length === 0 && (
          <EmptyState
            title="신청 내역이 없습니다."
            action={
              <Button component={Link} to="/" variant="light">
                교육과정 보기
              </Button>
            }
          />
        )}

        {error === null && rows.length > 0 && (
          <Paper withBorder>
            <Table.ScrollContainer minWidth={720}>
              <Table verticalSpacing="sm" aria-label="내 신청 내역">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>과정</Table.Th>
                    <Table.Th>시작 일시</Table.Th>
                    <Table.Th>장소</Table.Th>
                    <Table.Th>상태</Table.Th>
                    <Table.Th>신청일</Table.Th>
                    <Table.Th>동작</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((e, index) => (
                    <Table.Tr key={e.enrollmentId ?? index}>
                      <Table.Td>
                        <Anchor component={Link} to={`/courses/${e.courseId}`}>
                          {e.courseTitle}
                        </Anchor>
                      </Table.Td>
                      <Table.Td>{formatDateTime(e.sessionStartAt)}</Table.Td>
                      <Table.Td>{e.place ?? '-'}</Table.Td>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <Badge color={ENROLLMENT_STATUS_COLOR[e.status ?? ''] ?? 'gray'}>
                            {statusText(e)}
                          </Badge>
                          {e.status === 'CONFIRMED' && e.promoted && (
                            <Badge size="xs" variant="outline" color="teal">
                              대기에서 확정
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>{formatDateTime(e.appliedAt)}</Table.Td>
                      <Table.Td>
                        {e.enrollmentId !== undefined && (e.status === 'CONFIRMED' || e.status === 'WAITING') && (
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            disabled={pending}
                            aria-label={e.courseTitle ? `${e.courseTitle} 신청 취소` : '신청 취소'}
                            onClick={() => confirmCancel(e)}
                          >
                            취소
                          </Button>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
