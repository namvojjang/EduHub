import type { CourseRequest, SessionRequest, SessionResponse } from '@eduhub/api-client';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { getErrorMessage } from '../api/errorMessage';
import { CourseFormDialog } from '../components/CourseFormDialog';
import { SessionFormDialog } from '../components/SessionFormDialog';
import { COURSE_STATUS_LABEL, SESSION_STATUS_LABEL } from '../constants/statusLabels';
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
    <Box sx={{ maxWidth: 1040, mx: 'auto', p: 3 }}>
      <Button component={RouterLink} to="/admin/courses" sx={{ mb: 2 }}>
        ← 과정 관리로
      </Button>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label="불러오는 중" />
        </Box>
      )}
      {notFound && <Alert severity="warning">과정을 찾을 수 없습니다.</Alert>}
      {error && <Alert severity="error">과정 정보를 불러오지 못했습니다. ({error.message})</Alert>}
      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {data && (
        <>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h5" component="h1">
                {data.title}
              </Typography>
              <Chip label={data.category} size="small" />
              {data.status && (
                <Chip
                  label={COURSE_STATUS_LABEL[data.status] ?? data.status}
                  size="small"
                  color={isOpen ? 'success' : 'default'}
                />
              )}
            </Stack>
            <Button onClick={() => setCourseDialogOpen(true)}>과정 정보 수정</Button>
          </Stack>
          {data.description && (
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {data.description}
            </Typography>
          )}

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6" component="h2">
              회차
            </Typography>
            {/* 종료된 과정에는 회차를 추가할 수 없다 (D-02). */}
            <Button variant="contained" disabled={!isOpen} onClick={() => setSessionDialog({ mode: 'create' })}>
              회차 추가
            </Button>
          </Stack>
          <TableContainer component={Paper}>
            <Table size="small" aria-label="회차 관리 목록">
              <TableHead>
                <TableRow>
                  <TableCell>일정</TableCell>
                  <TableCell>장소</TableCell>
                  <TableCell align="right">정원</TableCell>
                  <TableCell>상태</TableCell>
                  <TableCell align="right">관리</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data.sessions ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      등록된 회차가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  (data.sessions ?? []).map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>{formatDateTime(session.startAt)}</TableCell>
                      <TableCell>{session.place}</TableCell>
                      <TableCell align="right">{session.capacity}</TableCell>
                      <TableCell>
                        {session.status ? (SESSION_STATUS_LABEL[session.status] ?? session.status) : '-'}
                      </TableCell>
                      <TableCell align="right">
                        {/* 모집 중인 회차만 수정·마감할 수 있다 (D-01). */}
                        {session.status === 'RECRUITING' && (
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button size="small" onClick={() => setSessionDialog({ mode: 'edit', session })}>
                              수정
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              disabled={actions.pending}
                              onClick={() => handleCloseSession(session)}
                            >
                              모집 마감
                            </Button>
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
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
    </Box>
  );
}
