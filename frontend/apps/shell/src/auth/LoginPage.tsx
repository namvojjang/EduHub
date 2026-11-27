import type { ErrorResponse } from '@eduhub/api-client';
import {
  Alert,
  Box,
  Button,
  Center,
  Code,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconBooks,
  IconCalendarCheck,
  IconCertificate,
  IconClockExclamation,
  IconId,
  IconLock,
} from '@tabler/icons-react';
import axios from 'axios';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getErrorMessage, isLoginPath } from '@eduhub/http';
import { useAuth } from './AuthContext';

/**
 * 로그인 후 이동할 경로. 앱 안의 경로만 허용한다 (open redirect 방지).
 * `/`로 시작하고 `//`(프로토콜 상대 URL)나 `/\`(브라우저가 `//`로 해석)로 시작하지 않아야 한다.
 */
export function safeRedirectPath(from: unknown): string {
  if (
    typeof from === 'string' &&
    from.startsWith('/') &&
    !from.startsWith('//') &&
    // 역슬래시와 제어문자(탭·개행 등)는 브라우저가 지우거나 `/`로 바꿔 `//`가 될 수 있다.
    // eslint-disable-next-line no-control-regex
    !/[\\\u0000-\u001f]/.test(from) &&
    // 로그인 화면 자신으로 돌아가면 로그인 폼에 머문다.
    !isLoginPath(from.split(/[?#]/)[0])
  ) {
    return from;
  }
  return '/';
}

function loginErrorMessage(e: unknown): string {
  if (axios.isAxiosError<ErrorResponse>(e) && e.response?.data?.code === 'LOGIN_FAILED') {
    return '사번 또는 비밀번호가 올바르지 않습니다.';
  }
  return getErrorMessage(e);
}

export function LoginPage() {
  const { user, expired, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [employeeNo, setEmployeeNo] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 방금 이 화면에서 로그인한 경우. user가 설정되는 렌더가 먼저 와도 "이미 로그인" 이동이 handleSubmit의 이동과 겹치지 않게 한다.
  const justLoggedIn = useRef(false);

  const from = safeRedirectPath((location.state as { from?: unknown } | null)?.from);

  if (user && !justLoggedIn.current) {
    // 이미 로그인됨(다른 탭 로그인, 시작 시 확인 등): 원래 가려던 화면으로 보낸다(D-06).
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    justLoggedIn.current = true;
    try {
      await login(employeeNo.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      // 에러 객체에는 요청 본문(비밀번호)·헤더(토큰)가 들어 있으므로 console에 남기지 않는다.
      justLoggedIn.current = false;
      setError(loginErrorMessage(err));
      setSubmitting(false);
    }
  };

  // D-06: 레이아웃 없는 전체 화면. 넓은 화면은 왼쪽 소개 패널 + 오른쪽 로그인, 좁은 화면은 로그인만.
  // 로고(EduHub)는 한 번만 그린다. 헤더와 같은 모양이지만 링크는 아니다(가드가 다시 로그인으로 보낸다).
  return (
    <Box
      mih="100vh"
      style={{ display: 'flex' }}
      bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))"
    >
      <Box
        visibleFrom="md"
        w="46%"
        p={48}
        c="white"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, var(--mantine-color-indigo-7) 0%, var(--mantine-color-indigo-5) 55%, var(--mantine-color-cyan-5) 100%)',
        }}
      >
        <Stack gap="xl" maw={440}>
          <Stack gap="xs">
            <Text size="sm" fw={600} tt="uppercase" opacity={0.8}>
              사내 교육 플랫폼
            </Text>
            <Title order={1} size={36} lh={1.25}>
              배움을 찾고,
              <br />
              신청까지 한 곳에서
            </Title>
            <Text size="md" opacity={0.85}>
              임직원 교육과정을 조회하고 수강을 신청하세요. 정원이 차면 대기 순번을 알려 드립니다.
            </Text>
          </Stack>
          <Stack gap="md">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <Group key={title} gap="md" wrap="nowrap" align="flex-start">
                <ThemeIcon size={40} radius="md" variant="white" color="indigo">
                  <Icon size={22} />
                </ThemeIcon>
                <div>
                  <Text fw={600}>{title}</Text>
                  <Text size="sm" opacity={0.8}>
                    {description}
                  </Text>
                </div>
              </Group>
            ))}
          </Stack>
        </Stack>
      </Box>

      <Center style={{ flex: 1 }} p="md">
        <Stack gap="lg" w="100%" maw={420}>
          <Group gap="xs" wrap="nowrap" justify="center">
            <ThemeIcon
              size={44}
              radius="md"
              variant="gradient"
              gradient={{ from: 'indigo', to: 'cyan' }}
              autoContrast
            >
              <Text fw={800} size="lg">
                E
              </Text>
            </ThemeIcon>
            <Text fw={800} size="xl">
              EduHub
            </Text>
          </Group>

          <Paper withBorder shadow="md" p={32}>
            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                <Stack gap={4}>
                  <Title order={2} size="h3">
                    로그인
                  </Title>
                  <Text size="sm" c="dimmed">
                    사번과 비밀번호를 입력하세요.
                  </Text>
                </Stack>
                {expired && !error && (
                  <Alert color="yellow" variant="light" icon={<IconClockExclamation size={18} />}>
                    로그인이 만료되었습니다. 다시 로그인하세요.
                  </Alert>
                )}
                {error && (
                  <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />}>
                    {error}
                  </Alert>
                )}
                <TextInput
                  label="사번"
                  placeholder="예: E1001"
                  required
                  size="md"
                  autoComplete="username"
                  leftSection={<IconId size={18} />}
                  value={employeeNo}
                  onChange={(e) => setEmployeeNo(e.currentTarget.value)}
                />
                <PasswordInput
                  label="비밀번호"
                  required
                  size="md"
                  autoComplete="current-password"
                  leftSection={<IconLock size={18} />}
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                />
                <Button
                  type="submit"
                  size="md"
                  mt="xs"
                  fullWidth
                  loading={submitting}
                  variant="gradient"
                  gradient={{ from: 'indigo', to: 'cyan', deg: 90 }}
                >
                  로그인
                </Button>
              </Stack>
            </form>
          </Paper>

          {import.meta.env.DEV && (
            <Paper
              p="sm"
              radius="md"
              bg="light-dark(var(--mantine-color-indigo-0), var(--mantine-color-dark-6))"
            >
              <Text size="xs" c="dimmed" ta="center">
                개발 계정: 사원 <Code>E1001</Code>·<Code>E1002</Code>, 관리자 <Code>A0001</Code>{' '}
                (비밀번호 <Code>dev-password</Code>)
              </Text>
            </Paper>
          )}
        </Stack>
      </Center>
    </Box>
  );
}

// 왼쪽 소개 패널의 기능 소개(FR-01·02, FR-04~06, FR-07).
const FEATURES = [
  {
    icon: IconBooks,
    title: '교육과정 조회',
    description: '제목·분류로 찾고 회차별 남은 자리를 확인합니다.',
  },
  {
    icon: IconCalendarCheck,
    title: '수강 신청과 대기',
    description: '정원이 차면 대기 순번을 받고, 자리가 나면 자동 확정됩니다.',
  },
  {
    icon: IconCertificate,
    title: '내 신청 내역',
    description: '확정·대기·수료 이력을 한눈에 봅니다.',
  },
];
