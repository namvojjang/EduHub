import type { AdminCourseSummaryResponse, CourseRequest } from '@eduhub/api-client';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Menu,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconBooks, IconDots, IconPlus, IconSearch, IconSearchOff, IconSettings } from '@tabler/icons-react';
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '@eduhub/http';
import { CourseFormDialog } from '../components/CourseFormDialog';
import { EmptyState } from '@eduhub/ui';
import { PageHeader } from '../components/PageHeader';
import { categoryColor } from '../constants/categories';
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
    notifications.show({ color: 'teal', message: '과정을 등록했습니다.' });
    reload();
  };

  const closeCourse = async (course: AdminCourseSummaryResponse) => {
    if (course.id == null) return;
    setActionError(null);
    try {
      await actions.closeCourse(course.id);
      notifications.show({ color: 'teal', message: '과정을 종료했습니다.' });
      reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  // window.confirm 대신 확인 창을 띄우고, 확인하면 종료한다.
  const confirmClose = (course: AdminCourseSummaryResponse) => {
    modals.openConfirmModal({
      title: '과정 종료',
      children: (
        <Text size="sm">{`'${course.title}' 과정을 종료할까요? 목록에서 사라지고 새 회차를 열 수 없습니다.`}</Text>
      ),
      labels: { confirm: '종료', cancel: '취소' },
      confirmProps: { color: 'red' },
      onConfirm: () => closeCourse(course),
    });
  };

  const courses = data?.content ?? [];
  const total = data?.totalElements ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : page * size + 1;
  const to = Math.min((page + 1) * size, total);

  return (
    <Container size="xl" p={0}>
      <PageHeader
        breadcrumbs={[{ label: '홈', to: '/' }, { label: '과정 관리' }]}
        title="과정 관리"
        description="교육과정을 등록하고 종료하며, 회차는 과정별 관리 화면에서 다룹니다."
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
            과정 등록
          </Button>
        }
      />

      <Paper withBorder p="md" mb="md">
        <form onSubmit={handleSearch}>
          <Group wrap="wrap" align="flex-end">
            <TextInput
              label="과정명 검색"
              leftSection={<IconSearch size={16} />}
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

      {!loading && !error && (
        <Text size="sm" c="dimmed" mb="xs">
          {`전체 ${total}개`}
        </Text>
      )}

      <Paper withBorder mb="md">
        {loading ? (
          <Stack role="status" aria-label="불러오는 중" aria-busy="true" gap="sm" p="md">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} height={24} />
            ))}
          </Stack>
        ) : courses.length === 0 ? (
          !error &&
          (keyword ? (
            <EmptyState icon={<IconSearchOff size={28} />} title="조건에 맞는 과정이 없습니다." />
          ) : (
            <EmptyState icon={<IconBooks size={28} />} title="등록된 과정이 없습니다." />
          ))
        ) : (
          <Table.ScrollContainer minWidth={560}>
            <Table highlightOnHover verticalSpacing="sm" aria-label="관리자 과정 목록">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>과정명</Table.Th>
                  <Table.Th w={120}>분류</Table.Th>
                  <Table.Th w={100}>상태</Table.Th>
                  <Table.Th w={80} ta="right">
                    관리
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {courses.map((course) => (
                  <Table.Tr key={course.id}>
                    <Table.Td>{course.title}</Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={categoryColor(course.category)}>
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
                    <Table.Td ta="right">
                      <Menu position="bottom-end" withinPortal>
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray" aria-label={`${course.title} 작업`}>
                            <IconDots size={18} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          {/* id가 없으면 이동할 곳이 없으므로 항목을 그리지 않는다. */}
                          {course.id != null && (
                            <Menu.Item
                              component={Link}
                              to={`/admin/courses/${course.id}`}
                              leftSection={<IconSettings size={16} />}
                            >
                              관리
                            </Menu.Item>
                          )}
                          {course.status === 'OPEN' && (
                            <Menu.Item color="red" disabled={actions.pending} onClick={() => confirmClose(course)}>
                              종료
                            </Menu.Item>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
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

      <CourseFormDialog open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={handleCreate} />
    </Container>
  );
}
