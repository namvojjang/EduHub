import type { RosterEntry } from '@eduhub/api-client';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Container,
  Group,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconSearchOff } from '@tabler/icons-react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { formatDateTime } from '../components/SessionCard';
import { ENROLLMENT_STATUS_COLOR, ENROLLMENT_STATUS_LABEL } from './enrollmentLabels';
import {
  SESSION_STATUS_COLOR,
  SESSION_STATUS_LABEL,
  isSessionNotFound,
  rosterLoadErrorMessage,
} from './rosterLabels';
import { isValidSessionId, useRoster } from './useRoster';

// 관리자 회차 명단 (FR-08): 확정자와 대기자. 읽기 전용.
export function RosterPage() {
  const sessionId = Number(useParams().sessionId);
  const validId = isValidSessionId(sessionId);
  const { data: loaded, loading, error: loadError } = useRoster(sessionId, 0);

  // 잘못된 회차 ID는 요청하지 않고 "없는 회차"로 본다.
  const error = validId ? loadError : null;
  const notFound = !validId || (error !== null && isSessionNotFound(error));
  const data = notFound ? null : loaded;
  const errorMessage = error !== null && !notFound ? rosterLoadErrorMessage(error) : null;
  const confirmed = data?.confirmed ?? [];
  const waiting = data?.waiting ?? [];
  const backTo =
    data?.courseId !== undefined ? `/admin/courses/${data.courseId}` : '/admin/courses';

  return (
    <Container size="lg" p={0}>
      <Stack gap="md">
        <Anchor component={Link} to={backTo} size="sm">
          ← 과정 관리로
        </Anchor>

        {validId && loading && !data && error === null && (
          <Stack role="status" aria-label="불러오는 중" aria-busy="true">
            <Skeleton height={60} />
            <Skeleton height={200} />
          </Stack>
        )}

        {notFound && (
          <EmptyState
            icon={<IconSearchOff size={28} />}
            title="회차를 찾을 수 없습니다."
            action={
              <Button component={Link} to="/admin/courses" variant="default">
                과정 관리로
              </Button>
            }
          />
        )}

        {errorMessage !== null && (
          <Alert color="red" title="명단을 불러오지 못했습니다.">
            {errorMessage}
          </Alert>
        )}

        {data && (
          <>
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Title order={2}>{`${data.courseTitle ?? '과정'} 명단`}</Title>
                <Text c="dimmed" size="sm">
                  {`${formatDateTime(data.sessionStartAt)} · 정원 ${data.capacity ?? '-'}명`}
                </Text>
              </Stack>
              {data.sessionStatus && (
                <Badge variant="light" color={SESSION_STATUS_COLOR[data.sessionStatus] ?? 'gray'}>
                  {SESSION_STATUS_LABEL[data.sessionStatus] ?? data.sessionStatus}
                </Badge>
              )}
            </Group>

            <Title order={3}>확정자</Title>
            {confirmed.length === 0 ? (
              <EmptyState title="확정된 신청자가 없습니다." />
            ) : (
              <Paper withBorder>
                <Table.ScrollContainer minWidth={560}>
                  <Table verticalSpacing="sm" aria-label="확정자 명단">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>이름</Table.Th>
                        <Table.Th>사번</Table.Th>
                        <Table.Th>상태</Table.Th>
                        <Table.Th>확정일</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {confirmed.map((entry, index) => (
                        <ConfirmedRow key={entry.enrollmentId ?? index} entry={entry} />
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Paper>
            )}

            <Title order={3}>대기자</Title>
            {waiting.length === 0 ? (
              <EmptyState title="대기자가 없습니다." />
            ) : (
              <Paper withBorder>
                <Table.ScrollContainer minWidth={560}>
                  <Table verticalSpacing="sm" aria-label="대기자 명단">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>순번</Table.Th>
                        <Table.Th>이름</Table.Th>
                        <Table.Th>사번</Table.Th>
                        <Table.Th>신청일</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {waiting.map((entry, index) => (
                        <Table.Tr key={entry.enrollmentId ?? index}>
                          <Table.Td>
                            {typeof entry.waitingNumber === 'number'
                              ? `대기 ${entry.waitingNumber}번`
                              : '대기'}
                          </Table.Td>
                          <Table.Td>{entry.name ?? '(알 수 없음)'}</Table.Td>
                          <Table.Td>{entry.employeeNo ?? '-'}</Table.Td>
                          <Table.Td>{formatDateTime(entry.appliedAt)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Paper>
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}

function ConfirmedRow({ entry }: { entry: RosterEntry }) {
  const status = entry.status ?? '';
  return (
    <Table.Tr>
      <Table.Td>{entry.name ?? '(알 수 없음)'}</Table.Td>
      <Table.Td>{entry.employeeNo ?? '-'}</Table.Td>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          <Badge color={ENROLLMENT_STATUS_COLOR[status] ?? 'gray'}>
            {ENROLLMENT_STATUS_LABEL[status] ?? (status || '-')}
          </Badge>
          {entry.promoted && (
            <Badge size="xs" variant="outline" color="teal">
              대기에서 확정
            </Badge>
          )}
        </Group>
      </Table.Td>
      <Table.Td>{formatDateTime(entry.confirmedAt)}</Table.Td>
    </Table.Tr>
  );
}
