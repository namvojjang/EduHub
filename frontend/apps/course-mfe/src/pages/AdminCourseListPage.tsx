import type { AdminCourseSummaryResponse, CourseRequest } from '@eduhub/api-client';
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
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../api/errorMessage';
import { CourseFormDialog } from '../components/CourseFormDialog';
import { COURSE_STATUS_COLOR, COURSE_STATUS_LABEL } from '../constants/statusLabels';
import { useAdminCourses } from '../hooks/useAdminCourses';
import { useCourseAdminActions } from '../hooks/useCourseAdminActions';

const PAGE_SIZE_OPTIONS = ['10', '20', '50'];

/**
 * 관리자 과정 관리 화면 (FR-03): 등록·종료.
 * 과정 정보 수정과 회차 관리는 과정별 관리 화면에서 한다 (목록에는 설명이 없어 여기서 고치면 설명이 지워진다).
 */
export function AdminCourseListPage() {
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  // page는 훅에 넘기는 값이라 0부터. 화면의 Pagination에는 +1해서 보여 준다.
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
  const total = data?.totalElements ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : page * size + 1;
  const to = Math.min((page + 1) * size, total);

  return (
    <Box bg="gray.0" mih="100vh" py="xl">
      <Container size="lg">
        <Group justify="space-between" align="flex-start" mb="lg">
          <div>
            <Title order={2}>과정 관리</Title>
            <Text c="dimmed" size="sm">
              교육과정을 등록하고 종료하며, 회차는 과정별 관리 화면에서 다룹니다.
            </Text>
          </div>
          <Group>
            <Button component={Link} to="/" variant="default">
              임직원 화면
            </Button>
            <Button onClick={() => setCreateOpen(true)}>과정 등록</Button>
          </Group>
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
              <Button type="submit" variant="default">
                검색
              </Button>
            </Group>
          </form>
        </Paper>

        {error && (
          <Alert color="red" mb="md">
            과정 목록을 불러오지 못했습니다. ({error.message})
          </Alert>
        )}
        {actionError && (
          <Alert color="red" mb="md" withCloseButton onClose={() => setActionError(null)}>
            {actionError}
          </Alert>
        )}

        <Paper withBorder mb="md">
          <Table.ScrollContainer minWidth={560}>
            <Table highlightOnHover verticalSpacing="sm" aria-label="관리자 과정 목록">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>과정명</Table.Th>
                  <Table.Th w={120}>분류</Table.Th>
                  <Table.Th w={100}>상태</Table.Th>
                  <Table.Th w={200} ta="right">
                    관리
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {loading ? (
                  <Table.Tr>
                    <Table.Td colSpan={4}>
                      <Group justify="center">
                        <Loader size="sm" aria-label="불러오는 중" />
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ) : courses.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={4}>
                      <Text c="dimmed" ta="center">
                        {error ? '-' : '등록된 과정이 없습니다.'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  courses.map((course) => (
                    <Table.Tr key={course.id}>
                      <Table.Td>{course.title}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="gray">
                          {course.category}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {course.status ? (
                          <Badge variant="light" color={COURSE_STATUS_COLOR[course.status] ?? 'gray'}>
                            {COURSE_STATUS_LABEL[course.status] ?? course.status}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" justify="flex-end" wrap="nowrap">
                          <Button
                            component={Link}
                            to={`/admin/courses/${course.id}`}
                            size="xs"
                            variant="light"
                          >
                            관리
                          </Button>
                          {course.status === 'OPEN' && (
                            <Button
                              size="xs"
                              variant="light"
                              color="red"
                              disabled={actions.pending}
                              onClick={() => handleClose(course)}
                            >
                              종료
                            </Button>
                          )}
                        </Group>
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

      <CourseFormDialog open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={handleCreate} />
    </Box>
  );
}
