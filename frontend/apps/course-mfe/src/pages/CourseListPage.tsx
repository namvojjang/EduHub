import {
  Alert,
  Anchor,
  Badge,
  Button,
  Chip,
  Container,
  Group,
  Pagination,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Skeleton,
  Table,
  Text,
} from '@mantine/core';
import { IconSearchOff } from '@tabler/icons-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CourseCard } from '../components/CourseCard';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { CATEGORIES, categoryColor } from '../constants/categories';
import { useCourses } from '../hooks/useCourses';

const PAGE_SIZE_OPTIONS = ['10', '20', '50'];
const ALL_CATEGORIES = '전체';
const SKELETON_COUNT = 6;

type ViewMode = 'card' | 'table';

/** 과정 목록 화면 (FR-01). 검색어는 URL의 keyword가 기준이다. */
export function CourseListPage() {
  const [searchParams] = useSearchParams();
  const keyword = (searchParams.get('keyword') ?? '').trim();
  // 보기 방식은 검색어가 바뀌어도 유지한다.
  const [view, setView] = useState<ViewMode>('card');

  // key={keyword}: 검색어가 바뀌면 안쪽을 새로 마운트해 page·category·size가 처음 값으로 돌아간다.
  // (검색어마다 페이지를 따로 기억하다 옛 페이지가 되살아나는 것도 막는다.)
  return <CourseListView key={keyword} keyword={keyword} view={view} onViewChange={setView} />;
}

interface CourseListViewProps {
  keyword: string;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

function CourseListView({ keyword, view, onViewChange }: CourseListViewProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [category, setCategory] = useState('');
  // page는 훅에 넘기는 값이라 0부터. 화면의 Pagination에는 +1해서 보여 준다.
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);

  const { data, loading, error } = useCourses({ keyword, category, page, size });

  const clearKeyword = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('keyword');
    setSearchParams(next);
  };

  const clearFilters = () => {
    clearKeyword();
    setCategory('');
    setPage(0);
  };

  const courses = data?.content ?? [];
  const total = data?.totalElements ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : page * size + 1;
  const to = Math.min((page + 1) * size, total);
  const hasFilter = keyword !== '' || category !== '';

  return (
    <Container size="xl" p={0}>
      <PageHeader
        breadcrumbs={[{ label: '홈', to: '/' }, { label: '교육과정' }]}
        title="교육과정"
        description="사내 교육과정을 검색하고 일정을 확인하세요."
      />

      <Group justify="space-between" mb="md">
        <Chip.Group
          multiple={false}
          value={category === '' ? ALL_CATEGORIES : category}
          onChange={(value) => {
            setCategory(!value || value === ALL_CATEGORIES ? '' : value);
            setPage(0);
          }}
        >
          <Group gap="xs">
            {[ALL_CATEGORIES, ...CATEGORIES].map((name) => (
              <Chip key={name} value={name} variant="light">
                {name}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
        <SegmentedControl
          aria-label="보기 방식"
          value={view}
          onChange={(value) => onViewChange(value as ViewMode)}
          data={[
            { label: '카드', value: 'card' },
            { label: '표', value: 'table' },
          ]}
        />
      </Group>

      {keyword !== '' && (
        <Group gap="xs" mb="md">
          <Text size="sm">{`‘${keyword}’ 검색 결과`}</Text>
          <Anchor component="button" type="button" size="sm" onClick={clearKeyword}>
            검색 지우기
          </Anchor>
        </Group>
      )}

      {error && (
        <Alert color="red" mb="md">
          과정 목록을 불러오지 못했습니다. ({error.message})
        </Alert>
      )}

      {view === 'card' ? (
        <div aria-busy={loading} role={loading ? 'status' : undefined} aria-label={loading ? '불러오는 중' : undefined}>
          {loading ? (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} mb="md">
              {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                <Skeleton key={i} height={140} radius="lg" />
              ))}
            </SimpleGrid>
          ) : courses.length === 0 ? (
            !error && (
              <Paper withBorder mb="md">
                <EmptyList hasFilter={hasFilter} onClear={clearFilters} />
              </Paper>
            )
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} mb="md">
              {courses.map((course) => (
                <CourseCard key={course.id ?? course.title} id={course.id} title={course.title} category={course.category} />
              ))}
            </SimpleGrid>
          )}
        </div>
      ) : (
        <Paper withBorder mb="md">
          <Table.ScrollContainer minWidth={480}>
            <Table highlightOnHover verticalSpacing="sm" aria-label="과정 목록" aria-busy={loading}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>과정명</Table.Th>
                  <Table.Th w={160}>분류</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {loading ? (
                  Array.from({ length: SKELETON_COUNT }, (_, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>
                        <Skeleton height={16} />
                      </Table.Td>
                      <Table.Td>
                        <Skeleton height={16} />
                      </Table.Td>
                    </Table.Tr>
                  ))
                ) : courses.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={2}>
                      {error ? (
                        <Text c="dimmed" ta="center">
                          -
                        </Text>
                      ) : (
                        <EmptyList hasFilter={hasFilter} onClear={clearFilters} />
                      )}
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  courses.map((course) => {
                    // id가 없으면 이동할 곳이 없으니 카드처럼 행 클릭·링크를 만들지 않는다.
                    const id = course.id;
                    return (
                      <Table.Tr
                        key={id ?? course.title}
                        style={id == null ? undefined : { cursor: 'pointer' }}
                        onClick={id == null ? undefined : () => navigate(`/courses/${id}`)}
                      >
                        <Table.Td>
                          {/* 행 전체는 마우스용, 키보드는 제목 링크로 이동 */}
                          {id == null ? (
                            course.title
                          ) : (
                            <Anchor component={Link} to={`/courses/${id}`} onClick={(e) => e.stopPropagation()}>
                              {course.title}
                            </Anchor>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color={categoryColor(course.category)}>
                            {course.category}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}

      {/* 오류일 때는 "0–0 / 전체 0" 같은 거짓 요약을 보여 주지 않는다 */}
      {!error && (
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
      )}
    </Container>
  );
}

// 빈 결과 안내. 검색어나 분류가 있으면 조건 지우기 버튼을 함께 보여 준다.
function EmptyList({ hasFilter, onClear }: { hasFilter: boolean; onClear: () => void }) {
  return (
    <EmptyState
      icon={<IconSearchOff size={28} />}
      title="조건에 맞는 과정이 없습니다."
      action={
        hasFilter ? (
          <Button variant="default" onClick={onClear}>
            조건 지우기
          </Button>
        ) : undefined
      }
    />
  );
}
