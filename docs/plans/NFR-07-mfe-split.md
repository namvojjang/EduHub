# 구현계획: 프론트엔드를 shell + course-mfe + enrollment-mfe로 분리 (NFR-07)

- 설계명세: `docs/design/NFR-07-mfe-split.md` (승인됨 2026-11-27, Q1~Q6 권장안). 이 계획에 없는 결정은 설계명세를 따른다.
- 상태: 승인됨 (2026-11-27, "승인, T1 시작")
- 브랜치: `feature/week6-mfe-split` (T2·T3 워크트리 브랜치는 이 브랜치의 T1 커밋에서 갈라진다)
- 진행: 작업마다 implementer 구현 → reviewer 검토. 심각·경고는 수정·재검토 최대 2회. 모든 작업 후 critical-reviewer 최종 검토, 지적은 고치기 전에 개발자에게.
- 공통 제약
  - **기능은 바꾸지 않는다.** 옮기기·import 경로·설계 2장의 다섯 가지 변경만
  - `@module-federation/vite`만(`@originjs/vite-plugin-federation`·Webpack 금지), Vite 5.4·React 18·Mantine 8.3 유지
  - `packages/api-client/src/` 수정 금지(생성 코드, 훅 보호). 백엔드 수정 금지
  - remote끼리, remote → shell import 금지. remote에 `MantineProvider`·`ModalsProvider`·`Notifications`·`AuthProvider`·`BrowserRouter`는 단독 실행용 `main.tsx`에만
  - 파일 이동은 `git mv`(이력 유지)
- 완료 명령: 작업별 아래 표. 실제 출력으로 보고. 기준 테스트 수: 지금 **233개**(25 files)
- 서브에이전트는 개발 서버·백엔드를 띄우지 않는다. 브라우저 확인은 메인 세션(T4)
- 커밋: Conventional Commits + 한국어, `NFR-07` 참조. 메인 세션 또는 워크트리 세션이 검토 통과 후
- 규모(CLAUDE.md 절차 5): 파일 수십 개 이동, diff 1,000줄 이상 예상 → 작업마다 개발자에게 보고

## 단계별로 개발자가 직접 할 일

| 작업 | 직접 할 일 |
|---|---|
| T1 | 없음 (`renamed:` 목록과 결과 확인) |
| T2·T3 | 워크트리 세션 2개 시작에 필요한 **Trust repository** 승인. 각 세션의 결과 확인 |
| T4 | 두 브랜치 합치기 승인, (선택) 3000에서 직접 사용해 보기 |
| T5 | 최종 검토 지적 결정, PR 병합 |

## 작업 순서

```
T1 옮기기·공통 패키지·shell (이 세션) ─┬─> T2 course-mfe remote (워크트리 세션)     ─┬─> T4 합치기·브라우저 확인 ─> T5 최종 검토·PR
                                      └─> T3 enrollment-mfe remote (워크트리 세션) ─┘
```

---

## T1. 파일 옮기기, 공통 패키지, shell (이 세션, 혼자)

1. `git mv` (Claude, `renamed:` 목록 보고)
   - `api/http.ts`(+test), `auth/isLoginPath.ts`, `api/errorMessage.ts` → `packages/http/src/`
   - `components/EmptyState.tsx`(+test) → `packages/ui/src/`. `formatDateTime`은 `SessionCard`에서 `packages/ui/src/formatDateTime.ts`로 분리(SessionCard는 이를 import)
   - `auth/AuthContext`·`RequireAuth`·`LoginPage`(+tests), `layout/AppLayout`(+test), `main.tsx`, `theme.ts`, `App.tsx`(+test) → `apps/shell/src/`
   - `enrollment/*` → `apps/enrollment-mfe/src/` (구조는 T3에서 정리)
   - `api/clients.ts`, `api/courseApi.ts`의 인스턴스 생성 → `packages/http/src/clients.ts`로 합침
2. `packages/http` (`@eduhub/http`): package.json, `src/index.ts`(tokenStore, http, UNAUTHORIZED_EVENT, isLoginPath, authApi·courseApi·courseAdminApi·enrollmentApi·enrollmentAdminApi, getErrorMessage), vitest 설정. 옮긴 http 테스트 통과
3. `packages/ui` (`@eduhub/ui`): EmptyState, formatDateTime, vitest 설정. 옮긴 테스트 통과
4. `apps/shell`: package.json(course-mfe와 같은 버전), vite.config(federation host, remotes 3001·3002, shared 설계 2-4, 3000 strictPort, /api 프록시 server·preview, test jsdom), tsconfig, index.html, `src/remotes.d.ts`, `src/test/`(render·setup 복사)
   - `main.tsx`: Provider·CSS·글꼴·BrowserRouter·AuthProvider·AppLayout (지금과 같음)
   - `App.tsx`: 라우트는 지금과 같게, 화면 import를 remote `lazy`로 + `RemoteBoundary`(Mantine Alert) + Suspense. 상세는 `renderSessionAction`으로 EnrollButton 조립(설계 2-3), 명단은 `RosterPage`
   - auth·layout import를 `@eduhub/http`로. shell 테스트에서 remote는 `vi.mock('courseMfe/…')`
   - 새 테스트: 라우트 조립, remote 실패 시 Alert(다른 remote는 보임)
5. 루트 `package.json`: `dev:shell`, `dev:enrollment` 스크립트. `npm install`로 workspace 연결

T1에서 **course-mfe와 enrollment-mfe는 빌드되지 않아도 된다**(T2·T3에서 고침). 단, 옮기지 않은 course-mfe 파일은 수정하지 않는다.

완료 명령: `npm test -w packages/http`, `npm test -w packages/ui`, `npm test -w apps/shell`, `npm run build -w apps/shell`, `git status`에 `renamed:` 확인

커밋: `refactor(frontend): 토큰 처리를 @eduhub/http로, 로그인·레이아웃을 shell로 옮김(NFR-07)`

---

## T2. course-mfe를 remote로 (워크트리 세션 1)

- vite.config: federation remote `courseMfe`, `remoteEntry.js`, exposes `./CourseListPage`·`./CourseDetailPage`·`./AdminCourseListPage`·`./AdminCoursePage`, shared는 shell과 동일, 3001 strictPort, 프록시 server·preview
- import 경로: `../api/*` → `@eduhub/http`, `EmptyState`·`formatDateTime` → `@eduhub/ui`
- `CourseDetailPage`: EnrollButton import 제거, `renderSessionAction?: (session, { disabledReason, onChanged }) => ReactNode`
- `main.tsx`: 단독 실행용(Provider + BrowserRouter + 과정 라우트, 로그인 없음)
- 테스트: mock `../api/clients` → `@eduhub/http`, CourseDetailPage 테스트는 슬롯으로(신청 버튼 자리 대신 가짜 노드)
- 범위 밖: shell·enrollment-mfe·packages 수정 (필요하면 멈추고 보고)

완료 명령: `npm test -w apps/course-mfe`, `npm run build -w apps/course-mfe`, `grep -rn "enrollment\|from 'shell" apps/course-mfe/src` 결과 없음

커밋: `refactor(course-mfe): Module Federation remote로 전환, 신청 버튼은 슬롯으로(NFR-07)`

## T3. enrollment-mfe를 remote로 (워크트리 세션 2)

- 앱 만들기: package.json(course-mfe와 같은 버전), tsconfig, index.html, vite.config(federation remote `enrollmentMfe`, exposes `./EnrollButton`·`./MyEnrollmentsPage`·`./RosterPage`, shared 동일, 3002 strictPort, 프록시), `src/test/`
- 폴더: `components/EnrollButton`, `pages/MyEnrollmentsPage`·`RosterPage`, 나머지(훅·라벨)는 그대로 둘 위치를 정해 보고
- `RosterPage` 노출은 `key={sessionId}` 래퍼 포함(지금 `RosterRoute` 동작 유지)
- import: `../api/*` → `@eduhub/http`, `../components/EmptyState`·`SessionCard` → `@eduhub/ui`
- `EnrollButton`: `useAuth` 대신 prop `loggedIn`. 테스트도 prop으로
- `main.tsx`: 단독 실행용(Provider + BrowserRouter + 내 신청 내역·명단)
- 범위 밖: shell·course-mfe·packages 수정

완료 명령: `npm test -w apps/enrollment-mfe`, `npm run build -w apps/enrollment-mfe`, `grep -rn "courseMfe\|from 'shell\|pages/Course" apps/enrollment-mfe/src` 결과 없음

커밋: `refactor(enrollment-mfe): 신청 화면을 Module Federation remote로 분리(NFR-07)`

---

## T4. 합치기와 확인 (이 세션)

- 개발자 승인 후 두 워크트리 브랜치를 `feature/week6-mfe-split`에 병합(충돌은 의도 확인 후 정리)
- `npm test`(전체) — 테스트 수를 233과 비교, 줄었으면 이유 보고. 세 앱 `build`
- `.claude/launch.json`에 shell·enrollment-mfe 추가, 세 앱 + 백엔드 실행, 설계 5장 1~8 확인(dev 모드 + 빌드·preview 모드의 6번)
- `frontend/CLAUDE.md` 구조·명령 갱신(확인한 명령만)

커밋: `docs(frontend): MFE 구조와 실행 명령 갱신(NFR-07)` (+ 병합 커밋)

## T5. 최종 검토와 PR

- critical-reviewer: 설계명세 + `git diff main...` + T1~T3 검토 + T4 결과. 중점: shared singleton(두 벌 위험), remote 경계 import, 토큰·401 흐름, 오류 경계, 테스트 누락, 기능 변화 없음
- PR 본문: 교재와 다른 점(설계 7장), 병렬 진행 기록(세션별 결과), 후속(Step 4 한 주소 배포, FR-09)

## 위험 영역

| 위험 | 대응 |
|---|---|
| Mantine·React 두 벌 → 모달·알림이 안 뜸, Hook 오류 | shared 목록을 T1에서 정하고 T2·T3는 그대로 복사, T4-6 확인 |
| T2·T3가 공통 파일을 고쳐 충돌 | 범위 밖 수정 금지, 필요하면 멈추고 보고 |
| 테스트가 옮기며 빠짐 | 작업마다 테스트 수 보고, T4에서 233과 비교 |
| 워크트리에 `node_modules` 없음 | 워크트리 세션 시작 시 `npm install` |
| 큰 diff | 단계별 커밋, `git mv`로 이름 바뀜 기록 |
