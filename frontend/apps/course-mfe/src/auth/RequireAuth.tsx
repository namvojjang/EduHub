import { Alert } from '@mantine/core';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * 로그인(그리고 admin이면 ADMIN 역할)을 확인하는 라우트 가드.
 * 화면의 확인은 편의일 뿐이고 실제 차단은 백엔드의 401·403이다 (NFR-03).
 */
export function RequireAuth({ admin, children }: { admin?: boolean; children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  // 권한이 없어도 로그아웃시키지 않는다(403과 같은 취급).
  if (admin && user.role !== 'ADMIN') {
    return (
      <Alert color="yellow" title="접근할 수 없습니다">
        관리자만 사용할 수 있는 화면입니다.
      </Alert>
    );
  }
  return <>{children}</>;
}
