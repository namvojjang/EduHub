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
import { Link as RouterLink, useParams } from 'react-router-dom';
import { COURSE_STATUS_LABEL, SESSION_STATUS_LABEL } from '../constants/statusLabels';
import { useCourseDetail } from '../hooks/useCourseDetail';

/** "2026-12-01T09:00:00" → "2026-12-01 09:00" */
function formatDateTime(value?: string): string {
  return value ? value.replace('T', ' ').slice(0, 16) : '-';
}

/** 과정 상세 화면 (FR-02). 데이터는 useCourseDetail로만 가져온다. */
export function CourseDetailPage() {
  const { id } = useParams();
  const { data, loading, notFound, error } = useCourseDetail(Number(id));

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: 3 }}>
      <Button component={RouterLink} to="/" sx={{ mb: 2 }}>
        ← 목록으로
      </Button>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label="불러오는 중" />
        </Box>
      )}

      {notFound && <Alert severity="warning">과정을 찾을 수 없습니다.</Alert>}

      {error && <Alert severity="error">과정 정보를 불러오지 못했습니다. ({error.message})</Alert>}

      {data && (
        <>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h5" component="h1">
              {data.title}
            </Typography>
            <Chip label={data.category} size="small" />
            {data.status && (
              <Chip
                label={COURSE_STATUS_LABEL[data.status] ?? data.status}
                size="small"
                color={data.status === 'OPEN' ? 'success' : 'default'}
              />
            )}
          </Stack>
          {data.description && (
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {data.description}
            </Typography>
          )}

          <Typography variant="h6" component="h2" gutterBottom>
            회차
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small" aria-label="회차 목록">
              <TableHead>
                <TableRow>
                  <TableCell>일정</TableCell>
                  <TableCell>장소</TableCell>
                  <TableCell align="right">정원</TableCell>
                  <TableCell align="right">남은 자리</TableCell>
                  <TableCell>상태</TableCell>
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
                      <TableCell align="right">{session.remainingSeats}</TableCell>
                      <TableCell>
                        {session.status ? (SESSION_STATUS_LABEL[session.status] ?? session.status) : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
