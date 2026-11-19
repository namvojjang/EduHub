import {
  Alert,
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Container,
  Group,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconCalendarOff, IconSearchOff } from '@tabler/icons-react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { SessionCard } from '../components/SessionCard';
import { categoryColor } from '../constants/categories';
import { COURSE_STATUS_COLOR, COURSE_STATUS_LABEL } from '../constants/statusLabels';
import { useCourseDetail } from '../hooks/useCourseDetail';

/** 과정 상세 화면 (FR-02). 데이터는 useCourseDetail로만 가져온다. */
export function CourseDetailPage() {
  const { id } = useParams();
  const { data, loading, notFound, error } = useCourseDetail(Number(id));
  const sessions = data?.sessions ?? [];
  const color = categoryColor(data?.category);

  return (
    <Container size="lg" p={0}>
      <Breadcrumbs mb="md">
        <Anchor component={Link} to="/" size="sm">
          교육과정
        </Anchor>
        <Text size="sm" c="dimmed" aria-current="page">
          {data?.title ?? '과정 상세'}
        </Text>
      </Breadcrumbs>

      {loading && (
        <Stack role="status" aria-label="불러오는 중" aria-busy="true" gap="md">
          <Skeleton height={160} radius="lg" />
          <Skeleton height={110} radius="lg" />
          <Skeleton height={110} radius="lg" />
        </Stack>
      )}

      {notFound && (
        <EmptyState
          icon={<IconSearchOff size={28} />}
          title="과정을 찾을 수 없습니다."
          action={
            <Button component={Link} to="/" variant="default">
              목록으로
            </Button>
          }
        />
      )}

      {error && (
        <Alert color="red" mb="md">
          과정 정보를 불러오지 못했습니다. ({error.message})
        </Alert>
      )}

      {data && (
        <>
          <Card withBorder padding="lg" mb="lg">
            <Card.Section h={6} bg={`${color}.6`} />
            <Stack gap="sm" mt="md">
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
          </Card>

          <Title order={3} mb="sm">
            회차
          </Title>
          {sessions.length === 0 ? (
            <Card withBorder>
              <EmptyState icon={<IconCalendarOff size={28} />} title="등록된 회차가 없습니다." />
            </Card>
          ) : (
            <Stack gap="md" role="list" aria-label="회차 목록">
              {sessions.map((session) => (
                <div key={session.id} role="listitem">
                  <SessionCard
                    startAt={session.startAt}
                    place={session.place}
                    capacity={session.capacity}
                    remainingSeats={session.remainingSeats}
                    status={session.status}
                  />
                </div>
              ))}
            </Stack>
          )}
        </>
      )}
    </Container>
  );
}
