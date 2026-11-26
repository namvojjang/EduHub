import {
  ActionIcon,
  AppShell,
  Avatar,
  Burger,
  Button,
  Group,
  Menu,
  NavLink,
  Text,
  TextInput,
  ThemeIcon,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBooks,
  IconHistory,
  IconLogout,
  IconMoon,
  IconSearch,
  IconSettings,
  IconSun,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { isLoginPath } from '../auth/isLoginPath';

const NAVBAR_ID = 'app-navbar';

// 단독 실행용 앱 뼈대: 헤더(로고·검색·테마·사용자) + 좌측 내비. shell이 생기면 shell로 옮긴다.
export function AppLayout({ children }: { children: ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('light');
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // 현재 URL의 keyword와 검색 입력을 맞춘다.
  const urlKeyword = new URLSearchParams(search).get('keyword') ?? '';
  const [keyword, setKeyword] = useState(urlKeyword);
  useEffect(() => {
    setKeyword(urlKeyword);
  }, [urlKeyword]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = keyword.trim();
    setKeyword(trimmed);
    navigate(trimmed ? `/?keyword=${encodeURIComponent(trimmed)}` : '/');
    close();
  };

  const courseActive = pathname === '/' || pathname.startsWith('/courses');
  const adminActive = pathname.startsWith('/admin');

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" wrap="nowrap" justify="space-between">
          <Group wrap="nowrap" gap="sm">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              aria-label={opened ? '메뉴 닫기' : '메뉴 열기'}
              aria-expanded={opened}
              aria-controls={NAVBAR_ID}
            />
            <UnstyledButton component={Link} to="/" aria-label="EduHub 홈">
              <Group gap="xs" wrap="nowrap">
                <ThemeIcon
                  size="lg"
                  variant="gradient"
                  gradient={{ from: 'indigo', to: 'cyan' }}
                  autoContrast
                >
                  <Text fw={700} size="sm">
                    E
                  </Text>
                </ThemeIcon>
                <Text fw={700} size="lg" visibleFrom="xs">
                  EduHub
                </Text>
              </Group>
            </UnstyledButton>
          </Group>

          <form
            onSubmit={handleSearch}
            role="search"
            aria-label="과정 검색"
            style={{ flex: 1, maxWidth: 420, minWidth: 0 }}
          >
            <TextInput
              placeholder="과정명으로 검색"
              aria-label="과정명으로 검색"
              leftSection={<IconSearch size={16} />}
              value={keyword}
              onChange={(e) => setKeyword(e.currentTarget.value)}
            />
          </form>

          <Group wrap="nowrap" gap="sm">
            <ActionIcon
              variant="default"
              size="lg"
              aria-label="화면 테마 전환"
              onClick={() => setColorScheme(computed === 'dark' ? 'light' : 'dark')}
            >
              {computed === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
            {user ? (
              <Menu position="bottom-end" withinPortal>
                <Menu.Target>
                  <UnstyledButton aria-label="사용자 메뉴">
                    <Group gap="xs" wrap="nowrap">
                      <Avatar radius="xl" size="md" color="indigo">
                        {user.name?.charAt(0)}
                      </Avatar>
                      <Text size="sm" fw={600} visibleFrom="sm">
                        {user.name}
                      </Text>
                    </Group>
                  </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{user.name}</Menu.Label>
                  <Menu.Label>사번 {user.employeeNo}</Menu.Label>
                  <Menu.Label>{user.role === 'ADMIN' ? '관리자' : '사원'}</Menu.Label>
                  <Menu.Divider />
                  <Menu.Item leftSection={<IconLogout size={16} />} onClick={logout}>
                    로그아웃
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            ) : !isLoginPath(pathname) ? (
              // 로그인 화면에서는 이 버튼을 숨긴다(from이 /login이 되는 것을 막는다).
              <Button
                component={Link}
                to="/login"
                state={{ from: pathname + search }}
                variant="default"
              >
                로그인
              </Button>
            ) : null}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" id={NAVBAR_ID}>
        <Text size="xs" fw={700} c="dimmed" mb="xs">
          학습
        </Text>
        <NavLink
          component={Link}
          to="/"
          label="교육과정"
          leftSection={<IconBooks size={18} />}
          active={courseActive}
          onClick={close}
        />
        <NavLink
          component={Link}
          to="/my/enrollments"
          label="내 신청 내역"
          leftSection={<IconHistory size={18} />}
          active={pathname === '/my/enrollments'}
          onClick={close}
        />
        {isAdmin && (
          <>
            <Text size="xs" fw={700} c="dimmed" mt="lg" mb="xs">
              관리
            </Text>
            <NavLink
              component={Link}
              to="/admin/courses"
              label="과정 관리"
              leftSection={<IconSettings size={18} />}
              active={adminActive}
              onClick={close}
            />
          </>
        )}
      </AppShell.Navbar>

      <AppShell.Main bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))">
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
