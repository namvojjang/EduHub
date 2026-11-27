# 설계명세: 수강생 화면 — 회차 신청, 내 신청 내역, 취소 (FR-04~07 프론트엔드)

- 상태: 승인됨 (2026-11-26, 9장 Q1~Q5 모두 권장안 — "교재 순서대로 빨리 진행해"). 구현계획: `docs/plans/FR-04-07-student-ui.md`
- 관련: FR-02(상세, 이미 있음), FR-04(신청), FR-05(대기 순번), FR-06(취소·자동 승급), FR-07(내 신청 내역), D-02·D-03·D-04·D-05, NFR-03(로그인), NFR-04(생성 클라이언트), NFR-07(6회차 MFE 분리)
- 참고: 교육 5회차 Step 15. 교재는 **MUI**지만 이 프로젝트는 **Mantine 8.3**이고, 과정 목록·상세 화면(FR-01·02)은 이미 있다 (8장)
- 범위 밖: 관리자 명단·수료 화면(Step 16), 백엔드 변경, 생성 코드 수정, 알림(FR-09)

## 1. 요구사항 정리

| ID | 이번에 지킬 것 |
|---|---|
| FR-04 | 과정 상세의 회차마다 신청 버튼. 로그인 안 했으면 "로그인 후 신청"(로그인 뒤 이 상세로 돌아옴) |
| FR-05 | 신청 결과는 **백엔드 응답**(`status`, `waitingNumber`)으로 보여 준다: "신청이 확정되었습니다." / "대기 N번으로 등록되었습니다." 화면이 정원을 계산하지 않는다 |
| D-03 | 같은 과정 유효 신청 1건, 수료한 과정 재신청 불가 → 409 코드별 안내 |
| FR-06·D-04 | 확정·대기 모두 회차 시작 전까지 본인이 취소. 확인 창을 거치고, 취소 뒤 목록을 다시 불러온다(대기자 승급은 서버가 한다) |
| FR-07·D-05 | 내 신청 내역: 상태 필터(전체·확정·대기·취소·수료·**미수료**), 대기는 "대기 N번", 대기에서 승급된 확정은 표시 |
| NFR-03 | `/my/enrollments`는 로그인 필요(`RequireAuth`). 실제 차단은 백엔드 401 |
| NFR-07 | 신청 관련 파일은 `src/enrollment/`에 둔다. 6회차에 `enrollment-mfe`가 되므로 **`enrollment/`는 `pages/`·`components/`·`hooks/`(과정 쪽)를 import하지 않는다** |

> D-06(2026-11-27)으로 대체(위 표 FR-04 행의 비로그인 "로그인 후 신청" 안내): 모든 화면은 로그인 후. `docs/design/D-06-login-first.md`

## 2. 구조

```
apps/course-mfe/src/
├── api/clients.ts                    # 수정: enrollmentApi 추가
├── enrollment/                       # 새 → 6회차: enrollment-mfe
│   ├── enrollmentLabels.ts           # 상태 라벨·색, 409 코드 → 안내 문구
│   ├── useEnrollmentActions.ts       # apply, cancel (pending 상태, 실패는 예외 그대로)
│   ├── useMyEnrollments.ts           # 조회 훅 (status, reloadKey)
│   ├── EnrollButton.tsx              # 회차 하나의 신청 버튼과 결과
│   └── MyEnrollmentsPage.tsx         # /my/enrollments
├── components/SessionCard.tsx        # 수정: 비활성 "신청하기" 자리를 action 슬롯으로
├── pages/CourseDetailPage.tsx        # 수정: SessionCard action에 EnrollButton, 신청 성공 시 상세 다시 불러오기
├── layout/AppLayout.tsx              # 수정: "내 신청 내역" 메뉴 활성화(/my/enrollments)
└── App.tsx                           # 수정: /my/enrollments (RequireAuth)
```

- `SessionCard`(과정 쪽 컴포넌트)는 `EnrollButton`을 import하지 않는다. `action?: ReactNode`를 받아 그 자리에 그린다. 신청 버튼을 끼우는 것은 페이지(`CourseDetailPage`)다.
- 과정 목록 → 상세 이동은 이미 `CourseCard`의 링크로 된다(교재의 `useNavigate` 변경 불필요).

## 3. 동작

### 3-1. `api/clients.ts`
- `enrollmentApi = new EnrollmentApi(undefined, '', http)` (토큰 첨부·401 처리 그대로)

### 3-2. `enrollment/useEnrollmentActions.ts`
- `useCourseAdminActions`와 같은 모양: `pending`, `apply(sessionId) → EnrollmentResponse`, `cancel(enrollmentId) → EnrollmentResponse`
- 실패는 예외를 그대로 던진다. 화면이 `enrollmentErrorMessage(e)`로 문구를 고른다

### 3-3. `enrollment/enrollmentLabels.ts`
- `ENROLLMENT_STATUS_LABEL`: CONFIRMED 확정, WAITING 대기, CANCELLED 취소, COMPLETED 수료, NOT_COMPLETED 미수료. 색도 같은 곳에
- `enrollmentErrorMessage(e)`: 409 `code`별 고정 문구. 백엔드 메시지는 `: 3` 같은 ID가 붙어 있어 화면에 그대로 쓰지 않는다

| code | 문구 |
|---|---|
| `DUPLICATE_ENROLLMENT` | 이미 이 과정에 신청했습니다. 내 신청 내역에서 확인하세요. |
| `ALREADY_COMPLETED_COURSE` | 이미 수료한 과정입니다. |
| `SESSION_NOT_RECRUITING` | 모집 중인 회차가 아닙니다. |
| `SESSION_ALREADY_STARTED` | 이미 시작된 회차라 취소할 수 없습니다. |
| `ENROLLMENT_NOT_CANCELLABLE` | 취소할 수 없는 신청입니다. |
| 그 밖 | `getErrorMessage(e)`(백엔드 message, 없으면 일반 문구) |

- 401은 여기서 다루지 않는다. `http`가 토큰을 지우고 로그인 화면으로 보낸다(로그인 화면 PR)

### 3-4. `enrollment/EnrollButton.tsx` (`{ sessionId, disabledReason? , onChanged? }`)
- 비로그인: `Button component={Link} to="/login" state={{ from: 현재 경로 }}` "로그인 후 신청" → 로그인 뒤 상세로 돌아온다
- `disabledReason`이 있으면(모집 마감·교육 완료 회차) 비활성 버튼 + 이유 문구(지금 SessionCard의 안내 방식 유지)
- 로그인: "신청하기" → `apply` 중에는 `loading`. 성공하면 버튼 자리에 결과 `Alert`(확정: teal "신청이 확정되었습니다." / 대기: blue "대기 N번으로 등록되었습니다.") + "내 신청 내역" 링크, 그리고 `onChanged()` 호출. 409 `SESSION_NOT_RECRUITING`으로 실패해도 호출한다(회차 상태가 낡았으므로). `DUPLICATE_ENROLLMENT`는 호출하지 않는다
- 실패: 버튼 아래 경고 문구(3-3). 버튼은 다시 누를 수 있다
- 분기 순서: 결과 → `disabledReason` → 비로그인 → 신청 버튼. 401은 문구를 띄우지 않는다(인터셉터가 로그인으로 보냄)

> D-06(2026-11-27)으로 대체(비로그인 분기 삭제): 모든 화면은 로그인 후. `docs/design/D-06-login-first.md`

### 3-5. `CourseDetailPage` 변경
- 회차마다 `<SessionCard … action={<EnrollButton sessionId=… disabledReason=… onChanged={reload} />} />`
- `disabledReason`: 회차 `status !== 'RECRUITING'`이면 "모집 마감" 또는 "교육 완료". 시작 시각 비교는 하지 않는다(서버가 409로 판단, 클라이언트 시계를 믿지 않음)
- 과정이 `CLOSED`일 때: **9장 Q1**
- `onChanged`: `useCourseDetail(id, reloadKey)`의 `reloadKey`를 올려 남은 자리를 새로 받는다. **단 EnrollButton의 결과 표시가 사라지지 않도록** 다시 불러오는 동안 화면 전체를 Skeleton으로 바꾸지 않는다(9장 Q3)

### 3-6. `enrollment/useMyEnrollments.ts`
- `useMyEnrollments(status?: MyEnrollmentStatus, reloadKey = 0)` → `{ data, loading, error }`. `useCourseDetail`과 같은 `ignore` 패턴(늦은 응답이 새 필터 결과를 덮지 않게)

### 3-7. `enrollment/MyEnrollmentsPage.tsx` (`/my/enrollments`, `RequireAuth`)
- 제목 "내 신청 내역", 상태 필터는 Mantine `SegmentedControl`(전체·확정·대기·취소·수료·미수료). 필터는 서버 쿼리 `status`로 보낸다
- 표(Mantine `Table`, 좁은 화면은 가로 스크롤 `Table.ScrollContainer`): 과정(상세 링크) · 시작 일시 · 장소 · 상태 Badge · 신청일 · 동작
  - 상태 Badge: 대기는 "대기 N번", 확정이면서 `promoted`면 "확정" 옆에 작은 "대기에서 확정" 표시
  - 취소 버튼: `CONFIRMED`·`WAITING`만. 시작 시각 비교는 하지 않는다(서버 409)
- 취소: `modals.openConfirmModal`("신청을 취소할까요?" + 확정이면 "대기 1순위가 있으면 자동으로 확정됩니다.") → `cancel` → 성공 알림 "신청을 취소했습니다." → `reloadKey` 증가. 실패는 빨간 알림(3-3 문구)
- 빈 목록: `EmptyState`("신청 내역이 없습니다." + "교육과정 보기" 버튼). 오류: 빨간 Alert
- `EmptyState`·`formatDateTime`은 지금 `components/`에 있다 → **9장 Q2**

### 3-8. 레이아웃·라우팅
- `App.tsx`: `<Route path="/my/enrollments" element={<RequireAuth><MyEnrollmentsPage /></RequireAuth>} />`
- `AppLayout`: "내 신청 내역" NavLink를 `Link to="/my/enrollments"`로 활성화(비활성·"4주차" 설명 제거), 현재 경로면 active. 비로그인도 보이고 누르면 로그인 화면 → 로그인 뒤 돌아옴(RequireAuth 동작)

## 4. 보안·정합성 메모
- 신청·취소 가능 여부의 최종 판단은 백엔드다(정원·중복·시작 시각·본인 확인). 화면은 버튼을 숨기거나 막는 **편의**만 한다
- 취소는 본인 신청만(백엔드 NFR-03). 화면은 내 내역에서만 취소 버튼을 보인다
- 중복 클릭: `loading` 동안 버튼 비활성. 그래도 두 번 가면 서버가 `DUPLICATE_ENROLLMENT`(DB 유일 제약)로 막는다

## 5. 테스트 (Vitest + Testing Library)

| ID | 대상 | 시나리오 |
|---|---|---|
| E1 | EnrollButton | 비로그인 → "로그인 후 신청" 링크가 `/login` |
| E2 | EnrollButton | 확정 응답 → "신청이 확정되었습니다.", `apply(7)` 호출, `onChanged` 호출 |
| E3 | EnrollButton | 대기 응답(`waitingNumber: 2`) → "대기 2번으로 등록되었습니다." |
| E4 | EnrollButton | 409 `DUPLICATE_ENROLLMENT` → 안내 문구, 버튼 다시 누를 수 있음 |
| E5 | EnrollButton | `disabledReason` → 비활성 버튼과 이유 |
| M1 | MyEnrollmentsPage | 목록 표시: 대기 "대기 N번", 승급 표시, 취소 버튼은 확정·대기만 |
| M2 | MyEnrollmentsPage | 필터 "대기" → `listMyEnrollments('WAITING')` |
| M3 | MyEnrollmentsPage | 취소 확인 → `cancelEnrollment(id)` → 목록 다시 조회 |
| M4 | MyEnrollmentsPage | 빈 목록 → EmptyState |
| U1 | useMyEnrollments | 필터를 빨리 바꾸면 늦은 응답을 버린다 |
| D1 | CourseDetailPage | 모집 중 회차에 신청 버튼, 모집 마감 회차는 비활성 (기존 테스트 확장) |
| L1 | AppLayout | "내 신청 내역"이 `/my/enrollments` 링크 (기존 테스트 수정) |

- 화면 테스트는 `vi.mock('../api/clients')`로 `enrollmentApi`를 대체한다. 로그인 상태는 `renderWithAuth` + `tokenStore.save`

브라우저 확인(메인 세션, 교재 6-2의 1~6):
1. 비로그인 → Spring Boot 입문 상세: 회차마다 "로그인 후 신청"
2. 비로그인 `/my/enrollments` → 로그인 화면 → E1001 → 내 신청 내역으로 돌아옴, Git 협업 기초(확정)
3. E1001로 정원 1 회차 신청 → "신청이 확정되었습니다.", 남은 자리 0
4. E1002로 같은 회차 → "대기 1번으로 등록되었습니다.", 내역 필터 "대기"에 대기 1번
5. E1002로 `/admin/courses` → 관리자 전용 경고 (명단 화면은 Step 16이라 대신 이 경로로 확인)
6. E1001이 취소 → 취소 상태 → E1002로 로그인하면 확정 + "대기에서 확정"
- 확인 후 dev DB에 남은 신청은 보고한다(화면으로 취소할 수 있는 것은 취소)

## 6. 영향 범위
- 기존 `SessionCard` 테스트: 비활성 "신청하기"·"수강 신청 화면 준비 중" 확인 부분을 action 슬롯 기준으로 바꾼다
- 기존 `CourseDetailPage` 테스트: 렌더에 `AuthProvider`가 필요해진다(EnrollButton이 `useAuth`) → `renderWithAuth`로 바꾼다
- `SessionCard`는 `CourseDetailPage`에서만 쓴다(관리자 화면은 쓰지 않음). `useCourseDetail`은 관리자 화면(`AdminCoursePage`, reloadKey 사용)도 쓰므로 Q3 변경 시 그 테스트도 함께 돈다
- 백엔드·생성 클라이언트 변경 없음

### 6회차 MFE 분리 때 주의
- `CourseDetailPage`(course-mfe)가 `EnrollButton`(enrollment-mfe)을 쓴다 → 6회차에 remote 노출 컴포넌트가 된다. 그래서 props를 `sessionId`·`disabledReason`·`onChanged`로만 둔다
- `enrollment/`가 쓰는 공용 것(`http`, `useAuth`, `EmptyState`, 날짜 형식)은 6회차에 공용 패키지로 간다

## 7. 위험

| 위험 | 대응 |
|---|---|
| 신청 뒤 상세를 다시 불러오며 결과 표시가 사라짐 | 다시 불러올 때 Skeleton으로 바꾸지 않음, D1·브라우저 3 |
| 필터를 빨리 바꿀 때 늦은 응답이 덮음 | `ignore` 패턴, U1 |
| 백엔드 메시지(ID 포함)를 그대로 노출 | 코드별 고정 문구, E4 |
| enrollment → pages 의존이 생김 | 구조 규칙, 리뷰 중점(`grep "from '../pages"`) |
| 만료 토큰으로 공개 상세에서 401 → 로그인 화면 | 로그인 화면 PR의 알려진 한계 그대로. 시작 시 `/me` 확인이 오래된 토큰을 먼저 지우므로 실제로는 세션 중 만료 때만 생김(9장 Q4) |

## 8. 교재와 다르게 하는 것

| 교재 | 이 프로젝트 |
|---|---|
| MUI `Table`·`Chip`·`TextField select` | Mantine `Table`·`Badge`·`SegmentedControl` |
| CourseListPage 행 클릭 `useNavigate` | 이미 `CourseCard` 링크가 있어 변경 없음 |
| CourseDetailPage 새로 작성 | 기존 화면에 신청 버튼만 끼움(`SessionCard` action 슬롯) |
| `enrollmentApi.enroll(sessionId)`, `waitingNo`, `startDate`, `CANCELED` | `applyEnrollment({ sessionId })`, `waitingNumber`, `sessionStartAt`, `CANCELLED` (생성 클라이언트 이름) |
| 상태 4개 | **미수료(NOT_COMPLETED)** 추가 (D-05) |
| 409 → "이미 신청한 회차입니다" 하나 | 코드별 문구. D-03은 **과정 단위** 중복이라 "이 과정에 신청" |
| `window.confirm` | Mantine `modals.openConfirmModal` (기존 관리자 화면과 같은 방식) |
| 관리자용 "과정 수정"·"명단" 링크 | Step 16에서 (명단 화면이 아직 없음) |
| 화면에서 API 직접 호출 | 조회는 커스텀 훅, 변경은 `useEnrollmentActions` (`frontend/CLAUDE.md`) |

## 9. 질문과 결정

| # | 질문 | 권장 |
|---|---|---|
| Q1 | **종료된 과정(CLOSED)의 모집 중 회차에 신청 버튼을 보일까?** 교재는 숨긴다. 그런데 D-02는 "과정 종료는 새 회차 등록과 목록 노출만 막는다"고 하고 백엔드도 신청을 받는다 | **숨긴다**(교재 6-2의 8번 "상세에는 종료 표시, 신청 버튼 없음"과 맞춤). 비활성 버튼 + "종료된 과정입니다". 백엔드와 다른 점은 화면 편의로 기록하고, D-02에 "과정 종료 시 신규 신청도 막을지"를 열린 질문으로 남긴다 |
| Q2 | `enrollment/`가 `components/EmptyState`·`formatDateTime`을 써도 될까? (6회차엔 다른 앱) | **써도 된다.** 둘 다 과정 도메인이 아닌 공용 UI라서 6회차에 공용 패키지로 옮긴다(6장에 기록). 금지는 `pages/`와 과정 전용 훅·컴포넌트 |
| Q3 | 신청 성공 뒤 상세를 다시 불러와 남은 자리를 갱신할까? | **갱신한다.** 단 `useCourseDetail`이 다시 불러오는 동안 이전 데이터를 유지하도록 고친다(지금은 `data: null`로 비움) — 관리자 화면의 동작도 같이 좋아진다 |
| Q4 | 공개 화면의 401(만료 토큰) 처리를 바꿀까? | **바꾸지 않는다.** 시작 시 `/me` 확인으로 오래된 토큰이 먼저 지워져 실제 영향은 작다. 백엔드에서 공개 API가 잘못된 토큰을 무시하게 할지는 8회차 보안 검토 때 |
| Q5 | 상세에서 "이미 신청한 회차"를 미리 표시할까? (내 신청 내역을 한 번 더 조회) | **이번엔 하지 않는다**(교재 범위). 누르면 409 안내가 나온다. 필요하면 다음 작업으로 제안 |
