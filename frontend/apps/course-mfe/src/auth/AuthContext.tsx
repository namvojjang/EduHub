import type { MeResponse } from '@eduhub/api-client';
import { notifications } from '@mantine/notifications';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api/clients';
import { tokenStore, UNAUTHORIZED_EVENT } from '../api/http';
import { isLoginPath } from './isLoginPath';

interface AuthValue {
  user: MeResponse | null;
  /** 세션 만료(401)로 로그인 화면에 왔는가. 로그인에 성공하거나 로그아웃하면 false. */
  expired: boolean;
  login: (employeeNo: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

/** 저장된 사용자가 쓸 수 있는 형식인지 본다. role·employeeId가 없으면 깨진 값으로 보고 null. */
function readStoredUser(): MeResponse | null {
  // 토큰 없이 사용자만 남아 있으면 로그인한 것처럼 보이는데 요청은 헤더가 없어 401 이벤트도 없다. 정리한다.
  if (!tokenStore.get()) {
    tokenStore.clear();
    return null;
  }
  const stored = tokenStore.user();
  return stored && stored.role && stored.employeeId !== undefined ? stored : null;
}

/** 로그인 상태(user)와 만료 여부(expired)를 앱 전체에 준다 (NFR-03). Router 안에 둔다. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [user, setUser] = useState<MeResponse | null>(readStoredUser);
  // expired를 navigate state가 아니라 컨텍스트 상태로 두는 이유: 로그아웃·만료 직후 RequireAuth가
  // 다시 /login으로 이동하면서 navigate state를 덮어써 안내가 사라지는 문제가 있었기 때문이다.
  const [expired, setExpired] = useState(false);

  // 이벤트 리스너는 한 번만 등록하므로, 최신 위치는 ref로 읽는다.
  const locationRef = useRef({ pathname, search });
  locationRef.current = { pathname, search };

  // 만료 안내는 로그인 화면용이다. 다른 경로로 이동하면 지운다.
  useEffect(() => {
    if (!isLoginPath(pathname)) setExpired(false);
  }, [pathname]);

  useEffect(() => {
    const onUnauthorized = () => {
      setExpired(true);
      setUser(null);
      const { pathname: current, search: currentSearch } = locationRef.current;
      // 401이 연달아 와도 이미 로그인 화면이면 다시 이동하지 않는다.
      if (!isLoginPath(current)) {
        navigate('/login', { replace: true, state: { from: current + currentSearch } });
      }
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [navigate]);

  // 다른 탭의 로그인·로그아웃을 따라간다. storage 이벤트는 다른 탭의 변경에만 발생한다.
  // 이걸 듣지 않으면 다른 탭에서 로그아웃해도 이 탭은 로그인 화면(관리자 메뉴 포함)을 유지하고,
  // 다른 사람으로 다시 로그인하면 요청은 새 토큰으로 나가는데 화면은 옛 사용자로 남는다.
  // 토큰이 사라지면 보호 화면은 RequireAuth가 /login으로 보내므로 navigate하지 않고,
  // 사용자가 직접 로그아웃한 것이므로 expired도 켜지 않는다.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === 'eduhub.accessToken' || e.key === 'eduhub.user') {
        setUser(readStoredUser());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // 시작 시 저장된 토큰이 아직 유효한지 서버에 확인한다. 만료면 401 → 위 이벤트가 처리한다.
  useEffect(() => {
    const requestToken = tokenStore.get();
    if (!requestToken) return;
    let active = true;
    authApi
      .getMe()
      .then((res) => {
        // 확인하는 동안 로그아웃·만료·재로그인으로 토큰이 바뀌었으면 옛 응답으로 덮어쓰지 않는다.
        if (!active || tokenStore.get() !== requestToken) return;
        tokenStore.save(requestToken, res.data);
        setUser(res.data);
      })
      // 401은 http 인터셉터가 처리한다. 네트워크 오류 등은 저장된 사용자로 계속 쓴다(에러 객체는 남기지 않는다).
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (employeeNo: string, password: string) => {
    const res = await authApi.login({ employeeNo, password });
    const { accessToken, user: me } = res.data;
    if (!accessToken || !me) throw new Error('로그인 응답이 올바르지 않습니다.');
    tokenStore.save(accessToken, me);
    setUser(me);
    setExpired(false);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setExpired(false);
    navigate('/');
    notifications.show({ message: '로그아웃했습니다' });
  }, [navigate]);

  const value = useMemo(() => ({ user, expired, login, logout }), [user, expired, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있습니다.');
  return value;
}
