import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import { CATEGORIES } from '../constants/categories';
import { useCourses } from '../hooks/useCourses';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

/** 과정 목록 화면 (FR-01). 데이터는 useCourses로만 가져온다. */
export function CourseListPage() {
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);

  const { data, loading, error } = useCourses({ keyword, category, page, size });

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setKeyword(keywordInput.trim());
    setPage(0);
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setPage(0);
  };

  const courses = data?.content ?? [];

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: 3 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        교육과정
      </Typography>

      <Stack component="form" direction="row" spacing={2} sx={{ mb: 2 }} onSubmit={handleSearch}>
        <TextField
          label="과정명 검색"
          size="small"
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          sx={{ flex: 1 }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="category-label">분류</InputLabel>
          <Select
            labelId="category-label"
            label="분류"
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
          >
            <MenuItem value="">전체</MenuItem>
            {CATEGORIES.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button type="submit" variant="contained">
          검색
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          과정 목록을 불러오지 못했습니다. ({error.message})
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table size="small" aria-label="과정 목록">
          <TableHead>
            <TableRow>
              <TableCell>과정명</TableCell>
              <TableCell sx={{ width: 160 }}>분류</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={2} align="center">
                  <CircularProgress size={28} aria-label="불러오는 중" />
                </TableCell>
              </TableRow>
            ) : courses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} align="center">
                  {error ? '-' : '조건에 맞는 과정이 없습니다.'}
                </TableCell>
              </TableRow>
            ) : (
              courses.map((course) => (
                <TableRow key={course.id} hover>
                  <TableCell>{course.title}</TableCell>
                  <TableCell>{course.category}</TableCell>
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
          rowsPerPageOptions={PAGE_SIZE_OPTIONS}
          onPageChange={(_, next) => setPage(next)}
          onRowsPerPageChange={(e) => {
            setSize(Number(e.target.value));
            setPage(0);
          }}
          labelRowsPerPage="페이지당"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} / 전체 ${count}`}
        />
      </TableContainer>
    </Box>
  );
}
