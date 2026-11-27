# 설계명세: 프론트엔드를 shell + course-mfe + enrollment-mfe로 분리 (NFR-07)

- 상태: 승인됨 (2026-11-27, Q1~Q6 권장안)
- 관련: NFR-07(화면은 MFE로 분리), NFR-03(토큰 처리·401), NFR-04(생성 클라이언트), NFR-08(AI 없이 설명 가능)
- 참고: 교육 6회차 1장(경계 4가지), 1-5(무엇이 어디로), 4장 Step 1~3. 교재는 MUI, 우리는 Mantine 8.3
- 원칙: **기능은 바꾸지 않고 구조만 바꾼다.** 쪼갠 뒤 화면 동작은 지금(main, 3001 단독 앱)과 같아야 한다
- 범위 밖: 백엔드, FR-09 알림, 한 주소 배포(Step 4, `run\web`), 플러그인, Vite·React 버전 올리기

## 1. 지금 상태

`frontend/apps/course-mfe` 하나에 모든 화면이 있다(5회차 앱).

| 폴더 | 내용 | 갈 곳 |
|---|---|---|
| `api/http.ts`, `auth/isLoginPath.ts` | 토큰 저장(`tokenStore`), 토큰 첨부·401 처리 Axios(`http`) | 공통 패키지 (Q1) |
| `api/clients.ts`, `api/courseApi.ts` | 생성 클라이언트 인스턴스 | 공통 패키지 |
| `api/errorMessage.ts` | 서버 오류 문구 꺼내기 | 공통 패키지 |
| `auth/` (AuthContext, RequireAuth, LoginPage) | 로그인 상태·보호 라우트·로그인 화면 | **shell** |
| `main.tsx`, `theme.ts`, `layout/AppLayout.tsx`, `App.tsx`(라우트) | Provider·테마·레이아웃·라우팅 | **shell** |
| `pages/`, `hooks/`, `constants/`, `components/`(과정용) | 과정 목록·상세·관리 | **course-mfe** (그대로) |
| `enrollment/` | 신청 버튼, 내 신청 내역, 명단·수료 | **enrollment-mfe** |
| `components/EmptyState`, `SessionCard`의 `formatDateTime` | 두 remote가 함께 쓰는 작은 UI | 공통 UI 패키지 (Q2) |

`enrollment/`는 Step 15·16에서 `pages/`·`hooks/`·`constants/`를 import하지 않게 지켜 왔다. 그래서 바깥 의존은 `api/clients`, `api/http`, `api/errorMessage`, `auth/AuthContext`(EnrollButton만), `EmptyState`, `formatDateTime` 여섯 곳뿐이다.

## 2. 목표 구조

```
frontend/
├── packages/
│   ├── api-client/        # 생성 코드만 (지금 그대로, 훅이 보호)
│   ├── http/   (새)       # @eduhub/http: tokenStore, http, UNAUTHORIZED_EVENT, isLoginPath, API 인스턴스, getErrorMessage
│   └── ui/     (새)       # @eduhub/ui: EmptyState, formatDateTime
└── apps/
    ├── shell/  (새) :3000 # host. Provider·테마·레이아웃·로그인·라우팅, remote 조립
    ├── course-mfe   :3001 # remote. 과정 목록·상세·관리
    └── enrollment-mfe (새) :3002 # remote. 신청 버튼·내 신청 내역·명단
```

### 2-1. 책임

| 책임 | 어디서 | 이유 |
|---|---|---|
| `MantineProvider`·`ModalsProvider`·`Notifications`·Mantine CSS·글꼴 | shell만 | 테마는 한 곳(경계 ②). remote가 Provider를 만들면 모달·알림이 두 벌 |
| `BrowserRouter`, 모든 `Route` | shell만 | 라우터 하나. remote는 화면 컴포넌트만 노출 |
| 로그인 상태(`AuthContext`), `RequireAuth`, `LoginPage`, `AppLayout` | shell | remote는 shell을 import하지 않는다(경계 ④) |
| 토큰 첨부·401 → `eduhub:unauthorized` 이벤트 | `@eduhub/http` | 모든 앱이 같은 `http` 한 벌 |
| 과정 상세 안에 신청 버튼 넣기 | shell이 조립 | course-mfe ↔ enrollment-mfe 직접 import 금지 |

### 2-2. 노출(expose)

| remote | 노출 | 비고 |
|---|---|---|
| courseMfe | `./CourseListPage`, `./CourseDetailPage`, `./AdminCourseListPage`, `./AdminCoursePage` | 교재의 `CourseFormPage` 대신 우리 관리자 화면 2개 |
| enrollmentMfe | `./EnrollButton`, `./MyEnrollmentsPage`, `./RosterPage` | `RosterPage`는 지금의 `RosterRoute`(`key={sessionId}`)를 포함해 노출 |

### 2-3. 과정 상세의 신청 버튼 (슬롯)

지금 `CourseDetailPage`가 `EnrollButton`을 직접 import한다. 쪼개면:

```tsx
// course-mfe: 신청을 모른다
renderSessionAction?: (session: SessionResponse, ctx: { disabledReason?: string; onChanged: () => void }) => ReactNode;

// shell: 두 remote를 조립
<CourseDetailPage renderSessionAction={(s, ctx) => <EnrollButton sessionId={s.id!} loggedIn={!!user} {...ctx} />} />
```

- `disabledReason`(종료 과정·마감 회차)과 `onChanged`(재조회)는 상세 화면이 안다. 그래서 `ctx`로 넘긴다(교재 슬롯에 두 값을 더한 것)
- `EnrollButton`은 `useAuth` 대신 **prop `loggedIn`**을 받는다(Q3)

### 2-4. Module Federation 설정 (세 앱 공통)

- 플러그인: `@module-federation/vite`(1.25, peer vite ^5). **Vite 5.4 그대로**(Q4). `dts: false`, shell에 `remotes.d.ts`
- `shared` singleton: `react`, `react-dom`(`^18`), `react-router-dom`, `@mantine/core`, `@mantine/hooks`, `@mantine/modals`, `@mantine/notifications`, `@eduhub/http`, `@eduhub/api-client`
  - `@mantine/modals`가 한 벌이어야 remote의 `modals.openConfirmModal`이 shell의 `ModalsProvider`로 간다. `@mantine/notifications`도 같다
- 포트: shell 3000, course-mfe 3001, enrollment-mfe 3002, 모두 `strictPort`, `/api` 프록시(server·preview)
- remote마다 오류 경계: remote가 꺼지면 그 자리에 Mantine `Alert` "화면을 불러오지 못했습니다." shell과 다른 remote는 그대로

### 2-5. remote 단독 실행

remote의 `main.tsx`는 단독 실행용으로만 남긴다(Provider·라우터 포함, 개발 편의). shell에서 불러갈 때는 쓰이지 않는다. 단독 실행에는 로그인 화면이 없다.

### 2-6. 테스트

- 지금 테스트 233개를 각 앱·패키지로 **옮긴다**(새로 쓰지 않음). 합계가 줄면 이유를 보고
- `test/render.tsx`의 `renderWithProviders`는 각 앱에 복사. `renderWithAuth`(AuthProvider)는 shell에만
- 각 테스트의 mock 대상 `../api/clients` → `@eduhub/http`
- shell 새 테스트: 라우트·조립(remote는 `vi.mock('courseMfe/…')`로 대체), 오류 경계

## 3. 진행 (교재 4장)

```
Step 1 (이 세션, 혼자) ─┬─> Step 2-a course-mfe remote (워크트리 세션)  ─┬─> Step 3 합치기·확인 (이 세션)
  git mv·공통 패키지·shell └─> Step 2-b enrollment-mfe remote (워크트리 세션) ┘
```

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| Step 1 | `git mv`로 파일 옮기기(1장 표), `@eduhub/http`·`@eduhub/ui` 패키지, shell 완성 | 패키지·shell 테스트 통과, shell 빌드 성공, 커밋 |
| Step 2-a | course-mfe를 remote로(federation, 슬롯, import 경로) | course-mfe 테스트·빌드 |
| Step 2-b | enrollment-mfe 앱 만들기(package.json·vite·tsconfig), import 경로, `loggedIn` prop | enrollment-mfe 테스트·빌드 |
| Step 3 | 브랜치 합치기, 세 앱 동시 실행, 5장 확인 표 | 아래 5장 |

- Step 2 병렬은 교재대로 **워크트리 세션 2개**. 저장소 신뢰 승인(Trust repository)이 필요하다. 안 되면 이 세션에서 차례로 한다(Q5)
- `git mv`는 교재처럼 사람이 할 수도 있다. 기본은 Claude가 하고 `git status`의 `renamed:`를 보여 준다(Q6)

## 4. 문서·설정

- `frontend/CLAUDE.md`: 구조(세 앱·두 패키지·경계 4가지), 명령(`npm test`, 앱별 `dev`·`build`). **동작 확인 뒤에** 적는다
- 루트 `package.json` 스크립트: `dev:shell`, `dev:course`, `dev:enrollment`
- `.claude/launch.json`: shell·enrollment-mfe 항목 추가
- 보호 훅(`packages/api-client/src/*`)은 **바꾸지 않는다**. 손으로 쓰는 코드는 `@eduhub/http`에 둔다(Q1)

## 5. 확인 (Step 3, http://localhost:3000)

쪼개기 전과 같은 흐름:
1. 과정 목록·검색 → 상세 → 회차별 신청 버튼(비로그인이면 로그인 안내)
2. E1001 로그인 → 신청 → 결과, 마감 회차는 버튼 비활성
3. 내 신청 내역 → 필터 → 취소 확인 창(모달) → 알림(토스트)
4. A0001 → 과정 관리 → 과정 수정·회차 추가 → 명단 → 교육 완료·수료(모달·알림)
5. 사원으로 관리자 주소 → 차단, 로그아웃·토큰 만료(401) → 로그인 화면

MFE에서만 볼 것:
6. Network: 3001·3002에서 `remoteEntry.js`를 받고, 빌드 모드에서 React·Mantine 파일은 받지 않는다(한 벌)
7. enrollment-mfe(3002)를 끄면 신청 버튼·내 신청 내역 자리만 Alert, 과정 화면은 그대로
8. 테마·다크 모드가 세 앱 화면에서 같다

## 6. 위험

| 위험 | 대응 |
|---|---|
| React·Mantine·라우터 두 벌 → Hook 오류, 모달이 안 뜸 | shared singleton 목록 고정(2-4), 5장 6번 확인 |
| `@originjs/vite-plugin-federation` 예제가 섞임 | `@module-federation/vite`만, 리뷰에서 확인 |
| remote가 shell·다른 remote를 import | grep 검사(`from 'shell`, `courseMfe` ↔ `enrollmentMfe`), 리뷰 |
| 테스트가 옮기며 빠짐 | 전후 테스트 수 비교 |
| 큰 diff(파일 이동 다수) | `git mv`로 이름 바뀜 기록, 단계별 커밋, CLAUDE.md 절차 5에 따라 단계마다 보고 |
| 워크트리에 `node_modules`·`.env` 없음 | 워크트리 세션에서 `npm install`, 백엔드는 이 세션 것을 사용 |

## 7. 교재와 다르게 하는 것

| 교재 | 이 프로젝트 | 이유 |
|---|---|---|
| MUI (`@mui/material`, `@emotion/react`) | Mantine 4개 패키지 singleton | 우리 UI는 Mantine 8.3 |
| 토큰 처리를 `packages/api-client/src/auth.ts`에 | 새 패키지 `@eduhub/http` | `api-client/src`는 생성 코드라 보호 훅이 막는다. 생성 코드와 손 코드를 섞지 않는다(Q1) |
| 생성 위치 `src/generated/` | 지금 그대로 `src/` | 생성 스크립트·훅을 바꾸지 않는다 |
| `CourseFormPage` 노출 | `AdminCourseListPage`, `AdminCoursePage` | 우리 관리자 화면 구조(PR #6·#7) |
| 슬롯 `(s) => ReactNode` | `(s, { disabledReason, onChanged })` | 마감 안내·재조회가 이미 있다(Step 15) |
| `EnrollButton`이 `tokenStore.get()` | prop `loggedIn` (shell이 넘김) | 로그아웃 시 바로 다시 그려진다. remote가 저장소를 직접 읽지 않는다(Q3) |
| Vite 8.3 | Vite 5.4 그대로 | 버전 올리기는 범위 밖. 플러그인이 Vite 5를 지원 |

## 8. 질문과 결정

| # | 질문 | 권장 |
|---|---|---|
| Q1 | 손으로 쓰는 토큰 처리(`http`, `tokenStore`)와 API 인스턴스를 어디에? | **새 패키지 `packages/http`(`@eduhub/http`)**. 교재처럼 `api-client/src`에 넣으려면 생성 위치를 `src/generated/`로 바꾸고 보호 훅 범위도 고쳐야 한다(훅 수정은 사람 몫). 생성 코드 패키지는 생성 코드만 |
| Q2 | 두 remote가 쓰는 `EmptyState`·`formatDateTime`은? | **작은 공통 패키지 `packages/ui`(`@eduhub/ui`)**. 복사하면 두 벌이 갈라진다. 회차 상태 라벨은 지금처럼 각자(Step 16 Q4) |
| Q3 | `EnrollButton`의 로그인 여부는? | **shell이 prop `loggedIn`으로 넘긴다**. 교재의 `tokenStore.get()`은 로그아웃해도 다시 그려지지 않을 수 있다 |
| Q4 | Vite를 교재처럼 8로 올릴까? | **올리지 않는다(5.4 유지)**. 플러그인이 Vite 5를 지원. 버전 올리기는 별도 작업 |
| Q5 | Step 2를 워크트리 병렬 세션 2개로? | **교재대로 병렬**. 사람이 Trust repository를 눌러야 한다. 그 전까지는 Step 1을 이 세션에서 진행 |
| Q6 | `git mv`는 누가? | **Claude가 하고 `renamed:` 목록을 보여 준다**. 교재처럼 직접 하고 싶으면 명령을 드린다 |
