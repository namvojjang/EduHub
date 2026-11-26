# 설계명세: FR-08 회차 명단과 수료 처리

- 상태: 승인됨 (2026-11-26, 9장 Q1~Q7 모두 권장안). 구현계획: `docs/plans/FR-08-roster-completion.md`
- 관련: FR-08, D-05(수료·미수료, 교육 완료 후), D-01(회차 상태), D-03(수료한 과정 재신청 불가), NFR-03(관리자만), NFR-04
- 참고: 교육 5회차 Step 11. **교재의 업무 규칙("회차 시작일부터 수료 처리")은 이 프로젝트의 D-05와 다르다.** 이 명세는 D-05를 따른다 (Q1)
- 범위 밖: 화면(Step 16), 알림(FR-09), 회차 시작 시각 자동 마감 스케줄러(D-01 자동화)

## 1. 요구사항 정리

| ID | 이번에 지킬 것 |
|---|---|
| FR-08 | 관리자는 회차별 신청자(확정)·대기자 명단을 보고 수료 처리한다 |
| D-05 | 수료 처리는 **확정 신청만**, 회차가 **교육 완료(`COMPLETED`)된 뒤에만** 한다. 확정 신청을 **수료(`COMPLETED`) 또는 미수료(`NOT_COMPLETED`)**로 처리한다 |
| D-01 | 회차 상태는 모집 중 → 모집 마감 → 교육 완료. 회차 시작 시 남은 대기는 취소된다 |
| D-03 | **수료한 과정은 다시 신청할 수 없다** (지금 코드는 확정·대기만 막는다 → 이번에 함께 막는다) |
| NFR-03 | 관리자 API는 `/api/v1/admin/**`(이미 ADMIN만, 규칙 추가 없음) |
| CLAUDE.md 6 | 수량·상태 변경은 락으로, 중복 방지는 DB 유일 제약으로 보장한다 |

## 2. API (모두 ADMIN, 경로 `/api/v1/admin/...`)

### 2-1. 회차 교육 완료 처리 (enrollment 패키지 `EnrollmentAdminController`, 상태 규칙은 course의 `CourseSession.complete`)
`POST /api/v1/admin/sessions/{sessionId}/complete` (operationId `completeSession`, Tag `EnrollmentAdmin`) → `200 SessionResponse`

- 남은 대기 취소가 enrollment의 일이라 API는 enrollment 쪽에 둔다(5장). course는 enrollment에 의존하지 않는다.
- 회차가 `RECRUITING` 또는 `CLOSED`이고 **시작 시각이 지났을 때만** `COMPLETED`로 바꾼다. 아니면 409
  - 이미 `COMPLETED` → 409 `SESSION_ALREADY_COMPLETED`
  - 시작 전 → 409 `SESSION_NOT_STARTED`
- 남은 대기(`WAITING`)는 이때 **취소**한다(D-01 "회차 시작 시 남은 대기 취소"의 수동 버전) → Q3

### 2-2. 명단 조회 (enrollment 패키지)
`GET /api/v1/admin/sessions/{sessionId}/roster` (operationId `getRoster`, Tag `EnrollmentAdmin`) → `200 RosterResponse`

| 필드 | 타입 | 설명 |
|---|---|---|
| sessionId, courseId, courseTitle | | |
| sessionStartAt | LocalDateTime | |
| sessionStatus | `CourseSessionStatus` | 수료 처리 가능 여부를 화면이 판단 (`COMPLETED`일 때만) |
| capacity | int | |
| confirmed | `List<RosterEntry>` | 확정·수료·미수료 (신청 순) |
| waiting | `List<RosterEntry>` | 대기 (대기 순번 순, 순번 포함) |

`RosterEntry`: `enrollmentId`, `employeeId`, `employeeNo`, `name`, `status`, `waitingNumber`(대기만), `appliedAt`, `confirmedAt`, `promoted`

- 사번·이름은 `employee` 테이블에서 가져온다. 사원 행이 없는 신청(테스트가 남긴 예전 데이터, FK 없음 — NFR-03 설계 Q2)은 **빠뜨리지 않고** 사번·이름을 null로 보여 준다(left join) → Q5
- 취소(`CANCELLED`)는 명단에 넣지 않는다(교재와 같음)
- 없는 회차 → 404 `SESSION_NOT_FOUND`

### 2-3. 수료·미수료 처리 (enrollment 패키지)
`POST /api/v1/admin/sessions/{sessionId}/completions` (operationId `recordCompletions`) → `200 CompletionResponse`

요청 `CompletionRequest`

| 필드 | 타입 | 검증 |
|---|---|---|
| result | `CompletionOutcome` enum: `COMPLETED` \| `NOT_COMPLETED` (신청 상태 `EnrollmentStatus`와 헷갈리지 않게 별도 이름) | `@NotNull` |
| employeeIds | `List<Long>` | `@NotEmpty`, `@Size(max = 200)`, 원소 `@NotNull` |

응답 `CompletionResponse`: `processed: List<Long>`(처리된 사원 ID), `failed: List<{employeeId, reason, code}>`

- **되는 사람만 처리하고 안 된 사람은 사유와 함께 돌려준다**(교재 결정 그대로) → Q2
- 실패 사유(code / 한국어 reason)

| code | 언제 |
|---|---|
| `NOT_ENROLLED` | 이 회차에 신청이 없음 |
| `WAITING` | 대기 중인 신청 (2-1에서 회차 완료 시 대기를 취소하면 실제로는 거의 생기지 않음) |
| `CANCELLED` | 취소된 신청 |
| `ALREADY_RECORDED` | 이미 수료 또는 미수료로 처리됨 → Q4 |

- 회차가 `COMPLETED`가 아니면 전체 409 `SESSION_NOT_COMPLETED` (처리 없음)
- 같은 사원 ID가 요청에 두 번 있으면 한 번만 처리(순서 유지)
- 없는 회차 404, 검증 실패 400

## 3. 상태 변경 규칙 (엔티티)

| 엔티티 | 메서드 | 규칙 |
|---|---|---|
| `CourseSession` | `complete(LocalDateTime now)` | `RECRUITING`/`CLOSED` + `startAt <= now` → `COMPLETED`. 아니면 `ConflictException` |
| `CourseSession` | `requireCompleted()` | `COMPLETED`가 아니면 409 `SESSION_NOT_COMPLETED` |
| `Enrollment` | `recordCompletion(boolean passed)` | `CONFIRMED`만 → `COMPLETED`/`NOT_COMPLETED`. 아니면 예외(서비스가 사유로 변환) |

- 대기 취소는 기존 `Enrollment.cancel()`을 쓴다.

## 4. 동시성·트랜잭션 (CLAUDE.md 6)

- **회차 완료(2-1)**: `findByIdForUpdate`로 회차 행을 잠그고 상태 변경 + 남은 대기 취소를 한 트랜잭션에서 한다. 같은 회차의 신청·취소(이미 회차 락을 씀)와 순서가 정해진다
- **수료 처리(2-3)**: 같은 회차 락을 잡은 뒤 신청을 읽고 바꾼다. 관리자 두 명이 동시에 처리해도 한 줄로 서서 `ALREADY_RECORDED`로 정확히 갈린다
- **D-03 재신청 금지 (DB 보장)**: `V6`에서 유효 신청 부분 유일 인덱스에 `COMPLETED`를 넣는다

```sql
-- V6__block_reapply_after_completion.sql (D-03: 수료한 과정은 다시 신청할 수 없다)
DROP INDEX ux_enrollment_course_employee_active;
CREATE UNIQUE INDEX ux_enrollment_course_employee_active
    ON enrollment (course_id, employee_id)
    WHERE status IN ('CONFIRMED', 'WAITING', 'COMPLETED');
```
  - 인덱스 이름은 그대로 둔다. `EnrollmentService.isActiveEnrollmentViolation`이 이 이름으로 위반을 판별하므로 바꾸면 안 된다
  - 서비스의 사전 확인은 두 단계다: 회차 락 이후 ① `existsByCourseIdAndEmployeeIdAndStatus(…, COMPLETED)`이면 409 `ALREADY_COMPLETED_COURSE`("이미 수료한 과정입니다") ② 기존 `existsByCourseIdAndEmployeeIdAndStatusIn(…, CONFIRMED·WAITING)`이면 409 `DUPLICATE_ENROLLMENT` → Q6. 다른 회차와 경합하면 V6 인덱스가 최종으로 막고, 그때 코드는 `DUPLICATE_ENROLLMENT`로 나올 수 있다(둘 다 409)
  - **회차 수정·마감도 회차 락을 쓴다**(최종 검토 W1): 회차 완료와 회차 수정이 동시에 일어나면 수정 저장이 `COMPLETED`를 덮어쓸 수 있어, `CourseAdminService`의 수정·마감 조회를 `findByIdForUpdate`로 바꿨다. 정원 변경도 이 락 아래에서 일어난다(CLAUDE.md 6)
  - 미수료(`NOT_COMPLETED`)는 다시 신청할 수 있다(D-03은 수료만 막음)
  - **마이그레이션 위험**: 기존 데이터에 같은 (과정, 사원)으로 `COMPLETED`와 유효 신청이 함께 있으면 V6가 실패한다. 지금은 `COMPLETED` 행이 없다(Step 9 조회: CANCELLED·CONFIRMED·WAITING만). 구현 시 eduhub-db로 다시 확인한다

## 5. 패키지 의존 (NFR-07)

- 명단의 사번·이름 때문에 `enrollment`가 `auth.Employee`를 조회해야 한다. 지금 규칙은 "enrollment는 auth의 CurrentUser만 참조" → **규칙을 넓힌다**: "enrollment는 auth의 `CurrentUser`와 `Employee`(명단 조회용 읽기)만 참조" → Q7
- JPQL `left join Employee m on m.id = e.employeeId`(Hibernate 5.1+ 엔티티 조인). Java 코드에서 `Employee`를 직접 import하지 않고 JPQL 문자열에서만 쓰는 방법도 있지만, 숨은 의존이 되므로 규칙에 적는 쪽을 택한다
- 회차 완료(2-1)는 `course` 패키지인데 대기 취소는 `enrollment` 일이다. `course`는 `enrollment`에 의존하면 안 된다 → **회차 완료 API를 `enrollment` 쪽 관리자 서비스에 둔다**(경로만 `/api/v1/admin/sessions/{id}/complete`). `CourseSession.complete()`는 course 엔티티 메서드로 두고, 서비스가 회차 락 → `session.complete(now)` → 남은 대기 `cancel()`을 부른다

## 6. 테스트 시나리오

`RosterTest`(`@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional`, `TestAuth.as`). 사원은 `Employee.create`로 저장(사번·이름 확인용), 회차 시작 시각이 지난 회차는 `ReflectionTestUtils` 등 기존 테스트 방식으로 만든다.

| # | 시나리오 | 기대 |
|---|---|---|
| R1 | 명단: 확정 김, 대기 이(1)·박(2), 취소 최 | confirmed=[김], waiting=[이(1), 박(2)], 최 없음, 사번·이름 포함 |
| R2 | 사원 행이 없는 신청 | 명단에 나오고 employeeNo·name null |
| R3 | 사원 토큰으로 명단·완료·수료 | 403 `FORBIDDEN` |
| C1 | 시작 전 회차 완료 | 409 `SESSION_NOT_STARTED` |
| C2 | 시작 지난 회차 완료 | 200, 회차 `COMPLETED`, 남은 대기(이·박) `CANCELLED`, 확정 김 그대로 |
| C3 | 이미 완료된 회차 다시 완료 | 409 `SESSION_ALREADY_COMPLETED` |
| P1 | 완료 전 회차에 수료 처리 | 409 `SESSION_NOT_COMPLETED`, 아무것도 안 바뀜 |
| P2 | 완료 회차: `COMPLETED`로 [김, 이(취소됨), 없는 사원, 김(중복)] | processed=[김], failed=[이 `CANCELLED`, 없는 사원 `NOT_ENROLLED`], 중복 무시 |
| P3 | 같은 김을 다시 처리 | failed `ALREADY_RECORDED` |
| P4 | `NOT_COMPLETED`로 처리 | 상태 `NOT_COMPLETED`, FR-07 내역에도 그렇게 보임 |
| P5 | 빈 목록 / result 없음 | 400 `INVALID_REQUEST` |
| D1 | 수료한 김이 같은 과정 다른 회차에 신청 | 409 `ALREADY_COMPLETED_COURSE` |
| D2 | 미수료 사원은 같은 과정에 다시 신청 | 201 |
| D3 | DB 유일 제약: 수료 행이 있는 (과정, 사원)으로 신청 행 직접 insert | 유일 제약 위반 (리포지토리 테스트) |
| K1 | 동시성: 관리자 두 명이 같은 사원을 동시에 수료 처리 | 한 명만 processed, 다른 쪽 `ALREADY_RECORDED` (동시성 테스트, 기존 `EnrollmentCancelConcurrencyTest` 방식) |

- 엔티티 단위 테스트: `CourseSession.complete`(시작 전·후, 상태별), `Enrollment.recordCompletion`(CONFIRMED만)
- 기존 테스트 회귀: 신청·취소·동시성 테스트 전부 통과(V6 인덱스 변경 영향 확인)

## 7. 영향 범위

| 항목 | 내용 |
|---|---|
| 새 파일 | `V6__...sql`, `RosterResponse`, `RosterEntry`, `CompletionRequest`, `CompletionResponse`, `EnrollmentAdminService`, `EnrollmentAdminController`, 테스트 3~4개 |
| 수정 | `CourseSession`(complete, requireCompleted), `Enrollment`(recordCompletion), `EnrollmentRepository`(명단 쿼리, 회차·사원별 조회), `EnrollmentService`(D-03 사전 확인), `CourseAdminService`(회차 수정·마감에 회차 락, 최종 검토 W1), `backend/CLAUDE.md`(패키지 규칙) |
| 프론트 | 클라이언트 재생성. 화면은 Step 16 |
| 규모 | **course·enrollment 두 패키지 + 마이그레이션 + 기존 신청 로직(D-03)**. CLAUDE.md 절차 5에 해당 → 작업을 잘게 나누고 단계마다 보고 |

## 8. 교재와 다르게 하는 것

| 교재 | 이 프로젝트 | 이유 |
|---|---|---|
| 회차 시작일부터 수료 처리 | 회차 **교육 완료 후**에만 (+ 회차 완료 API 추가) | D-05 |
| 수료만 | 수료·미수료 (`result`) | D-05 |
| `/api/admin/...` | `/api/v1/admin/...` | 팀 경로 규칙 |
| `join Employee` (inner) | `left join` | 사원 행 없는 신청이 명단에서 사라지지 않게 |
| 락 없음 | 회차 락 | CLAUDE.md 6, 동시 처리 |
| 재신청 금지 없음 | D-03 수료 재신청 금지 + DB 유일 제약 | D-03, CLAUDE.md 6 |
| 실패 사유 문자열만 | `code` + `reason` | 화면이 코드로 분기 |

## 9. 질문과 결정

> 개발자 결정 (2026-11-26): Q1~Q7 모두 권장안. Q1은 D-05(교육 완료 후)를 따른다.

- **Q1. 수료 처리 가능 시점: D-05(회차 교육 완료 후)를 따른다.** 교재는 "시작일부터"다. 권장: **D-05**. 요구사항 문서의 결정이고, "교육 완료" 상태가 이미 enum에 있다. 그래서 회차 완료 API(2-1)가 새로 필요하다
- **Q2. 여러 명 처리 중 일부가 안 되면 → 되는 사람만 처리, 실패는 사유와 함께.** 권장: 그대로(교재 결정)
- **Q3. 회차를 교육 완료로 바꿀 때 남은 대기를 취소한다.** D-01의 "회차 시작 시 남은 대기 취소"를 자동 스케줄러 없이 이 시점에 한다. 취소 사유 컬럼은 아직 없다(FR-07 설계 Q4). 권장: 취소한다(사유는 나중에)
- **Q4. 이미 수료·미수료로 처리된 신청을 바꿀 수 있나?** 권장: 이번엔 불가(`ALREADY_RECORDED`). 정정 기능은 필요할 때 별도로
- **Q5. 명단에서 사원 행이 없는 신청 → left join으로 보여 준다.** 권장: 보여 준다(사라지면 관리자가 인원을 잘못 셈)
- **Q6. D-03 수료 재신청 금지를 이번에 함께 넣는다(V6 인덱스 + 409 `ALREADY_COMPLETED_COURSE`).** 권장: 함께. 수료가 처음 생기는 기능이라 같이 막아야 빈틈이 없다
- **Q7. 패키지 규칙을 넓힌다: enrollment → auth의 `Employee`(명단 조회 읽기).** 권장: 넓히고 `backend/CLAUDE.md`·`auth/package-info.java`에 적는다
