import { Alert, Badge, Box, Button, Container, Group, Loader, Paper, Table, Text, Title } from '@mantine/core';
import { Link, useParams } from 'react-router-dom';
import {
  COURSE_STATUS_COLOR,
  COURSE_STATUS_LABEL,
  SESSION_STATUS_COLOR,
  SESSION_STATUS_LABEL,
} from '../constants/statusLabels';
import { useCourseDetail } from '../hooks/useCourseDetail';

/** "2026-12-01T09:00:00" → "2026-12-01 09:00" */
function formatDateTime(value?: string): string {
  return value ? value.replace('T', ' ').slice(0, 16) : '-';
}

/** 과정 상세 화면 (FR-02). 데이터는 useCourseDetail로만 가져온다. */
export function CourseDetailPage() {
  const { id } = useParams();
  const { data, loading, notFound, error } = useCourseDetail(Number(id));
  const sessions = data?.sessions ?? [];

  return (
    <Box bg="gray.0" mih="100vh" py="xl">
      <Container size="lg">
        <Button component={Link} to="/" variant="subtle" mb="md">
          ← 목록으로
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

        {data && (
          <>
            <Paper withBorder p="md" mb="md">
              <Group gap="sm" mb="xs">
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
              {data.description && (
                <Text c="dimmed" style={{ whiteSpace: 'pre-line' }}>
                  {data.description}
                </Text>
              )}
            </Paper>

            <Paper withBorder>
              <Title order={3} p="md" pb="xs">
                회차
              </Title>
              <Table.ScrollContainer minWidth={600}>
                <Table verticalSpacing="sm" aria-label="회차 목록">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>일정</Table.Th>
                      <Table.Th>장소</Table.Th>
                      <Table.Th ta="right">정원</Table.Th>
                      <Table.Th ta="right">남은 자리</Table.Th>
                      <Table.Th>상태</Table.Th>
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
                          <Table.Td ta="right">
                            {session.remainingSeats === 0 ? (
                              <Text span c="red" fw={600}>
                                0 (정원 마감)
                              </Text>
                            ) : (
                              session.remainingSeats
                            )}
                          </Table.Td>
                          <Table.Td>
                            {session.status ? (
                              <Badge variant="light" color={SESSION_STATUS_COLOR[session.status] ?? 'gray'}>
                                {SESSION_STATUS_LABEL[session.status] ?? session.status}
                              </Badge>
                            ) : (
                              '-'
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
    </Box>
  );
}
