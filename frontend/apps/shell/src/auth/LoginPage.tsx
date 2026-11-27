import type { ErrorResponse } from '@eduhub/api-client';
import { Alert, Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
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
  // 방금 이 화면에서 로그인한 경우. user가 설정되는 렌더가 먼저 와도 "이미 로그인" 이동(/)이 from 이동을 덮지 않게 한다.
  const justLoggedIn = useRef(false);

  const from = safeRedirectPath((location.state as { from?: unknown } | null)?.from);

  if (user && !justLoggedIn.current) {
    return <Navigate to="/" replace />;
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

  return (
    <Paper withBorder shadow="sm" p="xl" radius="md" maw={400} mx="auto" mt="xl">
      <form onSubmit={handleSubmit}>
        <Stack>
          <Title order={2} size="h3">
            로그인
          </Title>
          {expired && !error && (
            <Alert color="yellow">로그인이 만료되었습니다. 다시 로그인하세요.</Alert>
          )}
          {error && <Alert color="red">{error}</Alert>}
          <TextInput
            label="사번"
            required
            autoComplete="username"
            value={employeeNo}
            onChange={(e) => setEmployeeNo(e.currentTarget.value)}
          />
          <PasswordInput
            label="비밀번호"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <Button type="submit" loading={submitting}>
            로그인
          </Button>
          {import.meta.env.DEV && (
            <Text size="xs" c="dimmed">
              개발 계정: 사원 E1001·E1002, 관리자 A0001 (비밀번호 dev-password)
            </Text>
          )}
        </Stack>
      </form>
    </Paper>
  );
}
