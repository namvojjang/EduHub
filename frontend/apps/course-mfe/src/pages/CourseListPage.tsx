import {
  Alert,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Loader,
  Pagination,
  Paper,
  Select,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES } from '../constants/categories';
import { useCourses } from '../hooks/useCourses';

const PAGE_SIZE_OPTIONS = ['10', '20', '50'];
const ALL_CATEGORIES = '전체';

/** 과정 목록 화면 (FR-01). 데이터는 useCourses로만 가져온다. */
export function CourseListPage() {
  const navigate = useNavigate();
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  // page는 훅에 넘기는 값이라 0부터. 화면의 Pagination에는 +1해서 보여 준다.
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);

  const { data, loading, error } = useCourses({ keyword, category, page, size });

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setKeyword(keywordInput.trim());
    setPage(0);
  };

  const handleCategoryChange = (value: string | null) => {
    setCategory(!value || value === ALL_CATEGORIES ? '' : value);
    setPage(0);
  };

  const courses = data?.content ?? [];
  const total = data?.totalElements ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : page * size + 1;
  const to = Math.min((page + 1) * size, total);

  return (
    <Box bg="gray.0" mih="100vh" py="xl">
      <Container size="lg">
        <Group justify="space-between" align="flex-start" mb="lg">
          <div>
            <Title order={2}>교육과정</Title>
            <Text c="dimmed" size="sm">
              사내 교육과정을 검색하고 일정을 확인하세요.
            </Text>
          </div>
          {/* 인증(NFR-03)이 생기기 전까지는 누구나 관리 화면으로 갈 수 있다. */}
          <Button variant="default" onClick={() => navigate('/admin/courses')}>
            과정 관리
          </Button>
        </Group>

        <Paper withBorder p="md" mb="md">
          <form onSubmit={handleSearch}>
            <Group wrap="wrap" align="flex-end">
              <TextInput
                label="과정명 검색"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.currentTarget.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
              <Select
                label="분류"
                allowDeselect={false}
                data={[ALL_CATEGORIES, ...CATEGORIES]}
                value={category === '' ? ALL_CATEGORIES : category}
                onChange={handleCategoryChange}
                w={180}
              />
              <Button type="submit">검색</Button>
            </Group>
          </form>
        </Paper>

        {error && (
          <Alert color="red" mb="md">
            과정 목록을 불러오지 못했습니다. ({error.message})
          </Alert>
        )}

        <Paper withBorder mb="md">
          <Table.ScrollContainer minWidth={480}>
            <Table highlightOnHover verticalSpacing="sm" aria-label="과정 목록">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>과정명</Table.Th>
                  <Table.Th w={160}>분류</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {loading ? (
                  <Table.Tr>
                    <Table.Td colSpan={2}>
                      <Group justify="center">
                        <Loader size="sm" aria-label="불러오는 중" />
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ) : courses.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={2}>
                      <Text c="dimmed" ta="center">
                        {error ? '-' : '조건에 맞는 과정이 없습니다.'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  courses.map((course) => (
                    <Table.Tr
                      key={course.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/courses/${course.id}`)}
                    >
                      <Table.Td>{course.title}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="gray">
                          {course.category}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>

        <Group justify="space-between" wrap="wrap">
          <Text size="sm" c="dimmed">
            {`${from}–${to} / 전체 ${total}`}
          </Text>
          <Group wrap="wrap">
            <Select
              aria-label="페이지당"
              data={PAGE_SIZE_OPTIONS}
              value={String(size)}
              allowDeselect={false}
              onChange={(value) => {
                if (!value) return;
                setSize(Number(value));
                setPage(0);
              }}
              w={90}
            />
            <Pagination total={totalPages} value={page + 1} onChange={(next) => setPage(next - 1)} />
          </Group>
        </Group>
      </Container>
    </Box>
  );
}
