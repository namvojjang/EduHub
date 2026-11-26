# 설계명세: 로그인 화면과 토큰 처리 (NFR-03 프론트엔드)

- 상태: 승인됨 (2026-11-26, 9장 Q1~Q4 모두 권장안). 구현계획: `docs/plans/NFR-03-login-ui.md`
- 관련: NFR-03(로그인·권한), NFR-04(생성 클라이언트만 사용), NFR-07(6회차 MFE 분리 대비 폴더), 백엔드 `docs/design/NFR-03-auth.md`
- 참고: 교육 5회차 Step 13~14. 교재는 **MUI**지만 이 프로젝트는 **Mantine 8.3**(PR #6)이고, Step 13 준비(라우터·axios·`/api` 프록시·클라이언트 재생성)는 이미 되어 있다 (8장)
- 범위 밖: 상세 신청 버튼·내 신청 내역 화면(Step 15), 명단·수료 화면(Step 16), 백엔드 변경, 생성 코드 수정, 리프레시 토큰

## 1. 요구사항 정리

| ID | 이번에 지킬 것 |
|---|---|
| NFR-03 | 사번·비밀번호로 로그인하고, 이후 모든 API 호출에 `Authorization: Bearer` 토큰을 붙인다. 로그인·관리자 화면은 화면에서도 막는다(실제 차단은 백엔드 401·403) |
| NFR-04 | 생성 클라이언트(`@eduhub/api-client`)만 쓴다. 손으로 쓰는 토큰 처리는 앱 `src/api/`에 둔다 |
| NFR-07 | 6회차에 `shell`로 갈 것(`auth/`, 레이아웃)과 `course-mfe`에 남을 것(`pages/`, `hooks/`)을 폴더로 나눈다 |
| 백엔드 최종 검토 메모 | **로그인 요청에는 토큰을 붙이지 않는다**(만료 토큰이 붙으면 로그인도 401). **401이면 저장된 토큰을 지운다** |

## 2. 구조

```
apps/course-mfe/src/
├── api/
│   ├── http.ts         # 새: tokenStore + Axios 인스턴스 http (토큰 첨부, 401 처리)   → 6회차: packages
│   ├── courseApi.ts    # 수정: 세 번째 인자로 http
│   └── clients.ts      # 새: authApi (Step 15·16에서 enrollmentApi 등 추가)
├── auth/               # 새                                                       → 6회차: shell
│   ├── AuthContext.tsx # user, expired, login, logout. 401 이벤트 → /login
│   ├── RequireAuth.tsx # 로그인·관리자 확인 라우트 가드
│   └── LoginPage.tsx   # Mantine 폼
├── layout/AppLayout.tsx # 수정: 헤더에 로그인/사용자 메뉴, 관리자 메뉴는 ADMIN만
├── App.tsx             # 수정: /login 추가, /admin/** 를 RequireAuth admin으로
└── main.tsx            # 수정: BrowserRouter 안에 AuthProvider
```

## 3. 동작

### 3-1. `api/http.ts`
- `tokenStore`: localStorage `eduhub.accessToken`, `eduhub.user`(JSON `MeResponse`). get/user/save/clear. JSON이 깨져 있으면 null로 보고 지운다
- `http = axios.create()`
- 요청 인터셉터: 토큰이 있으면 `Authorization: Bearer …`. **단 `POST /api/v1/auth/login`에는 붙이지 않는다**
- 응답 인터셉터: **401이면 토큰 삭제 + `window` 이벤트 `eduhub:unauthorized`**. 단 **로그인 요청의 401(`LOGIN_FAILED`)은 제외**(비밀번호 틀림은 만료가 아님). **403은 로그아웃하지 않는다**
- 생성 클라이언트는 `new XxxApi(undefined, '', http)`로 만든다(이 프로젝트의 기존 주석: `Configuration.basePath=''`는 생성 코드가 무시하므로 두 번째 인자로 넘긴다)

### 3-2. `auth/AuthContext.tsx`
- 상태: `user: MeResponse | null`(처음 값은 `tokenStore.user()`), `expired: boolean`
- `login(employeeNo, password)`: `authApi.login` → `tokenStore.save(accessToken, user)` → `user` 설정, `expired=false`
- `logout()`: `tokenStore.clear()`, `user=null`, `/`로 이동, 토스트 "로그아웃했습니다"
- `eduhub:unauthorized` 수신: `expired=true`, `user=null`, `/login`으로(`state.from`=현재 경로+쿼리)
- 앱 시작 시 토큰이 있으면 `authApi.getMe()`로 확인(만료면 401 → 위 이벤트). 성공하면 서버 값으로 `user` 갱신
- `expired`를 navigate state가 아니라 **컨텍스트 상태**로 두는 이유: 교재가 겪은 문제(로그아웃 직후 RequireAuth의 재이동이 navigate state를 덮어써 안내가 사라짐)

### 3-3. `auth/RequireAuth.tsx`
- 로그인 안 했으면 `/login`으로(`state.from`=원래 경로)
- `admin` 속성이 있고 `user.role !== 'ADMIN'`이면 Mantine `Alert` "관리자만 사용할 수 있는 화면입니다."(로그아웃시키지 않음)

### 3-4. `auth/LoginPage.tsx` (`/login`)
- Mantine `Paper` + `TextInput`(사번) + `PasswordInput`(비밀번호) + 제출 버튼(로딩 표시)
- 성공: `state.from` 또는 `/`로 이동(replace)
- 실패: 응답 code가 `LOGIN_FAILED`면 "사번 또는 비밀번호가 올바르지 않습니다.", 그 밖(네트워크·500)이면 `getErrorMessage`
- `expired`면 안내 "로그인이 만료되었습니다. 다시 로그인하세요."
- 이미 로그인 상태로 `/login`에 오면 `/`로 보낸다
- 개발 편의: 화면 아래 작은 글씨로 dev 계정 안내(`import.meta.env.DEV`일 때만) → Q3

### 3-5. 레이아웃과 라우팅
- 헤더 오른쪽: 비로그인 "로그인" 버튼 / 로그인 시 `Avatar`(이름 첫 글자) + 메뉴(이름·사번·역할, "로그아웃")
- 좌측 내비: "교육과정" 누구나, "내 신청 내역" 로그인 시(화면은 Step 15, 지금은 비활성 유지), "과정 관리" ADMIN만
- 라우트: `/login` 추가, `/admin/courses`·`/admin/courses/:id`를 `<RequireAuth admin>`으로. `/`·`/courses/:id`는 공개(지금과 같음)

## 4. 보안 메모 (PR 본문에도 적는다)
- 화면의 권한 확인은 **편의**다. 실제 차단은 백엔드(401·403)
- 토큰을 localStorage에 두면 XSS 시 읽힐 수 있다. 교육 범위에서 단순화를 위해 쓰고, 만료 60분으로 줄인다(백엔드 Q4). 운영은 HttpOnly 쿠키·리프레시 토큰·사내 SSO 검토(8회차) → Q2
- 토큰·비밀번호를 콘솔·오류 메시지에 남기지 않는다

## 5. 테스트 (Vitest + Testing Library, `renderWithProviders` + `MemoryRouter`)

| # | 대상 | 시나리오 |
|---|---|---|
| H1 | http | 저장된 토큰을 Authorization에 붙인다 |
| H2 | http | 토큰이 없으면 헤더 없음 |
| H3 | http | **로그인 요청에는 토큰이 있어도 붙이지 않는다** |
| H4 | http | 401이면 토큰 삭제 + 이벤트 1번 |
| H5 | http | **로그인 요청의 401은 토큰 삭제·이벤트 없음** |
| H6 | http | 403은 토큰 유지, 이벤트 없음 |
| H7 | tokenStore | 깨진 JSON이면 null, 저장소 정리 |
| A1 | LoginPage | 성공 → `state.from`으로 이동, 토큰 저장 |
| A2 | LoginPage | `LOGIN_FAILED` → 안내 문구, 이동 없음 |
| A3 | LoginPage | expired면 만료 안내 |
| R1 | RequireAuth | 비로그인 → `/login`(from 전달) |
| R2 | RequireAuth | 사원이 admin 화면 → 경고, 로그아웃 안 됨 |
| L1 | AppLayout | 비로그인: 로그인 버튼, "과정 관리" 없음 / 사원: 이름, "과정 관리" 없음 / 관리자: "과정 관리" 있음 |
| L2 | AuthContext | 401 이벤트 → expired 상태, /login 이동 |

- 기존 테스트(목록·상세·관리자 화면) 회귀: `courseApi`가 `http`를 쓰게 바뀌어도 통과. 관리자 화면 테스트는 RequireAuth를 거치지 않고 페이지를 직접 렌더하므로 영향 최소
- 브라우저 직접 확인(메인 세션): 로그인·로그아웃, 틀린 비밀번호, 비로그인 `/admin/courses` → 로그인 → 원래 화면, 사원으로 관리자 화면 경고, Network 탭 Authorization 헤더, **만료 토큰을 넣고 새로고침 → 만료 안내**, 로그인 요청에 헤더 없음

## 6. 영향 범위

| 항목 | 내용 |
|---|---|
| 새 파일 | `api/http.ts`, `api/clients.ts`, `auth/AuthContext.tsx`, `auth/RequireAuth.tsx`, `auth/LoginPage.tsx`, 테스트 5~6개 |
| 수정 | `api/courseApi.ts`, `App.tsx`, `main.tsx`, `layout/AppLayout.tsx`, `frontend/CLAUDE.md`(인증·토큰 규칙) |
| 백엔드 | 변경 없음 |
| 효과 | PR #7 이후 401로 막혀 있던 **관리자 화면이 로그인하면 다시 동작**한다(백엔드 설계 Q1 해소) |

## 7. 위험
- `courseApi`의 인스턴스 생성 방식 변경으로 기존 화면이 깨질 수 있음 → 기존 테스트 전체 + 브라우저 확인
- 401 이벤트가 여러 요청에서 동시에 오면 여러 번 이동 → 이미 `/login`이면 무시
- React Router 6(교재는 7)의 navigate state 동작 차이 → 만료 안내를 컨텍스트 상태로 둬서 영향 없음

## 8. 교재와 다르게 하는 것

| 교재 | 이 프로젝트 | 이유 |
|---|---|---|
| MUI(`AppBar`, `TextField`) | Mantine(`AppShell` 헤더, `TextInput`/`PasswordInput`) | PR #6 결정 |
| 상단 바 버튼 | 기존 `AppLayout` 헤더·좌측 내비에 통합 | 레이아웃 이미 있음 |
| `/courses` 목록 | `/` 목록(기존 경로 유지) | 기존 화면·링크 유지 |
| `new XxxApi(new Configuration({basePath:''}), undefined, http)` | `new XxxApi(undefined, '', http)` | 이 프로젝트 생성기 5.4.0의 basePath 처리(기존 주석) |
| `CurrentUser` 타입 | `MeResponse`(백엔드 응답 이름) | 생성 클라이언트 |
| 로그인 요청에도 토큰 첨부 | **로그인 요청 제외**, 로그인 401은 이벤트 제외 | 백엔드 최종 검토 메모 |
| Step 13 준비 | 대부분 완료(프록시·라우터·클라이언트) | 앞선 PR에서 |

## 9. 질문과 결정

> 개발자 결정 (2026-11-26): Q1~Q4 모두 권장안.
- **Q1. 로그인 후 기본 이동 경로는 `/`(과정 목록).** 원래 가려던 곳이 있으면 그곳. (권장: 그대로)
- **Q2. 토큰은 localStorage(교재 그대로).** XSS 위험은 PR·문서에 적고 8회차에 다시 본다. (권장: 그대로)
- **Q3. 로그인 화면에 dev 계정 안내를 개발 모드에서만 보여 준다.** 운영 빌드에는 안 나온다. (권장: 보여 준다 — 교육·확인 편의. 원하지 않으면 뺀다)
- **Q4. 관리자 화면 이동은 좌측 "과정 관리" 메뉴(기존) 그대로.** 교재의 "과정 등록" 상단 버튼은 만들지 않는다. (권장: 그대로)
