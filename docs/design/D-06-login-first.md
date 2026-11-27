# 설계명세: 로그인 먼저 — 모든 화면·API는 로그인 후 사용 (D-06)

- 상태: 승인됨 (2026-11-27, Q1~Q4 권장안). 구현계획: `docs/plans/D-06-login-first.md`
- 관련: D-06(이번에 추가), NFR-03(인증), NFR-07(MFE 경계), FR-01·FR-02(조회 사용자 = 임직원), FR-04(신청 버튼)
- 배경: 요구사항에는 조회 공개 여부가 정해져 있지 않았다. FR-01·02의 사용자는 "임직원", NFR-03은 "로그인한 사용자만 신청 가능"만 말한다. 과정 조회 공개는 `NFR-03-auth.md` 2-3에서 교재 흐름대로 정했지만 D 번호로 남기지 않았다(과정 화면이 로그인보다 먼저 만들어졌기 때문). 개발자 결정(2026-11-27): **"로그인 먼저"**
- 범위 밖: 리프레시 토큰, 공개 API의 만료 토큰 처리(공개 API가 없어지므로 해당 없음), 없는 경로의 404 화면(아래 Q2), FR-09 알림(다른 세션)

## 1. 요구사항 정리

| ID | 이번에 지킬 것 |
|---|---|
| D-06 (신규) | 모든 화면·API는 로그인 후 사용한다. 공개: 로그인 API(`POST /api/v1/auth/login`), 헬스(`GET /api/health`), API 문서(`/swagger-ui/**`, `/swagger-ui.html`, `/v3/api-docs/**`) |
| NFR-03 | 비로그인 요청은 401 `UNAUTHENTICATED`. 화면 가드는 편의이고 실제 차단은 백엔드 |
| NFR-07 | remote끼리·remote → shell import 금지, shared singleton 유지. remote는 꼭 필요한 만큼만 수정 |

`docs/requirements.md` 결정 사항 표에 추가할 행:

| ID | 관련 | 결정 | 이유 |
|---|---|---|---|
| D-06 | NFR-03, FR-01, FR-02 | **모든 화면·API는 로그인 후 사용한다.** 공개는 로그인 API, 헬스, API 문서뿐이다. 비로그인으로 화면에 오면 로그인 화면(헤더·메뉴 없는 전체 화면)으로 보내고, 로그인 뒤 원래 가려던 화면으로 돌려보낸다 | 사내 임직원 전용 시스템이다(FR-01·02 사용자 = 임직원). 공개 화면과 로그인 화면이 섞이면 비로그인 전용 UI·만료 토큰 예외 처리가 늘어난다. 규칙을 "공개 목록 외에는 전부 로그인"으로 단순하게 한다 |

## 2. 백엔드

### 2-1. 접근 규칙 (`SecurityConfig`, 위에서부터 첫 일치) — 바뀐 것은 2번 행

| 순서 | 요청 | 규칙 |
|---|---|---|
| 1 | `POST /api/v1/auth/login` | permitAll |
| 2 | `GET /api/health`, `/swagger-ui/**`, `/swagger-ui.html`, `/v3/api-docs/**` | permitAll (**과정 목록·상세 GET 제거**) |
| 3 | `/api/v1/admin/**` | `hasRole("ADMIN")` |
| 4 | 그 밖의 모든 요청 | authenticated |

- 경로·요청·응답 본문은 바뀌지 않는다. 비로그인 응답만 200 → 401 `UNAUTHENTICATED`(기존 진입점)로 바뀐다.
- OpenAPI: `CourseController`에는 이미 `@SecurityRequirements()`(공개 표시)가 없어 전역 bearer 요구가 걸려 있다. **스펙이 바뀌지 않으므로 프론트 클라이언트 재생성 없음.**
- 주석: "FR-01, FR-02: 과정 조회는 공개" → "D-06: 공개는 로그인·헬스·API 문서뿐".

### 2-2. 문서

- `docs/design/NFR-03-auth.md` 2-2 표의 공개 행과 2-3 표 2번 행에 "개정(2026-11-27, D-06): 과정 목록·상세 GET 공개 해제" 기록. 원래 문장은 지우지 않고 취소선 + 개정 줄로 남긴다(왜 바뀌었는지 추적).
- 같은 영향이 있는 설계 문서(`NFR-03-login-ui.md` 68행·111행, `FR-04-07-student-ui.md` 12·65행)에는 "D-06으로 대체" 한 줄만 단다(본문은 그때의 결정 기록이므로 고치지 않는다).

## 3. 프론트엔드 (shell 중심)

### 3-1. 라우트 구조 (`apps/shell/src/App.tsx`, `main.tsx`)

지금은 `main.tsx`가 `<AppLayout><App/></AppLayout>`로 모든 화면(로그인 포함)을 레이아웃으로 감싼다. 바꾼 뒤:

```
<Routes>
  <Route path="/login" element={<LoginPage />} />            ← 레이아웃 없음(전체 화면)
  <Route element={<RequireAuth><AppLayout><Outlet/></AppLayout></RequireAuth>}>   ← 보호 레이아웃 라우트
    <Route path="/" .../>  <Route path="/courses/:id" .../>  <Route path="/my/enrollments" .../>
    <Route path="/admin/..." element={<RequireAuth admin>…</RequireAuth>} />    ← 관리자 확인은 그대로
    <Route path="*" element={<Navigate to="/" replace />} />  ← Q2
  </Route>
</Routes>
```

- `main.tsx`에서 `AppLayout` 감싸기를 뺀다(레이아웃은 App의 보호 라우트가 그린다). Provider 순서는 그대로.
- 비로그인 → `RequireAuth`가 `/login`으로 보내며 `from`(경로 + 쿼리)을 넘긴다(기존 동작 재사용). 로그인 성공 → `safeRedirectPath(from)`로 이동(기존). `/my/enrollments`에 따로 있던 `RequireAuth`는 바깥 가드로 합친다.
- 레이아웃이 가드 안에 있으므로 비로그인일 때 헤더·메뉴가 한 프레임도 그려지지 않는다.

### 3-2. 로그인 화면 (`auth/LoginPage.tsx`)

- 전체 화면: 화면 가운데(`Center mih="100vh"`, 배경은 `AppShell.Main`과 같은 `light-dark()` 토큰)에 EduHub 로고(헤더와 같은 모양) + 기존 로그인 카드. 폼·검증·오류·만료 안내·개발 계정 안내·open redirect 방지는 그대로.
- 레이아웃이 없어지면 다크 모드 전환 버튼이 로그인 화면에서 사라진다. 저장된 색 스킴은 Mantine이 유지하므로 추가하지 않는다.

### 3-3. 로그아웃·만료

| 상황 | 지금 | 바꾼 뒤 |
|---|---|---|
| 로그아웃(사용자 메뉴) | 토큰 삭제 → `/` 이동 → 토스트 | 토큰 삭제 → **`/login`으로 replace 이동**(from 없음 → 로그인 뒤 `/`) → 토스트 |
| 토큰 만료(API 401) | 인터셉터 → `eduhub:unauthorized` → `/login`(from = 현재 경로), 만료 안내 | 그대로 |
| 다른 탭 로그아웃 | 이 탭 비로그인 | 가드가 `/login`으로 보냄(from = 현재 경로) |
| 시작 시 저장 토큰이 만료 | `/me` 401 → `/login` | 그대로. `/me` 응답 전 잠깐은 저장된 사용자로 화면이 그려진다(지금과 같음) |

### 3-4. 비로그인 전용 UI 정리

| 위치 | 정리 |
|---|---|
| shell `AppLayout` 헤더 "로그인" 버튼(`!user` 분기)과 `isLoginPath` 사용 | 삭제. 레이아웃은 로그인 후에만 그려진다. `user`가 null인 타입상 경우에는 사용자 메뉴만 그리지 않는다 |
| enrollment-mfe `EnrollButton`의 `loggedIn` prop과 "로그인 후 신청" 분기 | **Q1** 참고. 권장: prop과 분기를 삭제 |
| shell `App`의 `loggedIn={!!user}` 전달, `remotes.d.ts`의 `loggedIn` | Q1에 따라 삭제 |
| course-mfe | 코드 변경 없음. 단독 실행(3001) 안내 주석만 "단독 실행은 토큰이 없어 API가 401"로 고침 |

### 3-5. remote 단독 실행(3001, 3002)

remote의 `main.tsx`는 개발 편의용이다. 포트가 다르면 localStorage가 달라 토큰이 없으므로 **단독 실행에서는 모든 API가 401**이 된다(지금도 관리자·내 신청 화면은 그렇다). 화면 확인은 shell(3000)로 한다. `frontend/CLAUDE.md`에 한 줄 적는다.

## 4. 파일 목록

| 계층 | 파일 | 변경 |
|---|---|---|
| 문서 | `docs/requirements.md` | D-06 행 |
| 문서 | `docs/design/NFR-03-auth.md`, `NFR-03-login-ui.md`, `FR-04-07-student-ui.md` | 개정 기록 |
| 백엔드 | `auth/SecurityConfig.java` | 과정 GET permitAll 제거, 주석 |
| 백엔드 테스트 | `course/CourseControllerTest.java` | 목록·상세 테스트에 `with(as(...))`, `courseListIsPublic` → 비로그인 목록·상세 401 |
| 백엔드 테스트 | `auth/AuthIntegrationTest.java` | 실제 토큰 없이 `GET /api/v1/courses` 401, `GET /api/health` 200(공개 유지 확인) |
| shell | `App.tsx`, `main.tsx`, `auth/LoginPage.tsx`, `auth/AuthContext.tsx`(logout), `layout/AppLayout.tsx`, `remotes.d.ts` | 3-1~3-4 |
| shell 테스트 | `App.test.tsx`, `layout/AppLayout.test.tsx`, `auth/AuthContext.test.tsx`, `auth/LoginPage.test.tsx` | 아래 5장 |
| enrollment-mfe | `components/EnrollButton.tsx`, `EnrollButton.test.tsx` | Q1 |
| course-mfe | `main.tsx` | 주석 한 줄 |
| 문서 | `frontend/CLAUDE.md` | 로그인 먼저·레이아웃 위치·단독 실행 401·테스트 지침(remote 로그인 prop 문장) |

- `backend/CLAUDE.md`에는 공개 API 언급이 없어 바꾸지 않는다.
- **규모**: 약 18개 파일, 백엔드·shell·remote·문서 여러 계층 → 루트 `CLAUDE.md` 절차 5 해당. 구현계획에서 작업을 (1) 백엔드 (2) shell (3) enrollment-mfe (4) 문서로 나누고 작업마다 보고한다. diff는 1,000줄 아래로 예상.
- FR-09 세션(백엔드 `notification` 패키지, Flyway 마이그레이션)과 파일이 겹치지 않는다. `docs/requirements.md`만 둘 다 건드릴 수 있다(FR-09는 D-04를 참조만 하고 표를 고치지 않으면 충돌 없음).

## 5. 테스트 시나리오

| # | 종류 | 시나리오 | 기대 |
|---|---|---|---|
| B1 | `@WebMvcTest` | 토큰 없이 `GET /api/v1/courses`, `GET /api/v1/courses/1` | 401 `UNAUTHENTICATED` |
| B2 | 〃 | 사원 토큰으로 목록·상세(기존 테스트 전부) | 지금과 같은 결과 |
| B3 | `@SpringBootTest` | 토큰 없이 `GET /api/health` / `GET /api/v1/courses` | 200 / 401 |
| B4 | 회귀 | `./gradlew check` 전체 | 통과 |
| F1 | shell App | 비로그인으로 `/`, `/courses/1`, `/my/enrollments` | remote 화면·헤더 없이 로그인 화면 |
| F2 | 〃 | 비로그인 `/courses/1?x=1` → 로그인 | `/courses/1?x=1`로 돌아옴 |
| F3 | 〃 | `/login` 화면 | 헤더(검색·로고 링크)·왼쪽 메뉴 없음 |
| F4 | 〃 | 로그인 상태 `/` | 레이아웃 + 과정 목록 |
| F5 | 〃 | 로그인 상태 없는 경로 `/nope` | `/`로 이동 (Q2) |
| F6 | 〃 | 과정 상세 슬롯 | `EnrollButton`이 `sessionId`·`ctx`로 조립됨 (Q1이면 `loggedIn` 없음) |
| F7 | AuthContext/AppLayout | 로그아웃 | 토큰 삭제, `/login`으로 이동, 토스트 |
| F8 | 〃 | 401 이벤트 | `/login`, 만료 안내 (기존 L2) |
| F9 | App | 다른 탭 로그아웃(storage 이벤트) | 로그인 화면으로 |
| F10 | AppLayout | "로그인" 버튼 관련 테스트(L1 비로그인, /login·/LOGIN 숨김) | 삭제(해당 UI 없음) |
| F11 | EnrollButton | "로그인 후 신청" 관련 테스트(E1 등 4개) | 삭제 (Q1) |
| F12 | 회귀 | `npm test`, 세 앱 `npm run build -w apps/...` | 통과 |
| M1 | 브라우저(3000) | 비로그인 `/courses/1` → 전체 화면 로그인 → E1001 로그인 → `/courses/1` / 로그아웃 → 로그인 화면 / 관리자 A0001로 `/admin/courses` | 각각 기대대로 |

## 6. 위험

| 항목 | 내용 |
|---|---|
| MFE 배포 순서 (Q1) | shell이 `loggedIn`을 빼고 **옛 enrollment-mfe**가 남아 있으면 `loggedIn`이 undefined → 옛 "로그인 후 신청" 링크가 보인다. 그래서 **enrollment-mfe를 먼저 배포**한다(새 remote는 남는 prop을 무시). 지금은 한 PR·로컬 실행이라 실제 영향 없음. PR 본문에 순서를 적는다 |
| 프록시·스크립트 | 과정 목록을 토큰 없이 부르던 확인 절차(문서의 curl 등)가 401이 된다. 루트·백엔드 CLAUDE.md에는 없음. 설계 문서의 예전 확인 절차는 기록이므로 두고, 위 개정 줄로 안내 |
| 성능(NFR-02) | 과정 목록에 JWT 검증이 더해진다(HMAC, 메모리 연산). 300ms 기준에 영향 없음 |

## 7. 질문 (개발자 결정)

- **Q1. enrollment-mfe `EnrollButton`의 `loggedIn` prop과 "로그인 후 신청" 분기를 지울까?**
  - (a) 지운다: remote 1개 파일 + 테스트, shell 전달과 `remotes.d.ts`도 지운다. 쓰이지 않는 분기와 prop 계약이 사라진다. 배포는 enrollment-mfe 먼저(6장)
  - (b) 둔다: remote는 손대지 않고 shell이 항상 `loggedIn={true}`(또는 `!!user`)를 넘긴다. 변경은 작지만 실행되지 않는 분기와 테스트가 남는다
  - 권장: **(a)**. "꼭 필요한 만큼"의 범위로 본다 — 남겨 두면 다음 사람이 "비로그인이 들어올 수 있나?"를 다시 따져야 한다(NFR-08)
- **Q2. 없는 경로(`/nope`)는 어떻게 할까?** 지금은 레이아웃만 있고 본문이 빈 화면이다. 레이아웃을 보호 라우트로 옮기면 아무것도 없는 흰 화면이 된다.
  - 권장: 보호 레이아웃 안에 `path="*"` → `/`로 replace 이동(한 줄). 비로그인이면 가드가 먼저 로그인으로 보낸다. 404 화면은 범위 밖
- **Q3. 로그아웃 뒤 다시 로그인하면 어디로 갈까?**
  - 권장: `/`(from 없음). 로그아웃은 "이 세션을 끝낸다"는 뜻이라 직전 화면 복귀는 하지 않는다. 만료(401)·다른 탭 로그아웃은 본인이 끝낸 것이 아니므로 원래 화면으로 돌아간다
- **Q4. 로그인 화면에 다크 모드 전환 버튼을 둘까?**
  - 권장: 두지 않는다. 저장된 색 스킴은 유지되고, 로그인 화면은 폼 하나라 단순하게 둔다
