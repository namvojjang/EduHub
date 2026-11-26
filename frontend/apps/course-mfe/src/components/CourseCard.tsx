import { Badge, Button, Card, Group, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { categoryColor } from '../constants/categories';

interface CourseCardProps {
  id?: number; // 생성된 API 타입이 모두 선택값이라 그대로 받는다
  title?: string;
  category?: string;
}

// 과정 목록의 카드 한 장. 키보드는 "자세히 보기" 링크로 접근한다.
// 설명·회차·남은 자리는 목록 API에 없어서 넣지 않는다.
export function CourseCard({ id, title, category }: CourseCardProps) {
  const color = categoryColor(category);
  const label = `${title ?? ''} 자세히 보기`;
  return (
    <Card withBorder padding="md" h="100%">
      <Card.Section h={6} bg={`${color}.6`} />
      <Stack gap="sm" mt="md" justify="space-between" h="calc(100% - 6px)">
        <Stack gap="xs">
          <Group>
            <Badge variant="light" color={color}>
              {category}
            </Badge>
          </Group>
          <Text fw={600} lineClamp={2}>
            {title}
          </Text>
        </Stack>
        {id === undefined ? (
          // id가 없으면 이동할 곳이 없으므로 링크 대신 비활성 버튼
          <Button variant="light" color={color} fullWidth disabled aria-label={label}>
            자세히 보기
          </Button>
        ) : (
          <Button component={Link} to={`/courses/${id}`} variant="light" color={color} fullWidth aria-label={label}>
            자세히 보기
          </Button>
        )}
      </Stack>
    </Card>
  );
}
