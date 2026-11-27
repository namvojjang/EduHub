import type { CourseRequest, SessionRequest, SessionResponse } from '@eduhub/api-client';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Container,
  Group,
  Menu,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconCalendarOff, IconDots, IconPencil, IconSearchOff } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getErrorMessage } from '@eduhub/http';
import { CourseFormDialog } from '../components/CourseFormDialog';
import { EmptyState, formatDateTime } from '@eduhub/ui';
import { SessionFormDialog } from '../components/SessionFormDialog';
import { categoryColor } from '../constants/categories';
import {
  COURSE_STATUS_COLOR,
  COURSE_STATUS_LABEL,
  SESSION_STATUS_COLOR,
  SESSION_STATUS_LABEL,
} from '../constants/statusLabels';
import { useCourseAdminActions } from '../hooks/useCourseAdminActions';
import { useCourseDetail } from '../hooks/useCourseDetail';

type SessionDialog = { mode: 'create' } | { mode: 'edit'; session: SessionResponse } | null;

/** 과정별 관리 화면 (FR-03): 과정 정보 수정, 회차 추가·수정·모집 마감. */
export function AdminCoursePage() {
  const courseId = Number(useParams().id);
  const [reloadKey, setReloadKey] = useState(0);
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [sessionDialog, setSessionDialog] = useState<SessionDialog>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, loading, notFound, error } = useCourseDetail(courseId, reloadKey);
  const actions = useCourseAdminActions();
  const reload = () => setReloadKey((k) => k + 1);

  // 서랍의 초깃값은 열려 있는 동안 바뀌지 않아야 입력이 초기화되지 않는다.
  const courseInitial = useMemo<CourseRequest | undefined>(
    () =>
      data
        ? { title: data.title ?? '', category: data.category ?? '', description: data.description }
        : undefined,
    [data],
  );
  const sessionInitial = useMemo<SessionRequest | undefined>(
    () =>
      sessionDialog?.mode === 'edit'
        ? {
            startAt: sessionDialog.session.startAt ?? '',
            place: sessionDialog.session.place ?? '',
            capacity: sessionDialog.session.capacity ?? 1,
          }
        : undefined,
    [sessionDialog],
  );

  const isOpen = data?.status === 'OPEN';
  const sessions = data?.sessions ?? [];
  const color = categoryColor(data?.category);

  const handleCourseSubmit = async (body: CourseRequest) => {
    await actions.updateCourse(courseId, body);
    setCourseDialogOpen(false);
    notifications.show({ color: 'teal', message: '과정 정보를 저장했습니다.' });
    reload();
  };

  const handleSessionSubmit = async (body: SessionRequest) => {
    if (sessionDialog?.mode === 'edit' && sessionDialog.session.id != null) {
      await actions.updateSession(sessionDialog.session.id, body);
      notifications.show({ color: 'teal', message: '회차를 저장했습니다.' });
    } else {
      await actions.createSession(courseId, body);
      notifications.show({ color: 'teal', message: '회차를 추가했습니다.' });
    }
    setSessionDialog(null);
    reload();
  };

  const closeSession = async (session: SessionResponse) => {
    if (session.id == null) return;
    setActionError(null);
    try {
      await actions.closeSession(session.id);
      notifications.show({ color: 'teal', message: '회차 모집을 마감했습니다.' });
      reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  // window.confirm 대신 확인 창을 띄우고, 확인하면 마감한다.
  const confirmCloseSession = (session: SessionResponse) => {
    modals.openConfirmModal({
      title: '모집 마감',
      children: (
        <Text size="sm">{`${formatDateTime(session.startAt)} 회차의 모집을 마감할까요?`}</Text>
      ),
      labels: { confirm: '모집 마감', cancel: '취소' },
      confirmProps: { color: 'red' },
      onConfirm: () => closeSession(session),
    });
  };

  return (
    <Container size="lg" p={0}>
      <Breadcrumbs mb="md">
        <Anchor component={Link} to="/admin/courses" size="sm">
          과정 관리
        </Anchor>
        <Text size="sm" c="dimmed" aria-current="page">
          {data?.title ?? '과정 정보'}
        </Text>
      </Breadcrumbs>

      {loading && !data && (
        <Stack role="status" aria-label="불러오는 중" aria-busy="true" gap="md">
          <Skeleton height={160} radius="lg" />
          <Skeleton height={200} radius="lg" />
        </Stack>
      )}
      {notFound && (
        <EmptyState
          icon={<IconSearchOff size={28} />}
          title="과정을 찾을 수 없습니다."
          action={
            <Button component={Link} to="/admin/courses" variant="default">
              과정 관리로
            </Button>
          }
        />
      )}
      {error && (
        <Alert color="red" mb="md">
          과정 정보를 불러오지 못했습니다. ({error.message})
        </Alert>
      )}
      {actionError && (
        <Alert color="red" mb="md" withCloseButton onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {data && (
        <>
          <Card withBorder padding="lg" mb="lg">
            <Card.Section h={6} bg={`${color}.6`} />
            <Group justify="space-between" align="flex-start" wrap="nowrap" mt="md">
              <Stack gap="sm">
                <Group gap="xs">
                  <Badge variant="light" color={color}>
                    {data.category}
                  </Badge>
                  {data.status && (
                    <Badge variant="light" color={COURSE_STATUS_COLOR[data.status] ?? 'gray'}>
                      {COURSE_STATUS_LABEL[data.status] ?? data.status}
                    </Badge>
                  )}
                </Group>
                <Title order={2}>{data.title}</Title>
                {data.description && (
                  <Text c="dimmed" style={{ whiteSpace: 'pre-line' }}>
                    {data.description}
                  </Text>
                )}
              </Stack>
              <Button
                variant="default"
                leftSection={<IconPencil size={16} />}
                onClick={() => setCourseDialogOpen(true)}
              >
                과정 정보 수정
              </Button>
            </Group>
          </Card>

          <Card withBorder padding={0}>
            <Group justify="space-between" p="md" pb="xs">
              <Title order={3}>회차</Title>
              {/* 종료된 과정에는 회차를 추가할 수 없다 (D-02). */}
              <Group gap="sm">
                {!isOpen && (
                  <Text size="sm" c="dimmed">
                    종료된 과정에는 회차를 추가할 수 없습니다.
                  </Text>
                )}
                <Button disabled={!isOpen} onClick={() => setSessionDialog({ mode: 'create' })}>
                  회차 추가
                </Button>
              </Group>
            </Group>
            {sessions.length === 0 ? (
              <EmptyState icon={<IconCalendarOff size={28} />} title="등록된 회차가 없습니다." />
            ) : (
              <Table.ScrollContainer minWidth={640}>
                <Table verticalSpacing="sm" aria-label="회차 관리 목록">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>일정</Table.Th>
                      <Table.Th>장소</Table.Th>
                      <Table.Th ta="right">정원</Table.Th>
                      <Table.Th ta="right">남은 자리</Table.Th>
                      <Table.Th>상태</Table.Th>
                      <Table.Th w={80}>명단</Table.Th>
                      <Table.Th w={60} ta="right">
                        관리
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {sessions.map((session) => (
                      <Table.Tr key={session.id}>
                        <Table.Td>{formatDateTime(session.startAt)}</Table.Td>
                        <Table.Td>{session.place}</Table.Td>
                        <Table.Td ta="right">{session.capacity}</Table.Td>
                        <Table.Td ta="right">{session.remainingSeats ?? '-'}</Table.Td>
                        <Table.Td>
                          {session.status ? (
                            <Badge
                              variant="light"
                              color={SESSION_STATUS_COLOR[session.status] ?? 'gray'}
                            >
                              {SESSION_STATUS_LABEL[session.status] ?? session.status}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </Table.Td>
                        <Table.Td>
                          {session.id != null && (
                            <Anchor
                              component={Link}
                              to={`/admin/sessions/${session.id}/roster`}
                              size="sm"
                              aria-label={`${formatDateTime(session.startAt)} 회차 명단`}
                            >
                              명단
                            </Anchor>
                          )}
                        </Table.Td>
                        <Table.Td ta="right">
                          {/* 모집 중인 회차만 수정·마감할 수 있다 (D-01). 아니면 메뉴 버튼을 숨긴다. */}
                          {session.status === 'RECRUITING' && (
                            <Menu position="bottom-end" withinPortal>
                              <Menu.Target>
                                <ActionIcon
                                  variant="subtle"
                                  color="gray"
                                  aria-label={`${formatDateTime(session.startAt)} 회차 작업`}
                                >
                                  <IconDots size={18} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Item
                                  onClick={() => setSessionDialog({ mode: 'edit', session })}
                                >
                                  수정
                                </Menu.Item>
                                <Menu.Item
                                  color="red"
                                  disabled={actions.pending}
                                  onClick={() => confirmCloseSession(session)}
                                >
                                  모집 마감
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Card>
        </>
      )}

      <CourseFormDialog
        open={courseDialogOpen}
        initial={courseInitial}
        onClose={() => setCourseDialogOpen(false)}
        onSubmit={handleCourseSubmit}
      />
      <SessionFormDialog
        open={sessionDialog !== null}
        initial={sessionInitial}
        onClose={() => setSessionDialog(null)}
        onSubmit={handleSessionSubmit}
      />
    </Container>
  );
}
