# 구현계획: course-mfe 화면 Mantine 전환

- 설계명세: `docs/design/UI-mantine.md`. 이 계획에 없는 결정은 설계명세를 따른다.
- 상태: 승인됨 (2026-11-19)
- 브랜치: `feature/week2-mantine-ui` (FR-01~03이 2주차)
- 진행: 작업마다 implementer가 구현하고 reviewer가 검토한다. 심각·경고는 수정·재검토 최대 2회. 끝나면 critical-reviewer가 최종 검토한다.
- 공통 제약: 훅(`src/hooks/*`), `src/api/*`, `packages/api-client/src`는 바꾸지 않는다. 화면 동작·문구·`aria-label`은 유지한다.
- 모든 작업의 완료 명령은 `frontend/`에서 실행하고 실제 출력(테스트 수·실패 수, 빌드 결과)으로 보고한다.
  - `npm test` (vitest, course-mfe)
  - `npm run build -w apps/course-mfe` (tsc + vite build)

## 작업 순서

```
T1 Mantine 도입(MUI와 잠시 공존) ─> T2 FR-01 목록 ─> T3 FR-02 상세 ─> T4 FR-03 관리자 ─> T5 MUI 제거·문서
```
작업마다 빌드·테스트가 통과하는 상태로 끝나도록, T1~T4 동안은 MUI와 Mantine이 함께 있고 T5에서 MUI를 뺀다.

---

## T1. Mantine 도입과 테마·테스트 기반

변경 파일
- `apps/course-mfe/package.json`, `package-lock.json`: `@mantine/core`, `@mantine/hooks` `^8.3.18` 추가 (`npm install -w apps/course-mfe`)
- 새로 만듦: `src/theme.ts` (설계명세 2절)
- `src/main.tsx`: `MantineProvider`(+ `@mantine/core/styles.css`)를 바깥에 추가. MUI `ThemeProvider`는 T5까지 안쪽에 남긴다
- `src/constants/statusLabels.ts`: `COURSE_STATUS_COLOR`, `SESSION_STATUS_COLOR` 추가
- `src/test/setup.ts`: `matchMedia`, `ResizeObserver`, `scrollIntoView` 대체 구현
- 새로 만듦: `src/test/render.tsx`: `renderWithProviders(ui)` = `render(<MantineProvider theme={theme}>{ui}</MantineProvider>)`

완료: `npm test`, `npm run build -w apps/course-mfe` 통과 (화면은 아직 MUI)

## T2. FR-01 과정 목록

- `src/pages/CourseListPage.tsx`: 설계명세 3절 FR-01대로 Mantine으로 바꾼다.
- `src/pages/CourseListPage.test.tsx`: `render` → `renderWithProviders`. 단언은 그대로.

## T3. FR-02 과정 상세

- `src/pages/CourseDetailPage.tsx`, `src/pages/CourseDetailPage.test.tsx` (같은 방식).
- 테스트 추가: 남은 자리 0인 회차는 "정원 마감"을 보여 준다.

## T4. FR-03 관리자 화면과 대화상자

- `src/pages/AdminCourseListPage.tsx`, `src/pages/AdminCoursePage.tsx`, `src/components/CourseFormDialog.tsx`, `src/components/SessionFormDialog.tsx`
- 테스트 2개: `renderWithProviders`로 바꾸고, 분류 선택은 Mantine `Select` 조작으로 바꾼다. 나머지 단언은 그대로.
- Mantine `Modal`은 열고 닫을 때 전환 효과가 있다. 테스트가 흔들리면 `renderWithProviders`의 테마에서 전환을 끄지 말고(실제와 달라짐) `findBy`로 기다린다.

## T5. MUI 제거와 문서

- `package.json`에서 `@mui/material`, `@emotion/react`, `@emotion/styled` 제거, `main.tsx`에서 MUI Provider 제거. `grep -r "@mui" src`가 비어야 한다.
- 문서: 루트 `CLAUDE.md` 디렉터리 표(MUI → Mantine 8, course-mfe 코드 있음), `frontend/CLAUDE.md` UI 절(Mantine 8.3, 9는 React 19.2 필요해 React 19 전환 때 함께 올림)과 실제 확인한 명령, `docs/requirements.md` 기술 스택 줄.
- 완료: `npm test`, `npm run build -w apps/course-mfe` 통과. dev 서버로 4화면 확인(메인 세션이 수행).

---

# 2차: 업무 포털형 (설계명세 6절)

- 상태: 승인됨 (2026-11-19, A안 선택). T5(MUI 제거·문서)는 R5 뒤로 미루고 R6으로 바꾼다.
- 완료 명령은 1차와 같다(`frontend/`에서 `npm test`, `npm run build -w apps/course-mfe`). 화면은 작업마다 메인 세션이 dev 서버로 확인한다.

```
R1 의존성·테마·공용 컴포넌트 ─> R2 AppLayout ─> R3 FR-01 목록 ─> R4 FR-02 상세 ─> R5 FR-03 관리자 ─> R6 MUI 제거·문서
```

## R1. 의존성·테마·공용 컴포넌트
- `package.json`/lock: 6.1절 패키지 4개.
- `theme.ts`(6.2), `main.tsx`(Pretendard css, `@mantine/notifications/styles.css`, `ModalsProvider`, `Notifications`; MUI Provider는 R6까지 유지), `constants/categories.ts`에 `CATEGORY_COLOR`.
- 새로 만듦: `components/PageHeader.tsx`, `components/EmptyState.tsx`. `test/render.tsx`에 ModalsProvider·Notifications 추가.
- 테스트: PageHeader·EmptyState 간단 렌더 테스트.

## R2. 앱 뼈대
- 새로 만듦: `layout/AppLayout.tsx`, `layout/AppLayout.test.tsx` (6.3, 6.7). `main.tsx`에서 감싼다.

## R3. FR-01 과정 목록 (6.4)
- `pages/CourseListPage.tsx`, 테스트. 필요하면 `components/CourseCard.tsx`.

## R4. FR-02 과정 상세 (6.5)
- `pages/CourseDetailPage.tsx`, 테스트. 필요하면 `components/SessionCard.tsx`.

## R5. FR-03 관리자 (6.6)
- `pages/AdminCourseListPage.tsx`, `pages/AdminCoursePage.tsx`, `components/CourseFormDialog.tsx`, `components/SessionFormDialog.tsx`(Drawer로, 파일 이름은 유지), 테스트 2개.

## R6. MUI 제거와 문서 (1차 T5 내용 그대로)
- MUI·emotion 제거, `grep -r "@mui" src` 비어야 함. 루트 `CLAUDE.md`, `frontend/CLAUDE.md`(Mantine 8.3·이유, 추가 패키지, 확인한 명령), `docs/requirements.md` 기술 스택.
