import type { CourseRequest, SessionRequest, SessionResponse } from '@eduhub/api-client';
import { Alert, Badge, Box, Button, Container, Group, Loader, Paper, Table, Text, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getErrorMessage } from '../api/errorMessage';
import { CourseFormDialog } from '../components/CourseFormDialog';
import { SessionFormDialog } from '../components/SessionFormDialog';
import {
  COURSE_STATUS_COLOR,
  COURSE_STATUS_LABEL,
  SESSION_STATUS_COLOR,
  SESSION_STATUS_LABEL,
} from '../constants/statusLabels';
import { useCourseAdminActions } from '../hooks/useCourseAdminActions';
import { useCourseDetail } from '../hooks/useCourseDetail';

/** "2026-12-01T09:00:00" → "2026-12-01 09:00" */
function formatDateTime(value?: string): string {
  return value ? value.replace('T', ' ').slice(0, 16) : '-';
}

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

  // 대화상자의 초깃값은 열려 있는 동안 바뀌지 않아야 입력이 초기화되지 않는다.
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

  const handleCourseSubmit = async (body: CourseRequest) => {
    await actions.updateCourse(courseId, body);
    setCourseDialogOpen(false);
    reload();
  };

  const handleSessionSubmit = async (body: SessionRequest) => {
    if (sessionDialog?.mode === 'edit' && sessionDialog.session.id != null) {
      await actions.updateSession(sessionDialog.session.id, body);
    } else {
      await actions.createSession(courseId, body);
    }
    setSessionDialog(null);
    reload();
  };

  const handleCloseSession = async (session: SessionResponse) => {
    if (session.id == null) return;
    if (!window.confirm(`${formatDateTime(session.startAt)} 회차의 모집을 마감할까요?`)) return;
    setActionError(null);
    try {
      await actions.closeSession(session.id);
      reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  return (
    <Box bg="gray.0" mih="100vh" py="xl">
      <Container size="lg">
        <Button component={Link} to="/admin/courses" variant="subtle" mb="md">
          ← 과정 관리로
        </Button>

        {loading && (
          <Group justify="center" py="xl">
            <Loader aria-label="불러오는 중" />
          </Group>
        )}
        {notFound && (
          <Alert color="yellow" mb="md">
            과정을 찾을 수 없습니다.
          </Alert>
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
            <Paper withBorder p="md" mb="md">
              <Group justify="space-between" align="flex-start" mb="xs">
                <Group gap="sm">
                  <Title order={2}>{data.title}</Title>
                  <Badge variant="light" color="gray">
                    {data.category}
                  </Badge>
                  {data.status && (
                    <Badge variant="light" color={COURSE_STATUS_COLOR[data.status] ?? 'gray'}>
                      {COURSE_STATUS_LABEL[data.status] ?? data.status}
                    </Badge>
                  )}
                </Group>
                <Button variant="default" onClick={() => setCourseDialogOpen(true)}>
                  과정 정보 수정
                </Button>
              </Group>
              {data.description && (
                <Text c="dimmed" style={{ whiteSpace: 'pre-line' }}>
                  {data.description}
                </Text>
              )}
            </Paper>

            <Paper withBorder>
              <Group justify="space-between" p="md" pb="xs">
                <Title order={3}>회차</Title>
                {/* 종료된 과정에는 회차를 추가할 수 없다 (D-02). */}
                <Button disabled={!isOpen} onClick={() => setSessionDialog({ mode: 'create' })}>
                  회차 추가
                </Button>
              </Group>
              <Table.ScrollContainer minWidth={600}>
                <Table verticalSpacing="sm" aria-label="회차 관리 목록">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>일정</Table.Th>
                      <Table.Th>장소</Table.Th>
                      <Table.Th ta="right">정원</Table.Th>
                      <Table.Th>상태</Table.Th>
                      <Table.Th ta="right">관리</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {sessions.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={5}>
                          <Text c="dimmed" ta="center">
                            등록된 회차가 없습니다.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      sessions.map((session) => (
                        <Table.Tr key={session.id}>
                          <Table.Td>{formatDateTime(session.startAt)}</Table.Td>
                          <Table.Td>{session.place}</Table.Td>
                          <Table.Td ta="right">{session.capacity}</Table.Td>
                          <Table.Td>
                            {session.status ? (
                              <Badge variant="light" color={SESSION_STATUS_COLOR[session.status] ?? 'gray'}>
                                {SESSION_STATUS_LABEL[session.status] ?? session.status}
                              </Badge>
                            ) : (
                              '-'
                            )}
                          </Table.Td>
                          <Table.Td>
                            {/* 모집 중인 회차만 수정·마감할 수 있다 (D-01). */}
                            {session.status === 'RECRUITING' && (
                              <Group gap="xs" justify="flex-end" wrap="nowrap">
                                <Button
                                  size="xs"
                                  variant="light"
                                  onClick={() => setSessionDialog({ mode: 'edit', session })}
                                >
                                  수정
                                </Button>
                                <Button
                                  size="xs"
                                  variant="light"
                                  color="red"
                                  disabled={actions.pending}
                                  onClick={() => handleCloseSession(session)}
                                >
                                  모집 마감
                                </Button>
                              </Group>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>
          </>
        )}
      </Container>

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
    </Box>
  );
}
