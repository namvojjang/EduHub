# 설계명세: 관리자 회차 명단·교육 완료·수료 처리 화면 (FR-08 프론트엔드)

- 상태: 승인됨 (2026-11-27, Q1~Q6 권장안)
- 관련: FR-08(명단·수료), D-01(교육 완료 시 남은 대기 취소), D-05(교육 완료 뒤에만, 확정만 수료·**미수료**), NFR-03(관리자만), NFR-04(생성 클라이언트), NFR-07(6회차 MFE 분리)
- 백엔드: `docs/design/FR-08-roster-completion.md`(PR #9, 이미 있음). **이번에 백엔드는 바꾸지 않는다**
- 참고: 교육 5회차 Step 16. 교재는 MUI. 과정 등록·수정·종료 화면(FR-03)은 이미 있다(`AdminCourseListPage`, `AdminCoursePage`). 그래서 이번 범위는 **명단 화면**뿐이다 (7장)
- 범위 밖: 백엔드 변경, 과정 등록·수정 화면 변경(명단 링크 추가만), 교재의 dev 기본 데이터(과정 3개)

## 1. 요구사항 정리

| ID | 이번에 지킬 것 |
|---|---|
| FR-08 | 관리자가 회차별 **확정자**(확정·수료·미수료)와 **대기자**(대기 순번 순)를 본다 |
| D-05 | 수료 처리는 **회차가 교육 완료(COMPLETED)된 뒤**, **확정 신청만**. 결과는 **수료 또는 미수료** |
| D-01 | "교육 완료" 처리 시 남은 대기는 서버가 취소한다. 화면은 확인 창에서 이를 알린다 |
| FR-08 API | 일부만 처리될 수 있다. `processed`(처리된 사원)와 `failed`(사원·code·reason)를 모두 보여 준다 |
| NFR-03 | `/admin/sessions/:sessionId/roster`는 `RequireAuth admin`. 실제 차단은 백엔드 403 |

## 2. 흐름 (교재와 다른 핵심)

교재: 선택 → "수료 처리"(시작 전이면 409).
이 프로젝트(D-05, PR #9): **① 회차 교육 완료 → ② 확정자 선택 → 수료 또는 미수료 처리**.

| 회차 상태 | 화면 |
|---|---|
| 모집 중·모집 마감 | 명단은 보인다. 체크박스·처리 버튼은 비활성. 안내: "교육 완료 처리 후 수료를 기록할 수 있습니다." + **"교육 완료 처리"** 버튼. 시작 전에 누르면 서버 409 문구(`SESSION_NOT_STARTED`)를 보여 준다 |
| 교육 완료 | "교육 완료" 표시. 확정(아직 기록 안 된) 행만 체크 가능. **"선택한 N명 수료 처리"**, **"선택한 N명 미수료 처리"** 두 버튼 |

## 3. 구조

```
apps/course-mfe/src/
├── api/clients.ts                    # 수정: enrollmentAdminApi = new EnrollmentAdminApi(undefined, '', http)
├── enrollment/                       # → 6회차 enrollment-mfe
│   ├── useRoster.ts                  # 새: 명단 조회 훅 (sessionId, reloadKey) — ignore 패턴, 재조회 시 data 유지
│   ├── useRosterActions.ts           # 새: completeSession, recordCompletions (pending, 중복 방지 ref)
│   ├── rosterLabels.ts               # 새: 실패 code → 문구, 상태 라벨 재사용(enrollmentLabels)
│   └── RosterPage.tsx                # 새: /admin/sessions/:sessionId/roster
├── pages/AdminCoursePage.tsx         # 수정: 회차 표 각 행에 "명단" 링크 (모든 상태)
└── App.tsx                           # 수정: 라우트 (RequireAuth admin)
```

- `RosterPage`는 `enrollment/`에 둔다(교재 위치, 신청 도메인). `pages/`를 import하지 않는다
- 관리자 과정 화면(`pages/AdminCoursePage`, course-mfe)이 명단으로 가는 것은 **링크(URL)만**이다. 컴포넌트 import가 없어서 6회차 분리에 영향이 없다

## 4. 화면 (`RosterPage`)

### 4-1. 머리
- 뒤로: "← 과정 관리로"(`/admin/courses/{courseId}`)
- 제목: "{과정명} 명단", 부제: "{시작 일시} · 정원 {capacity}명", 회차 상태 Badge(기존 `SESSION_STATUS_LABEL`·색은 `constants/`라 import 불가 → `rosterLabels`에 같은 값을 둔다. 8장 Q4)
- 회차가 교육 완료가 아니면 안내 Alert + "교육 완료 처리" 버튼(2장)

### 4-2. 확정자 표 (`Table`, `Table.ScrollContainer`)
- 열: 선택(Checkbox) · 이름 · 사번 · 상태 Badge(확정/수료/미수료, "대기에서 확정" 표시) · 확정일
- 머리 행의 "전체 선택" Checkbox(선택 가능한 행만, indeterminate 지원)
- 체크 가능: 회차 COMPLETED이고 행 상태 CONFIRMED. 그 밖은 비활성
- 이름이 null(사원 행 없는 옛 데이터)이면 "(알 수 없음)"
- 체크박스 `aria-label`: "{이름 또는 사번} 선택"
- 0명이면 EmptyState "확정된 신청자가 없습니다."

### 4-3. 대기자 표
- 열: 순번("대기 N번") · 이름 · 사번 · 신청일. 0명이면 EmptyState "대기자가 없습니다."
- 교육 완료된 회차에는 대기자가 없다(서버가 취소)

### 4-4. 처리
- **교육 완료 처리**: `modals.openConfirmModal`("교육을 완료 처리할까요? 남은 대기 신청 N건은 취소됩니다. 되돌릴 수 없습니다.") → `completeSession` → 알림 "교육 완료로 처리했습니다." → 재조회. 실패는 빨간 알림(409 code별 문구, 4-5)
- **수료 / 미수료 처리**: 확인 모달("선택한 N명을 수료(미수료)로 기록합니다. 되돌릴 수 없습니다.") → `recordCompletions({ result, employeeIds })` → 결과 Alert(페이지 위, 닫기 가능)
  - 전부 처리: teal "N명을 수료 처리했습니다." / "N명을 미수료 처리했습니다."
  - 일부 실패: yellow, 처리 인원 + 실패 목록 "이름(사번): 사유"(사원 ID를 명단에서 찾아 이름으로)
  - 그 뒤 선택 해제, 재조회
- 중복 실행 방지: 모달 하나당 1회 플래그 + 요청 중 ref(Step 15의 취소와 같은 방식)
- 화면을 떠나면 열린 모달 닫기(Step 15 S4와 같은 방식)

### 4-5. 오류 문구 (`rosterLabels`)

| 상황 | 문구 |
|---|---|
| 조회 403 | "관리자만 볼 수 있습니다." |
| 조회 404 `SESSION_NOT_FOUND` | "회차를 찾을 수 없습니다." + 과정 관리로 버튼 |
| 409 `SESSION_NOT_STARTED` | "회차 시작 전에는 교육 완료로 처리할 수 없습니다." |
| 409 `SESSION_ALREADY_COMPLETED` | "이미 교육 완료된 회차입니다." (재조회) |
| 409 `SESSION_NOT_COMPLETED` | "교육 완료 처리 후 수료를 기록할 수 있습니다." (재조회) |
| 실패 code `NOT_ENROLLED`·`WAITING`·`CANCELLED`·`ALREADY_RECORDED` | "신청 없음"·"대기 중"·"취소됨"·"이미 기록됨" (없으면 서버 `reason`) |
| 401 | 알림 없음(인터셉터가 로그인 화면으로) |
| 그 밖 | `getErrorMessage(e)` |

## 5. 테스트 (Vitest)

| ID | 시나리오 |
|---|---|
| R1 | 명단 표시: 확정자 이름·사번·상태, 대기 "대기 1번", `getRoster(4)` |
| R2 | 회차 모집 중: 체크박스·수료 버튼 비활성, "교육 완료 처리" 버튼 보임 |
| R3 | 교육 완료 처리 확인 → `completeSession(4)` → 재조회. 409 `SESSION_NOT_STARTED` → 문구 |
| R4 | 교육 완료 회차: 확정 행 선택 → "선택한 1명 수료 처리" → 확인 → `recordCompletions(4, { result: 'COMPLETED', employeeIds: [1] })` → "1명을 수료 처리했습니다." |
| R5 | 미수료 처리 → `result: 'NOT_COMPLETED'` |
| R6 | 일부 실패 → 처리 인원 + "김사원(E1001): 이미 기록됨" |
| R7 | 수료·미수료 행은 체크 불가, 전체 선택은 선택 가능한 행만 |
| R8 | 조회 403 → "관리자만 볼 수 있습니다." |
| R9 | 모달 확인 연타 → 요청 1회 |
| R10 | useRoster 늦은 응답 무시(sessionId 변경) |
| L1 | AdminCoursePage 회차 행에 명단 링크 `/admin/sessions/{id}/roster` |

브라우저 확인(메인 세션):
1. A0001 → 과정 관리 → 과정 → 회차 "명단" → 확정자·대기자
2. 시작 전 회차에서 "교육 완료 처리" → 409 문구
3. **시작이 지난 회차**: 관리자 화면으로 2~3분 뒤 시작하는 회차를 만들고(`@Future` 검증 때문에 과거로는 못 만든다) E1001·E1002가 신청 → 시작 시각이 지난 뒤 교육 완료 처리 → 대기 취소 확인
4. E1001 수료, E1002 미수료 → 결과와 상태 Badge
5. E1001로 내 신청 내역 → "수료"
6. E1002로 `/admin/sessions/{id}/roster` → "관리자만 사용할 수 있는 화면입니다."

## 6. 위험

| 위험 | 대응 |
|---|---|
| 되돌릴 수 없는 처리(교육 완료, 수료 기록)를 실수로 실행 | 확인 모달에 "되돌릴 수 없습니다", 대기 취소 건수 표시 |
| 연타로 이중 요청 | 모달 1회 플래그 + 요청 중 ref, R9. 서버도 회차 락과 `ALREADY_RECORDED`로 막음 |
| 처리 후 화면이 서버와 다름 | 성공·409 후 재조회 |
| enrollment → pages/constants 의존 | 라벨을 `enrollment/`에 둠(Q4), grep 확인 |
| 확인용 데이터(시작 지난 회차) 만들기 어려움 | 2~3분 뒤 시작 회차 방식(5장). 교재의 dev 기본 데이터는 별도 작업 |

## 7. 교재와 다르게 하는 것

| 교재 | 이 프로젝트 |
|---|---|
| `CourseFormPage`(과정 등록·수정·종료) 새로 작성 | 이미 있음(`AdminCourseListPage`, `AdminCoursePage`, PR #6·#7). 회차 행에 "명단" 링크만 추가 |
| 선택 → 바로 수료 처리 | **교육 완료 → 수료/미수료**(D-05) |
| 수료만 | 수료·**미수료** 두 버튼 |
| `complete(sessionId, { employeeIds })`, `completed`, `waitingNo`, `startDate` | `completeSession`·`recordCompletions(sessionId, { result, employeeIds })`, `processed`, `waitingNumber`, `sessionStartAt` |
| 실패를 사원 ID로 | 이름(사번) + code별 문구 |
| MUI `List`·`Chip` | Mantine `Table`·`Badge`·`Checkbox`·`modals` |
| 목록 `ListItemText` "김사원 (E1001)" | 이름·사번 열 분리 |

## 8. 질문과 결정

| # | 질문 | 권장 |
|---|---|---|
| Q1 | 명단 링크를 어디에 둘까? | **관리자 과정 화면의 회차 표 각 행**(모든 상태). 공개 상세에는 두지 않는다(교재는 상세에 관리자용 링크를 둠). 관리 기능은 관리 화면에 모은다 |
| Q2 | 미수료 처리도 이번에 화면에 넣을까? | **넣는다.** D-05 결정 사항이고 API가 이미 있다. 버튼 하나 차이 |
| Q3 | "교육 완료 처리" 버튼을 명단 화면에 둘까, 과정 관리의 회차 메뉴에 둘까? | **명단 화면.** 교육 완료 → 수료 기록이 한 화면에서 이어진다. 과정 관리 메뉴는 지금처럼 수정·모집 마감만 |
| Q4 | 회차 상태 라벨(`constants/statusLabels`)을 enrollment에서 쓸까? | **`enrollment/rosterLabels.ts`에 회차 상태 라벨을 따로 둔다**(3개 값). 6회차에 공용 패키지로 합친다. 지금 `constants/`를 import하면 분리 규칙(frontend/CLAUDE.md)을 어긴다 |
| Q5 | 부서 열(캡처 화면)을 넣을까? | **넣지 않는다.** 사원 테이블·명단 API에 부서가 없다. 필요하면 백엔드 작업(NFR-03 사원 정보)으로 따로 |
| Q6 | 교재 dev 기본 데이터(과정 3개, 시작 지난 회차에 확정 2명)를 이번에 넣을까? | **이번엔 하지 않는다**(백엔드 변경). 다음 작업으로 제안. 브라우저 확인은 5장 방식으로 |
