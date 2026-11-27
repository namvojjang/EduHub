# frontend/CLAUDE.md

프론트엔드 작업 지침. 공통 규칙은 루트 `CLAUDE.md`를 따른다.

마이크로프론트엔드(Module Federation, NFR-07) 세 앱과 공통 패키지 세 개로 되어 있다. 설계: `docs/design/NFR-07-mfe-split.md`.

| 경로 | 포트 | 역할 |
|---|---|---|
| `apps/shell` | 3000 | host. Mantine Provider·테마, 라우팅, 로그인 상태(`AuthContext`)·`RequireAuth`, 로그인 화면(레이아웃 없는 전체 화면)·보호 레이아웃 라우트(`RequireAuth` + `AppLayout`), remote 화면 조립 |
| `apps/course-mfe` | 3001 | remote. 과정 목록·상세·관리 화면 (FR-01~03) |
| `apps/enrollment-mfe` | 3002 | remote. 신청 버튼, 내 신청 내역, 명단·수료 (FR-04~08) |
| `packages/http` | — | `@eduhub/http`: `tokenStore`, 토큰 첨부·401 처리 `http`, API 인스턴스, `getErrorMessage` |
| `packages/ui` | — | `@eduhub/ui`: 두 remote가 함께 쓰는 `EmptyState`, `formatDateTime` |
| `packages/api-client` | — | OpenAPI 생성 코드만 (직접 수정 금지, 훅이 막음) |

## 명령

`frontend/`에서 실행한다. 확인하지 않은 명령은 추측해서 적지 않는다.

```bash
npm test                                  # 전체 워크스페이스 테스트
npm run build -w apps/shell               # 앱별 빌드 (course-mfe, enrollment-mfe도 같은 모양)
npm run dev:course                        # 3001 (remote 먼저)
npm run dev:enrollment                    # 3002
npm run dev:shell                         # 3000 → http://localhost:3000
npm run preview -w apps/shell             # 빌드 결과로 실행 (각 앱 build 후, 앱마다)
```

백엔드(8080)는 루트 `CLAUDE.md`의 `bootRun`. 모든 앱의 `/api`는 Vite 프록시로 백엔드에 간다.

## 경계 (NFR-07, 리뷰에서 확인)

- **공유 의존성**: 세 앱의 `vite.config.ts` `shared`는 같아야 한다 — `react`, `react-dom`, `react-router-dom`, `@mantine/core`·`hooks`·`modals`·`notifications`, `@eduhub/http`, `@eduhub/api-client` 모두 singleton. 플러그인은 `@module-federation/vite`만 쓴다.
- **테마·Provider**: `MantineProvider`·`ModalsProvider`·`Notifications`·`BrowserRouter`·`AuthProvider`는 shell에만. remote의 `main.tsx`는 단독 실행용(개발 편의)이라 예외다.
- **API**: API 호출은 `@eduhub/http`의 인스턴스로만. URL을 코드에 쓰지 않는다.
- **모듈**: remote끼리, remote → shell import 금지. 두 remote를 한 화면에 함께 보이게 할 때는 shell이 슬롯으로 조립한다(예: 과정 상세의 `renderSessionAction`에 `EnrollButton`).
- remote가 노출하는 화면을 바꾸면 `apps/shell/src/remotes.d.ts`도 맞춘다.
- **로그인 먼저 (D-06)**: 모든 화면은 로그인 후 사용한다. 새 화면 라우트는 `apps/shell/src/App.tsx`의 보호 레이아웃 라우트(`RequireAuth` + `AppLayout`) 안에 넣고, `/login`만 그 밖에 둔다.
- **remote 단독 실행(3001·3002)**: 토큰이 없어(포트가 다르면 localStorage가 다름) API가 401이다. 화면 확인은 shell(3000)에서 한다.

## UI

- UI는 Mantine 8.3(`@mantine/core`·`hooks`·`modals`·`notifications`), 아이콘은 `@tabler/icons-react`, 글꼴은 `pretendard`(shell에서 로드)를 쓴다. Mantine 9는 React 19.2가 필요해 React 19 전환 때 함께 올린다.
- 색은 테마 토큰이나 `light-dark()`만 쓴다(다크 모드 대응). 테마는 `apps/shell/src/theme.ts` 한 곳.

## 테스트 작성

- 컴포넌트 테스트는 각 앱의 `src/test/render.tsx`의 `renderWithProviders`로 렌더한다.
- shell의 보호 화면(`/login` 밖의 모든 화면)은 로그인 상태로 렌더해야 한다(안 하면 로그인 화면이 나온다). shell의 `renderWithAuth(ui, { route })`(`MemoryRouter` + `AuthProvider`)로 렌더한다. 로그인 상태는 렌더 전에 `tokenStore.save(...)`로 넣는다.
- remote 화면은 enrollment-mfe의 `src/test/render.tsx`의 `renderWithRouter(ui, { route })`(`MemoryRouter` + Provider)로 렌더한다.
- remote는 로그인 상태를 모른다(prop으로도 받지 않는다). 로그인 보장은 shell의 `RequireAuth`가 한다(D-06). API는 `vi.mock('@eduhub/http', ...)`로 대체한다.
- shell 테스트에서 remote 모듈(`courseMfe/…`, `enrollmentMfe/…`)은 `vi.mock`으로 대체한다(테스트 때는 federation 대신 가상 모듈).
- jsdom에서 Mantine 드롭다운·메뉴 항목은 `getByRole(..., { hidden: true })`가 필요할 수 있다.

## API 호출 (NFR-04)

- API 클라이언트는 손으로 쓰지 않는다. 백엔드 OpenAPI 스펙(`/v3/api-docs`)에서 생성한 Axios 클라이언트를 쓴다.
- 생성된 클라이언트 파일은 직접 고치지 않는다. API가 바뀌면 스펙에서 다시 생성한다(`npm run generate:api`).
- 서버 데이터 조회는 커스텀 훅(`src/hooks/useXxx.ts`)으로 한다.
- 생성 클라이언트 인스턴스는 `@eduhub/http`에서만 만든다: `new XxxApi(undefined, '', http)`.
- 로그인 요청(`POST /api/v1/auth/login`)에는 토큰을 붙이지 않고, 그 401은 만료로 보지 않는다. 토큰을 붙인 요청이 401이면 토큰을 지우고 `eduhub:unauthorized` 이벤트를 보내며, 403은 토큰을 유지한다 (NFR-03).
- 토큰·비밀번호·Axios 에러 객체를 console에 남기지 않는다.
