import { Anchor, Breadcrumbs, Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  to?: string; // 없으면 현재 위치(링크 아님)
}

interface PageHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  title: string;
  description?: string;
  actions?: ReactNode;
}

// 화면 상단 공통 영역: 브레드크럼, 제목, 설명, 오른쪽 동작 버튼.
export function PageHeader({ breadcrumbs, title, description, actions }: PageHeaderProps) {
  return (
    <Stack gap="xs" mb="lg">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs>
          {breadcrumbs.map((item) =>
            item.to ? (
              <Anchor key={item.label} component={Link} to={item.to} size="sm">
                {item.label}
              </Anchor>
            ) : (
              <Text key={item.label} size="sm" c="dimmed">
                {item.label}
              </Text>
            ),
          )}
        </Breadcrumbs>
      )}
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4}>
          <Title order={2}>{title}</Title>
          {description && (
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          )}
        </Stack>
        {actions}
      </Group>
    </Stack>
  );
}
