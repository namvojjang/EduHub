import type { AdminCourseSummaryResponse, CourseRequest } from '@eduhub/api-client';
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
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { FormEvent, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { getErrorMessage } from '../api/errorMessage';
import { CourseFormDialog } from '../components/CourseFormDialog';
import { COURSE_STATUS_LABEL } from '../constants/statusLabels';
import { useAdminCourses } from '../hooks/useAdminCourses';
import { useCourseAdminActions } from '../hooks/useCourseAdminActions';

/**
 * 관리자 과정 관리 화면 (FR-03): 등록·종료.
 * 과정 정보 수정과 회차 관리는 과정별 관리 화면에서 한다 (목록에는 설명이 없어 여기서 고치면 설명이 지워진다).
 */
export function AdminCourseListPage() {
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [reloadKey, setReloadKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, loading, error } = useAdminCourses({ keyword, page, size, reloadKey });
  const actions = useCourseAdminActions();

  const reload = () => setReloadKey((k) => k + 1);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setKeyword(keywordInput.trim());
    setPage(0);
  };

  const handleCreate = async (body: CourseRequest) => {
    await actions.createCourse(body);
    setCreateOpen(false);
    reload();
  };

  const handleClose = async (course: AdminCourseSummaryResponse) => {
    if (course.id == null) return;
    if (!window.confirm(`'${course.title}' 과정을 종료할까요? 목록에서 사라지고 새 회차를 열 수 없습니다.`)) return;
    setActionError(null);
    try {
      await actions.closeCourse(course.id);
      reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  const courses = data?.content ?? [];

  return (
    <Box sx={{ maxWidth: 1040, mx: 'auto', p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" component="h1">
          과정 관리
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button component={RouterLink} to="/">
            임직원 화면
          </Button>
          <Button variant="contained" onClick={() => setCreateOpen(true)}>
            과정 등록
          </Button>
        </Stack>
      </Stack>

      <Stack component="form" direction="row" spacing={2} sx={{ mb: 2 }} onSubmit={handleSearch}>
        <TextField
          label="과정명 검색"
          size="small"
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          sx={{ flex: 1 }}
        />
        <Button type="submit" variant="outlined">
          검색
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          과정 목록을 불러오지 못했습니다. ({error.message})
        </Alert>
      )}
      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table size="small" aria-label="관리자 과정 목록">
          <TableHead>
            <TableRow>
              <TableCell>과정명</TableCell>
              <TableCell sx={{ width: 120 }}>분류</TableCell>
              <TableCell sx={{ width: 100 }}>상태</TableCell>
              <TableCell sx={{ width: 260 }} align="right">
                관리
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <CircularProgress size={28} aria-label="불러오는 중" />
                </TableCell>
              </TableRow>
            ) : courses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  {error ? '-' : '등록된 과정이 없습니다.'}
                </TableCell>
              </TableRow>
            ) : (
              courses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell>{course.title}</TableCell>
                  <TableCell>{course.category}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={course.status ? (COURSE_STATUS_LABEL[course.status] ?? course.status) : '-'}
                      color={course.status === 'OPEN' ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" component={RouterLink} to={`/admin/courses/${course.id}`}>
                        관리
                      </Button>
                      {course.status === 'OPEN' && (
                        <Button
                          size="small"
                          color="error"
                          disabled={actions.pending}
                          onClick={() => handleClose(course)}
                        >
                          종료
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={data?.totalElements ?? 0}
          page={page}
          rowsPerPage={size}
          rowsPerPageOptions={[10, 20, 50]}
          onPageChange={(_, next) => setPage(next)}
          onRowsPerPageChange={(e) => {
            setSize(Number(e.target.value));
            setPage(0);
          }}
          labelRowsPerPage="페이지당"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} / 전체 ${count}`}
        />
      </TableContainer>

      <CourseFormDialog open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={handleCreate} />
    </Box>
  );
}
