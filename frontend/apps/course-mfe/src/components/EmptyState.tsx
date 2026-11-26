import { Center, Stack, Text, ThemeIcon } from '@mantine/core';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

// 목록이 비었을 때 보여 주는 안내. 색은 테마 토큰만 쓴다(다크 모드 대응).
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Center py="xl">
      <Stack align="center" gap="xs" ta="center">
        {icon && (
          <ThemeIcon size={56} radius="xl" variant="light" color="gray">
            {icon}
          </ThemeIcon>
        )}
        <Text fw={600} size="lg">
          {title}
        </Text>
        {description && (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        )}
        {action}
      </Stack>
    </Center>
  );
}
