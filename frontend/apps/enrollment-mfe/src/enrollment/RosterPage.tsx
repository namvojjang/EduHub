import type { ErrorResponse, RosterEntry, RosterResponse } from '@eduhub/api-client';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Container,
  Group,
  List,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconSearchOff } from '@tabler/icons-react';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { formatDateTime } from '../components/SessionCard';
import { ENROLLMENT_STATUS_COLOR, ENROLLMENT_STATUS_LABEL } from './enrollmentLabels';
import {
  SESSION_STATUS_COLOR,
  SESSION_STATUS_LABEL,
  failureReasonLabel,
  isSessionNotFound,
  rosterErrorMessage,
  rosterLoadErrorMessage,
} from './rosterLabels';
import { isValidSessionId, useRoster } from './useRoster';
import { useRosterActions } from './useRosterActions';

type CompletionResult = 'COMPLETED' | 'NOT_COMPLETED';

const RESULT_LABEL: Record<CompletionResult, string> = {
  COMPLETED: '수료',
  NOT_COMPLETED: '미수료',
};

interface ResultNotice {
  color: 'teal' | 'yellow';
  message: string;
  failures: { key: string; text: string }[];
}

/** 수료·미수료로 기록할 수 있는 행: 회차가 교육 완료이고 아직 확정 상태이며 사원 ID가 있다. */
function selectableId(entry: RosterEntry, sessionCompleted: boolean): number | null {
  return sessionCompleted && entry.status === 'CONFIRMED' && entry.employeeId !== undefined
    ? entry.employeeId
    : null;
}

function personLabel(roster: RosterResponse | null, employeeId?: number): string {
  const entry = roster?.confirmed?.find((e) => e.employeeId === employeeId);
  if (!entry) return `사원 #${employeeId ?? '?'}`;
  return `${entry.name ?? '(알 수 없음)'}(${entry.employeeNo ?? '-'})`;
}

// 관리자 회차 명단 (FR-08): 확정자·대기자 조회, 교육 완료, 수료·미수료 기록 (D-05, D-01).
export function RosterPage() {
  const sessionId = Number(useParams().sessionId);
  const validId = isValidSessionId(sessionId);
  const [reloadKey, setReloadKey] = useState(0);
  const { data: loaded, loading, error: loadError } = useRoster(sessionId, reloadKey);
  const actions = useRosterActions();

  const [selected, setSelected] = useState<number[]>([]);
  const [notice, setNotice] = useState<ResultNotice | null>(null);

  // 잘못된 회차 ID는 요청하지 않고 "없는 회차"로 본다.
  const error = validId ? loadError : null;
  const notFound = !validId || (error !== null && isSessionNotFound(error));
  const data = notFound ? null : loaded;
  const errorMessage = error !== null && !notFound ? rosterLoadErrorMessage(error) : null;
  // 재조회가 실패해 직전 표를 보여 주는 중이면 표가 최신이 아닐 수 있다.
  const stale = data !== null && error !== null;
  const confirmed = data?.confirmed ?? [];
  const waiting = data?.waiting ?? [];
  const backTo =
    data?.courseId !== undefined ? `/admin/courses/${data.courseId}` : '/admin/courses';

  const sessionCompleted = data?.sessionStatus === 'COMPLETED';
  // 요청 중, 재조회 중, 표가 최신이 아닐 때는 처리 버튼을 막는다(옛 화면으로 요청을 보내지 않게).
  const busy = actions.pending || loading || stale;

  // 확인 모달은 닫히는 동안에도 확인 버튼이 남아 더블클릭이 onConfirm을 두 번 부를 수 있다. ref로 막는다.
  const inFlight = useRef(false);
  // 모달은 열 때의 화면을 클로저로 잡고 있다. 확인 시점의 최신 상태는 ref로 본다.
  const latest = useRef({ busy, sessionCompleted });
  latest.current = { busy, sessionCompleted };
  // 떠날 때 이 화면이 연 확인 모달만 닫는다(closeAll은 다른 모달까지 닫는다).
  const modalId = useRef<string | null>(null);
  // 언마운트 뒤에 늦게 도착한 응답은 알림·상태 변경을 하지 않는다.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (modalId.current) modals.close(modalId.current);
    };
  }, []);

  const selectableIds = confirmed
    .map((e) => selectableId(e, sessionCompleted))
    .filter((id): id is number => id !== null);
  // 재조회로 행 상태가 바뀌어 더 이상 선택할 수 없는 사원은 선택에서 뺀다.
  const selectedIds = selected.filter((id) => selectableIds.includes(id));
  const allSelected = selectableIds.length > 0 && selectedIds.length === selectableIds.length;

  const reload = () => setReloadKey((k) => k + 1);

  const toggle = (id: number, checked: boolean) =>
    setSelected(checked ? [...selectedIds, id] : selectedIds.filter((x) => x !== id));
  const toggleAll = (checked: boolean) => setSelected(checked ? selectableIds : []);

  // 한 번에 하나만 실행한다.
  const guarded = async (job: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await job();
    } finally {
      inFlight.current = false;
    }
  };

  const handleError = (e: unknown) => {
    if (!mounted.current) return;
    const message = rosterErrorMessage(e);
    // 401은 인터셉터가 로그인 화면으로 보내므로 알림을 띄우지 않는다.
    if (message !== null) notifications.show({ color: 'red', message });
    // 화면이 서버 상태와 달라졌다는 뜻이면 다시 불러온다(이미 교육 완료, 교육 완료 전, 회차 없음).
    // SESSION_NOT_STARTED는 서버 상태가 그대로라 다시 불러오지 않는다.
    if (axios.isAxiosError<ErrorResponse>(e)) {
      const code = e.response?.data?.code;
      if (
        e.response?.status === 404 ||
        (e.response?.status === 409 &&
          (code === 'SESSION_ALREADY_COMPLETED' || code === 'SESSION_NOT_COMPLETED'))
      ) {
        reload();
      }
    }
  };

  const doCompleteSession = () =>
    guarded(async () => {
      try {
        await actions.completeSession(sessionId);
        if (!mounted.current) return;
        notifications.show({ color: 'teal', message: '교육 완료로 처리했습니다.' });
        reload();
      } catch (e) {
        handleError(e);
      }
    });

  const doRecord = (result: CompletionResult, ids: number[], roster: RosterResponse | null) =>
    guarded(async () => {
      try {
        const response = await actions.recordCompletions(sessionId, result, ids);
        if (!mounted.current) return;
        const processed = response.processed?.length ?? 0;
        const failed = response.failed ?? [];
        const label = RESULT_LABEL[result];
        setNotice(
          failed.length === 0
            ? { color: 'teal', message: `${processed}명을 ${label} 처리했습니다.`, failures: [] }
            : {
                color: 'yellow',
                message: `${processed}명을 ${label} 처리했습니다. ${failed.length}명은 처리하지 못했습니다.`,
                failures: failed.map((f, index) => ({
                  key: `${f.employeeId ?? 'x'}-${index}`,
                  text: `${personLabel(roster, f.employeeId)}: ${failureReasonLabel(f.code, f.reason)}`,
                })),
              },
        );
        setSelected([]);
        reload();
      } catch (e) {
        handleError(e);
      }
    });

  const confirmCompleteSession = () => {
    // 모달 하나당 한 번만 실행한다: 닫히는 애니메이션 동안 확인 버튼이 남아 다시 눌릴 수 있다.
    let confirmed = false;
    modalId.current = modals.openConfirmModal({
      title: '교육 완료 처리',
      children: (
        <Text size="sm">
          {`교육을 완료 처리할까요? 남은 대기 신청 ${waiting.length}건은 취소됩니다. 되돌릴 수 없습니다.`}
        </Text>
      ),
      labels: { confirm: '교육 완료 처리', cancel: '닫기' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        if (confirmed) return;
        confirmed = true;
        // 열어 둔 사이 화면이 바뀌었으면(이미 교육 완료, 재조회 중) 요청하지 않고 모달만 닫는다.
        if (latest.current.busy || latest.current.sessionCompleted) return;
        void doCompleteSession();
      },
    });
  };

  const confirmRecord = (result: CompletionResult) => {
    const ids = selectedIds;
    const roster = data;
    if (ids.length === 0) return;
    const label = RESULT_LABEL[result];
    let confirmedOnce = false;
    modalId.current = modals.openConfirmModal({
      title: `${label} 처리`,
      children: (
        <Text size="sm">{`선택한 ${ids.length}명을 ${label}로 기록합니다. 되돌릴 수 없습니다.`}</Text>
      ),
      labels: { confirm: `${label} 처리`, cancel: '닫기' },
      confirmProps: { color: result === 'COMPLETED' ? 'indigo' : 'orange' },
      onConfirm: () => {
        if (confirmedOnce) return;
        confirmedOnce = true;
        if (latest.current.busy || !latest.current.sessionCompleted) return;
        void doRecord(result, ids, roster);
      },
    });
  };

  return (
    <Container size="lg" p={0}>
      <Stack gap="md">
        <Anchor component={Link} to={backTo} size="sm">
          ← 과정 관리로
        </Anchor>

        {notice && (
          <Alert color={notice.color} withCloseButton onClose={() => setNotice(null)}>
            <Text size="sm">{notice.message}</Text>
            {notice.failures.length > 0 && (
              <List size="sm" mt="xs">
                {notice.failures.map((f) => (
                  <List.Item key={f.key}>{f.text}</List.Item>
                ))}
              </List>
            )}
          </Alert>
        )}

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
            <Text size="sm">{errorMessage}</Text>
            {stale && (
              <Text size="sm" mt="xs">
                표가 최신이 아닐 수 있습니다. 페이지를 새로고침해 주세요.
              </Text>
            )}
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

            {!sessionCompleted && (
              <Alert color="blue">
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm">교육 완료 처리 후 수료를 기록할 수 있습니다.</Text>
                  <Button
                    size="xs"
                    color="red"
                    variant="light"
                    disabled={busy}
                    onClick={confirmCompleteSession}
                  >
                    교육 완료 처리
                  </Button>
                </Group>
              </Alert>
            )}

            <Group justify="space-between">
              <Title order={3}>확정자</Title>
              <Group gap="xs">
                <Button
                  size="xs"
                  disabled={!sessionCompleted || selectedIds.length === 0 || busy}
                  onClick={() => confirmRecord('COMPLETED')}
                >
                  {`선택한 ${selectedIds.length}명 수료 처리`}
                </Button>
                <Button
                  size="xs"
                  color="orange"
                  variant="light"
                  disabled={!sessionCompleted || selectedIds.length === 0 || busy}
                  onClick={() => confirmRecord('NOT_COMPLETED')}
                >
                  {`선택한 ${selectedIds.length}명 미수료 처리`}
                </Button>
              </Group>
            </Group>
            {confirmed.length === 0 ? (
              <EmptyState title="확정된 신청자가 없습니다." />
            ) : (
              <Paper withBorder>
                <Table.ScrollContainer minWidth={600}>
                  <Table verticalSpacing="sm" aria-label="확정자 명단">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th w={40}>
                          <Checkbox
                            aria-label="전체 선택"
                            checked={allSelected}
                            indeterminate={selectedIds.length > 0 && !allSelected}
                            disabled={selectableIds.length === 0 || busy}
                            onChange={(e) => toggleAll(e.currentTarget.checked)}
                          />
                        </Table.Th>
                        <Table.Th>이름</Table.Th>
                        <Table.Th>사번</Table.Th>
                        <Table.Th>상태</Table.Th>
                        <Table.Th>확정일</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {confirmed.map((entry, index) => {
                        const id = selectableId(entry, sessionCompleted);
                        return (
                          <ConfirmedRow
                            key={entry.enrollmentId ?? index}
                            entry={entry}
                            selectable={id !== null && !busy}
                            checked={id !== null && selectedIds.includes(id)}
                            onToggle={(checked) => id !== null && toggle(id, checked)}
                          />
                        );
                      })}
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

interface ConfirmedRowProps {
  entry: RosterEntry;
  selectable: boolean;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}

function ConfirmedRow({ entry, selectable, checked, onToggle }: ConfirmedRowProps) {
  const status = entry.status ?? '';
  return (
    <Table.Tr>
      <Table.Td>
        <Checkbox
          aria-label={`${entry.name ? `${entry.name}(${entry.employeeNo ?? '-'})` : (entry.employeeNo ?? '(알 수 없음)')} 선택`}
          checked={checked}
          disabled={!selectable}
          onChange={(e) => onToggle(e.currentTarget.checked)}
        />
      </Table.Td>
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
