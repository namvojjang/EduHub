# 구현계획: 관리자 회차 명단·교육 완료·수료 처리 화면 (FR-08 프론트엔드)

- 설계명세: `docs/design/FR-08-roster-ui.md` (승인됨 2026-11-27, Q1~Q6 권장안). 이 계획에 없는 결정은 설계명세를 따른다.
- 상태: 승인됨 (2026-11-27, "승인, T1 시작")
- 브랜치: `feature/week4-fr-08-roster-ui`
- 진행: 작업마다 implementer 구현 → reviewer 검토. 심각·경고는 수정·재검토 최대 2회. 모든 작업 후 critical-reviewer 최종 검토, 지적은 고치기 전에 개발자에게.
- 공통 제약: React 18 + TypeScript, Mantine 8.3, react-router-dom 6, 생성 클라이언트 `@eduhub/api-client`만(생성 코드 수정 금지), `frontend/CLAUDE.md`. 경로는 `frontend/apps/course-mfe/src/` 기준. **`enrollment/`는 `pages/`, `hooks/`, `constants/`, 과정 전용 컴포넌트를 import하지 않는다**(공용 `EmptyState`, `formatDateTime`, `api/`, `auth/`, 같은 폴더 `enrollmentLabels`는 허용).
- 백엔드 변경 없음.
- 완료 명령(`frontend/`): `npm test`, `npm run build -w apps/course-mfe`. 실제 출력으로 보고.
- 서브에이전트는 개발 서버·백엔드를 띄우지 않는다. 브라우저 확인은 메인 세션.
- 커밋: Conventional Commits + 한국어, `FR-08`·`D-05` 참조. 메인 세션이 검토 통과 후.
- 규모(CLAUDE.md 절차 5): 새 파일 4개 + 수정 3개 + 테스트, 프론트 한 계층. 작업마다 결과를 개발자에게 보고한다.

## 단계별로 개발자가 직접 할 일

| 작업 | 직접 할 일 |
|---|---|
| T1·T2 | 없음 (결과 확인) |
| T3 | (선택) 브라우저에서 직접 교육 완료·수료 처리해 보기 |
| T4 | 최종 검토 지적 결정, PR 병합 |

## 작업 순서

```
T1 명단 조회·링크 ─> T2 교육 완료·수료/미수료 처리 ─> T3 브라우저 확인 ─> T4 최종 검토·PR
```

---

## T1. 명단 조회 화면과 링크 (읽기 전용)

변경 파일
- 수정: `api/clients.ts` — `enrollmentAdminApi = new EnrollmentAdminApi(undefined, '', http)`
- 새로: `enrollment/rosterLabels.ts` — 회차 상태 라벨·색 3개(설계 Q4), 조회 오류 문구(403·404, 설계 4-5)
- 새로: `enrollment/useRoster.ts` — `(sessionId, reloadKey)`, `ignore` 패턴, 같은 sessionId 재조회 시 `data` 유지, `error`는 unknown
- 새로: `enrollment/RosterPage.tsx` — 설계 4-1~4-3(머리, 확정자 표, 대기자 표, EmptyState, 404·403). 체크박스·버튼은 T2에서
- 수정: `App.tsx` — `/admin/sessions/:sessionId/roster` + `RequireAuth admin`
- 수정: `pages/AdminCoursePage.tsx` — 회차 표 각 행(모든 상태)에 "명단" 링크
- 테스트: `enrollment/RosterPage.test.tsx`(R1, R8, 404), `enrollment/useRoster.test.ts`(R10), `pages/AdminCoursePage.test.tsx`(L1 추가)

완료 명령: `npm test` + `npm run build -w apps/course-mfe` + `grep -rn "from '../pages\|from '../hooks\|from '../constants" src/enrollment` 결과 없음

커밋: `feat: 관리자 회차 명단 화면 추가(FR-08)`

---

## T2. 교육 완료와 수료·미수료 처리

변경 파일
- 새로: `enrollment/useRosterActions.ts` — `pending`, `completeSession(sessionId)`, `recordCompletions(sessionId, result, employeeIds)`
- 수정: `enrollment/rosterLabels.ts` — 409 code 문구, 실패 code(`NOT_ENROLLED`·`WAITING`·`CANCELLED`·`ALREADY_RECORDED`) 문구, `rosterErrorMessage(e): string | null`(401 → null)
- 수정: `enrollment/RosterPage.tsx` — 설계 2장·4-4: 교육 완료 안내 + 확인 모달(대기 N건 취소 안내), 체크박스(교육 완료 회차의 CONFIRMED만)·전체 선택(indeterminate), 수료/미수료 버튼·확인 모달, 결과 Alert(전부/일부 실패, 이름(사번): 사유), 선택 해제·재조회, 409 후 재조회, 모달 1회 플래그 + 요청 중 ref, 떠날 때 모달 닫기
- 테스트: `enrollment/RosterPage.test.tsx`(R2~R7, R9 추가), `enrollment/rosterLabels.test.ts`

완료 명령: T1과 같음

커밋: `feat: 명단 화면에 교육 완료와 수료·미수료 처리 추가(FR-08, D-05, D-01)`

---

## T3. 브라우저 확인 (메인 세션)

- 백엔드(dev)와 course-mfe를 띄우고 설계 5장 브라우저 1~6을 확인, 결과를 보인다
- 시작 지난 회차: 관리자 화면에서 2~3분 뒤 시작 회차를 만들고 신청 후 대기
- 확인 중 생긴 dev DB 데이터(과정·회차·신청)는 보고한다

## T4. 최종 검토와 PR

- `npm test`, `npm run build`, 백엔드 변경 없음 확인
- critical-reviewer: 설계명세 + `git diff main...` + T1·T2 검토 + T3 결과. 중점: 되돌릴 수 없는 처리의 중복 실행, 늦은 응답, 처리 후 화면과 서버 불일치, 일부 실패 표시, 401/403 흐름, enrollment 분리 경계
- PR 본문: 교재와 다른 점(설계 7장), Q1~Q6 결정, 후속 작업(교재 dev 기본 데이터)

## 위험 영역

| 위험 | 대응 |
|---|---|
| 확인 모달 연타로 이중 요청 | 모달 1회 플래그 + ref, R9 |
| 처리 후 표가 옛 상태 | 성공·409 후 재조회, 재조회 중 data 유지 |
| 실패 목록이 사원 ID로만 보임 | 명단에서 이름·사번 찾기, R6 |
| enrollment → constants 의존 | rosterLabels에 라벨 복제, grep |
| AdminCoursePage 변경으로 기존 테스트 깨짐 | 기존 테스트 통과 확인 |
