# 구현계획: 로그인 먼저 — 모든 화면·API는 로그인 후 사용 (D-06)

- 설계명세: `docs/design/D-06-login-first.md` (승인됨 2026-11-27, Q1~Q4 권장안). 이 계획에 없는 결정은 설계명세를 따른다.
- 상태: 승인됨 (2026-11-27, "Approve, start T1")
- 브랜치: `feature/week6-login-first` (main 5259561에서 분기, 워크트리 `.claude/worktrees/login-first`). FR-09 세션의 브랜치·파일과 겹치지 않는다
- 진행: 작업마다 implementer 구현 → reviewer 검토. 심각·경고는 수정·재검토 최대 2회. 모든 작업 후 critical-reviewer 최종 검토, 지적은 고치기 전에 개발자에게.
- 공통 제약
  - API 경로·요청·응답 본문은 바꾸지 않는다. `packages/api-client/src/` 수정 금지(생성 코드). 재생성도 하지 않는다(스펙 변화 없음, 설계 2-1)
  - remote끼리, remote → shell import 금지. `vite.config.ts`의 `shared` 바꾸지 않음. course-mfe는 `main.tsx` 주석 한 줄만
  - 로그인 폼·open redirect 방지(`safeRedirectPath`)·401 인터셉터(`@eduhub/http`)·`RequireAuth`의 관리자 확인 동작은 바꾸지 않는다(재사용)
  - 서브에이전트는 개발 서버·백엔드를 띄우지 않는다. 브라우저 확인은 메인 세션(T5)
- 완료 명령: 작업별 아래. 실제 출력으로 보고
- 커밋: 작업마다 검토 통과 후 메인 세션이. Conventional Commits + 한국어, `D-06`·`NFR-03` 참조
- 규모(CLAUDE.md 절차 5): 약 18개 파일, 여러 계층. diff 1,000줄 아래 예상 → 작업마다 개발자에게 보고

## 단계별로 개발자가 직접 할 일

| 작업 | 직접 할 일 |
|---|---|
| T1~T4 | 작업별 보고(변경 파일·테스트 출력) 확인. 원하면 각 커밋 diff 확인 |
| T5 | 최종 검토 지적 결정, (선택) http://localhost:3000에서 직접 로그인·로그아웃 해 보기 |
| PR 후 | 리뷰·병합 지시. 배포한다면 **enrollment-mfe를 shell보다 먼저**(설계 6장) |

## 작업 순서

```
T1 백엔드 ─> T2 enrollment-mfe ─> T3 shell ─> T4 문서 ─> T5 브라우저 확인·최종 검토·PR
```

T2를 T3보다 먼저 하는 이유: 배포 순서(remote 먼저)와 같게 커밋을 쌓는다.

---

## T1. 백엔드 접근 규칙 (D-06)

파일
- `backend/src/main/java/com/example/eduhub/auth/SecurityConfig.java`
  - permitAll의 `GET "/api/v1/courses", "/api/v1/courses/*"` 제거. `GET /api/health`만 남긴다
  - 주석: "FR-01, FR-02: 과정 조회와 상태 확인은 공개…" → "D-06: 공개는 로그인·헬스·API 문서뿐. 나머지는 로그인 필요"
- `backend/src/test/java/com/example/eduhub/course/CourseControllerTest.java`
  - 목록·상세 성공·404·400 테스트의 요청에 `.with(as(1L, "EMPLOYEE"))`(기존 `TestAuth` 도우미)
  - `courseListIsPublic` → `courseListAndDetailRequireLogin`: 토큰 없이 목록·상세 → 401, 본문 `code` = `UNAUTHENTICATED` (B1)
  - `courseWriteMethodsAreNotPublic`, `nestedCoursePathIsNotPublic`는 그대로 통과해야 한다
- `backend/src/test/java/com/example/eduhub/auth/AuthIntegrationTest.java`
  - 토큰 없이 `GET /api/health` 200, `GET /api/v1/courses` 401 (B3). 기존 테스트 구조·도우미를 따른다
- 다른 컨트롤러 테스트에서 토큰 없이 과정 GET을 부르는 곳이 있으면 같은 방식으로 고친다(grep으로 확인해 보고)

완료 명령
```bash
cd backend && ./gradlew spotlessApply && ./gradlew check
```

## T2. enrollment-mfe 신청 버튼에서 비로그인 분기 삭제 (설계 Q1 a)

파일
- `frontend/apps/enrollment-mfe/src/components/EnrollButton.tsx`
  - `loggedIn` prop(인터페이스·구조분해·JSDoc)과 `if (!loggedIn)` "로그인 후 신청" 분기 삭제. 쓰지 않게 되는 `useLocation` import 정리 (`Link`는 결과의 "내 신청 내역"에서 계속 씀)
  - 분기 순서: 결과 → `disabledReason` → 신청 버튼. 나머지 동작 그대로
- `frontend/apps/enrollment-mfe/src/components/EnrollButton.test.tsx`
  - "로그인 후 신청" 관련 테스트 삭제(true→false 전환, E1, 비로그인+disabledReason, E1 from 전달). `loggedIn` 변수·`login()` 도우미 정리. 나머지 테스트는 기대값 그대로 통과
  - (설계 6장 배포 호환) 남는 prop(`loggedIn`)을 받아도 무시하는지는 TypeScript상 넘길 수 없으므로 테스트하지 않는다
- `frontend/apps/enrollment-mfe/src/test/render.tsx` 주석이 `loggedIn` 예를 들면 맞춘다

완료 명령 (`frontend/`)
```bash
npm test -w apps/enrollment-mfe
npm run build -w apps/enrollment-mfe
```

## T3. shell 로그인 먼저 (설계 3장, Q2~Q4)

파일
- `frontend/apps/shell/src/App.tsx`
  - 라우트 구조: `/login`(레이아웃 없음) + 보호 레이아웃 라우트 `<RequireAuth><AppLayout><Outlet/></AppLayout></RequireAuth>` 안에 나머지 전부. `/my/enrollments`의 개별 `RequireAuth` 제거, 관리자 경로의 `<RequireAuth admin>`은 유지
  - 보호 레이아웃 안 `path="*"` → `<Navigate to="/" replace />` (Q2)
  - `EnrollButton`에 `loggedIn` 전달 삭제, `useAuth` 사용이 없어지면 import 정리
- `frontend/apps/shell/src/main.tsx`: `AppLayout` 감싸기와 import 삭제. 주석 갱신
- `frontend/apps/shell/src/remotes.d.ts`: `EnrollButton` props에서 `loggedIn` 삭제
- `frontend/apps/shell/src/auth/LoginPage.tsx`: 전체 화면 — `Center mih="100vh"` + 배경 `light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))` + 카드 위 EduHub 로고(헤더와 같은 `ThemeIcon` gradient "E" + "EduHub"). 링크로 만들지 않는다(가드가 다시 로그인으로 보내므로). 다크 모드 버튼 없음(Q4). 폼·동작은 그대로
- `frontend/apps/shell/src/auth/AuthContext.tsx`: `logout`이 `navigate('/login', { replace: true })`(state 없음, Q3). 토스트 그대로
- `frontend/apps/shell/src/layout/AppLayout.tsx`: `!user` "로그인" 버튼 분기, `Button`·`isLoginPath` import 삭제. `user`가 있을 때만 사용자 메뉴. 머리 주석의 "단독 실행용…" 낡은 문장을 "로그인 후 화면의 뼈대. 보호 라우트 안에서만 그려진다(D-06)"로
- 테스트
  - `App.test.tsx`: F1(비로그인 `/`, `/courses/1`, `/my/enrollments` → 로그인 화면, remote·헤더 검색창 없음), F2(비로그인 `/courses/1?x=1` → 로그인 → 같은 경로의 remote 화면), F3(`/login`에 내비·검색 없음), F4(로그인 `/` → 레이아웃 + 목록), F5(`/nope` → 목록), F6(슬롯 조립, `loggedIn` 없음), F9(로그인 상태에서 다른 탭 로그아웃 storage 이벤트 → 로그인 화면). 기존 "비로그인 loggedIn=false"·"loggedIn=true" 테스트는 F6으로 대체. remote 오류 경계·RosterRoute 테스트는 로그인 상태로 렌더하도록만 고친다
  - `layout/AppLayout.test.tsx`: L1 비로그인 로그인 버튼, `/login`·`/LOGIN` 숨김 테스트 삭제(F10). "로그인 화면에서도 검색창이 동작" 삭제. 로그아웃 테스트 기대값 `/` → `/login`(F7). W1 다른 탭 로그아웃 테스트는 레이아웃 단독 렌더에서 "사용자 메뉴·과정 관리 사라짐"으로 유지
  - `auth/AuthContext.test.tsx`: 로그아웃이 `/login`으로 가는 테스트가 없으면 추가(F7). 401 테스트(L2) 그대로
  - `auth/LoginPage.test.tsx`: 기존 테스트 그대로 통과 + 로고("EduHub")가 보인다

완료 명령 (`frontend/`)
```bash
npm test -w apps/shell
npm run build -w apps/shell
```

## T4. 문서

- `docs/requirements.md`: 결정 사항 표에 D-06 행(설계 1장 문구 그대로)
- `docs/design/NFR-03-auth.md`: 2-2 공개 행·2-3 표 2번 행의 과정 GET에 취소선 + "개정(2026-11-27, D-06): 과정 목록·상세 GET 공개 해제. `docs/design/D-06-login-first.md`" 줄. 6장 S9의 `GET /api/v1/courses` 기대 200 → 개정 표시
- `docs/design/NFR-03-login-ui.md` 68·111행, `FR-04-07-student-ui.md` 12·65행 근처, `NFR-07-mfe-split.md` 118행: "→ D-06으로 대체" 한 줄(본문 유지)
- `frontend/CLAUDE.md`
  - 표의 shell 역할: "로그인 화면(전체 화면)·보호 레이아웃 라우트"
  - 새 줄: "D-06: 모든 화면은 로그인 후. 새 화면 라우트는 `App.tsx`의 보호 레이아웃 라우트 안에 넣는다. `/login`만 밖"
  - remote 단독 실행(3001·3002)은 토큰이 없어 API가 401 → 화면 확인은 shell(3000)
  - 테스트 지침: "remote 화면은 로그인 상태를 prop으로 받는다(예: `EnrollButton`의 `loggedIn`)" 문장 삭제/수정, "로그인 상태가 필요 없는 remote 화면" 문장 정리
- `frontend/apps/course-mfe/src/main.tsx` 16행 주석: 단독 실행은 토큰이 없어 과정 API도 401(D-06)
- `backend/CLAUDE.md`: 공개 API 언급이 없어 바꾸지 않는다(확인만)

완료 명령: 없음(문서). `cd frontend && npm run build -w apps/course-mfe`(주석 변경 확인)

## T5. 브라우저 확인·최종 검토·PR (메인 세션)

1. 전체 명령(실제 출력 보고)
   ```bash
   cd backend && ./gradlew check
   cd frontend && npm test
   cd frontend && npm run build -w apps/shell && npm run build -w apps/course-mfe && npm run build -w apps/enrollment-mfe
   ```
2. 브라우저(M1): 워크트리에서 backend·course-mfe·enrollment-mfe·shell을 띄우고 http://localhost:3000
   - 비로그인 `/courses/1` → 헤더·메뉴 없는 로그인 화면 → E1001 / dev-password → `/courses/1`, 회차마다 "신청하기"
   - 로그아웃 → 로그인 화면(토스트) → 다시 로그인 → `/`
   - `/nope` → `/`, A0001로 `/admin/courses` 정상, E1001로 `/admin/courses` 경고
   - 토큰 없이 `curl http://localhost:8080/api/v1/courses` → 401, `/api/health` → 200
   - 다른 세션(FR-09)이 같은 포트를 쓰고 있으면 개발자에게 먼저 묻는다
3. critical-reviewer: 설계명세 + 전체 diff + T1~T4 검토 결과. 지적은 고치기 전에 개발자에게
4. 푸시, PR(본문에 배포 순서 enrollment-mfe → shell). 병합은 개발자 지시 때만
