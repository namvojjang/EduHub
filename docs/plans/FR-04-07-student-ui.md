# 구현계획: 수강생 화면 — 회차 신청, 내 신청 내역, 취소 (FR-04~07 프론트엔드)

- 설계명세: `docs/design/FR-04-07-student-ui.md` (승인됨 2026-11-26, Q1~Q5 권장안). 이 계획에 없는 결정은 설계명세를 따른다.
- 상태: 승인됨 (2026-11-26, "교재 순서대로 빨리 진행해")
- 브랜치: `feature/week4-fr-04-07-student-ui`
- 진행: 작업마다 implementer 구현 → reviewer 검토. 심각·경고는 수정·재검토 최대 2회. 모든 작업 후 critical-reviewer 최종 검토, 지적은 고치기 전에 개발자에게.
- 공통 제약: React 18 + TypeScript, Mantine 8.3(MUI 금지), react-router-dom 6, 생성 클라이언트 `@eduhub/api-client`만(생성 코드 수정 금지), `frontend/CLAUDE.md`. 경로는 `frontend/apps/course-mfe/src/` 기준. **`enrollment/`는 `pages/`와 과정 전용 훅·컴포넌트를 import하지 않는다**(공용 `components/EmptyState`, `components/SessionCard`의 `formatDateTime`, `api/`, `auth/`는 허용 — 설계 Q2).
- 완료 명령(`frontend/`): `npm test`, `npm run build -w apps/course-mfe`. 실제 출력으로 보고.
- 서브에이전트는 개발 서버·백엔드를 띄우지 않는다. 브라우저 확인은 메인 세션.
- 커밋: Conventional Commits + 한국어, `FR-04`~`FR-07` 참조. 메인 세션이 검토 통과 후.
- 규모(CLAUDE.md 절차 5): 파일 10여 개, 프론트 한 계층. 작업마다 결과를 개발자에게 보고한다.

## 단계별로 개발자가 직접 할 일

| 작업 | 직접 할 일 |
|---|---|
| T1·T2 | 없음 (결과 확인) |
| T3 | (선택) 브라우저에서 직접 신청·취소해 보기 |
| T4 | 최종 검토 지적 결정, PR 병합 |

## 작업 순서

```
T1 신청 버튼·상세 화면 ─> T2 내 신청 내역·취소·메뉴 ─> T3 브라우저 확인 ─> T4 최종 검토·PR
```

---

## T1. 신청 버튼과 과정 상세

변경 파일
- 수정: `api/clients.ts` — `enrollmentApi = new EnrollmentApi(undefined, '', http)`
- 새로: `enrollment/enrollmentLabels.ts` — 상태 라벨·색(설계 3-3, NOT_COMPLETED 포함), `enrollmentErrorMessage(e)`(409 code 표, 그 밖은 `getErrorMessage`)
- 새로: `enrollment/useEnrollmentActions.ts` — `pending`, `apply(sessionId)`(`applyEnrollment({ sessionId })`), `cancel(enrollmentId)`(`cancelEnrollment`). `useCourseAdminActions` 모양
- 새로: `enrollment/EnrollButton.tsx` — 설계 3-4. props `sessionId`, `disabledReason?`, `onApplied?`. 비로그인 링크는 `state={{ from: location.pathname + location.search }}`
- 수정: `components/SessionCard.tsx` — 비활성 "신청하기"·Tooltip·"수강 신청 화면 준비 중" 제거, `action?: ReactNode`를 그 자리에
- 수정: `hooks/useCourseDetail.ts` — 같은 id에서 reloadKey만 바뀌면 이전 `data`를 유지하고 `loading`만 true(설계 Q3). id가 바뀌면 지금처럼 비운다
- 수정: `pages/CourseDetailPage.tsx` — `reloadKey` 상태, 회차마다 `action={<EnrollButton … />}`. `disabledReason`: 과정 `CLOSED` → "종료된 과정입니다", 회차 `status !== 'RECRUITING'` → 라벨("모집 마감"/"교육 완료"). Skeleton은 `loading && !data`일 때만
- 테스트: `enrollment/EnrollButton.test.tsx`(E1~E5), `enrollment/enrollmentLabels.test.ts`(코드별 문구), `components/SessionCard.test.tsx`(action 슬롯으로 수정), `pages/CourseDetailPage.test.tsx`(D1, `renderWithAuth`로), `hooks/useCourseDetail.test.ts`(reloadKey 시 data 유지)

완료 명령: `npm test` + `npm run build -w apps/course-mfe`

커밋: `feat: 과정 상세에 회차 신청 버튼 추가(FR-04, FR-05, D-03)`

---

## T2. 내 신청 내역, 취소, 메뉴

변경 파일
- 새로: `enrollment/useMyEnrollments.ts` — 설계 3-6(`ignore` 패턴, status·reloadKey)
- 새로: `enrollment/MyEnrollmentsPage.tsx` — 설계 3-7(SegmentedControl 필터, Table.ScrollContainer, 상태 Badge·"대기 N번"·"대기에서 확정", 취소 확인 모달 → 알림 → 재조회, EmptyState)
- 수정: `App.tsx` — `/my/enrollments` + `RequireAuth`
- 수정: `layout/AppLayout.tsx` — "내 신청 내역" NavLink 활성화(`Link to="/my/enrollments"`, active, onClick close)
- 수정: `frontend/CLAUDE.md` — 구조에 "`src/enrollment/`는 6회차 enrollment-mfe, pages를 import하지 않는다" 한 줄
- 테스트: `enrollment/MyEnrollmentsPage.test.tsx`(M1~M4), `enrollment/useMyEnrollments.test.ts`(U1), `layout/AppLayout.test.tsx`(L1 수정)

완료 명령: `npm test` + `npm run build -w apps/course-mfe` + `grep -rn "from '../pages\|from '../hooks" src/enrollment` 결과 없음

커밋: `feat: 내 신청 내역과 신청 취소 화면 추가(FR-06, FR-07, D-05)`

---

## T3. 브라우저 확인 (메인 세션)

- 백엔드(dev)와 course-mfe를 띄우고 설계 5장 브라우저 1~6을 확인, 스크린샷을 보인다
- 확인 중 생긴 dev DB 신청은 보고한다

## T4. 최종 검토와 PR

- `npm test`, `npm run build`, 백엔드 변경 없음 확인
- critical-reviewer: 설계명세 + `git diff main...` + T1·T2 검토 + T3 결과. 중점: 신청 결과를 서버 응답으로만 표시, 중복 클릭, 늦은 응답, enrollment → pages 의존, 401/403 흐름, 6회차 분리 경계
- PR 본문: 교재와 다른 점(설계 8장), Q1 백엔드와 다른 점, Step 16에서 이어질 것

## 위험 영역

| 위험 | 대응 |
|---|---|
| reloadKey 재조회 때 결과 표시가 사라짐 | useCourseDetail data 유지 + 테스트, T3-3 |
| useCourseDetail 변경이 관리자 화면에 영향 | 기존 AdminCoursePage 테스트 통과 확인 |
| 필터 전환 시 늦은 응답 | U1 |
| 코드 대신 백엔드 메시지(ID 포함) 노출 | enrollmentLabels 테스트 |
