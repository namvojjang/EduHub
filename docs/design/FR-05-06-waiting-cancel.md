# 설계명세: FR-05 대기 순번 + FR-06 취소와 자동 승급

- 상태: 승인됨 (2026-11-17, Q1~Q7 제안대로 + 동시 신청 대기 순번 테스트 추가 조건). 구현계획: `docs/plans/FR-05-06-waiting-cancel.md`
- 관련: FR-05, FR-06, D-01, D-02, D-04, NFR-01, NFR-03(TODO), NFR-04
- 선행: FR-04 (`docs/design/FR-04-enroll.md`, PR #2로 머지됨)
- 범위
  - FR-05: 신청 응답과 단건 조회에 그 시점의 대기 순번(`waitingNumber`)을 넣는다. 순번은 저장하지 않는다 (D-04).
  - FR-06: 본인 취소 API. 확정이 취소되면 같은 트랜잭션에서 대기 1순위를 확정하고, 확정 시각과 승급 여부를 기록한다 (D-04).
- 범위 밖 (이유는 7절)
  - 관리자 정원 증가 시 자동 승급·정원 하한 검사 (D-02) → Q2
  - 회차 시작 시 자동 모집 마감과 남은 대기 취소 (D-01, 스케줄러 필요)
  - 과정 상세 `remainingSeats` 계산 (FR-02) → Q5
  - 내 신청 목록 (FR-07), 알림 (FR-09)

## 1. 요구사항 정리

| ID | 이번에 지킬 것 |
|---|---|
| FR-05 | 정원이 차면 대기로 등록되고(FR-04에서 이미 저장함), 신청 응답과 조회에서 대기 순번을 알려 준다 |
| FR-06 | 본인 신청을 취소한다. 확정이 취소되면 대기 1순위가 자동으로 확정된다 |
| D-04 | 순번은 저장하지 않고 신청 시각 순으로 계산한다. 대기자가 취소하면 뒤 순번이 자동으로 당겨진다. 확정·대기 모두 **회차 시작 전까지** 취소할 수 있다. 승급은 수락 절차 없이 자동, 같은 트랜잭션. 확정 시각과 "대기에서 승급" 여부를 기록한다 |
| D-01 | 모집 마감(`CLOSED`)은 신규 신청·대기만 막는다. 기존 확정·대기는 유지되므로, **마감된 회차라도 시작 전이면 취소할 수 있고 승급도 일어난다**. 교육 완료(`COMPLETED`)·시작된 회차는 취소할 수 없다 |
| D-02 | "자리가 생기면 승급"으로 통일. 이번에는 자리가 생기는 경로가 확정 취소 하나뿐이다 (정원 증가는 Q2) |
| NFR-01 | 취소·승급·신청이 동시에 일어나도 확정 인원이 정원을 넘지 않고, 대기 순번이 겹치거나 비지 않는다 |
| NFR-03 | 본인 신청만 취소·조회할 수 있다. 로그인 연동 전이므로 FR-04와 같이 `X-Employee-Id` 헤더를 쓰고 `TODO(NFR-03)`을 남긴다 |
| NFR-04 | 새 API에 OpenAPI 문서와 operationId를 달고 프론트 클라이언트를 재생성한다 |

## 2. 대기 순번 계산 (FR-05, D-04)

같은 회차의 `WAITING` 신청을 **`(applied_at, id)` 오름차순**으로 줄 세운 위치(1부터)다. → Q1 (동점 기준)

```
waitingNumber = 1 + count(e2 : e2.session = e.session AND e2.status = WAITING
                               AND (e2.applied_at < e.applied_at
                                    OR (e2.applied_at = e.applied_at AND e2.id < e.id)))
```

- `WAITING`이 아니면 `null`.
- 대기 1순위(승급 대상)도 같은 정렬의 첫 행이다. 순번 계산과 승급이 같은 기준을 쓰므로 "1번이라고 안내받았는데 다른 사람이 승급"하는 일이 없다.
- 같은 회차의 신청·취소는 회차 행 락으로 한 줄로 서므로, 같은 회차 안에서 `id`는 처리 순서와 같다. `applied_at`이 같을 때 `id`로 가르면 결과가 처리 순서와 일치한다.
- 저장하지 않으므로 앞 사람이 취소하거나 승급하면 다음 조회부터 순번이 자동으로 당겨진다.
- 신청 응답의 순번은 회차 락을 쥔 채 계산하므로 그 시점에 정확하다. 단건 조회는 락 없이 읽으므로 "조회 시점 값"이다 (D-04가 요구하는 수준).

인덱스: 기존 `idx_enrollment_session_status (session_id, status)`로 회차·상태를 좁힌 뒤 그 안에서 세므로 회차당 대기자 수만큼만 읽는다. 별도 인덱스는 추가하지 않는다.

## 3. API

### 3.1 신청 응답 변경 — `POST /api/v1/enrollments` (`applyEnrollment`, 기존)

`EnrollmentResponse`에 필드 두 개를 추가한다. 기존 필드는 그대로다 (계약은 추가만).

| 필드 | 타입 | 설명 |
|---|---|---|
| id, sessionId, status, appliedAt, confirmedAt | (기존) | |
| waitingNumber | Integer | 대기 순번(1부터). `WAITING`이 아니면 null (FR-05) |
| promoted | boolean | 대기에서 승급해 확정되었는가 (D-04). 신청 응답에서는 항상 false |

### 3.2 단건 조회 — `GET /api/v1/enrollments/{enrollmentId}` (`getEnrollment`, 신규) → Q4

- 헤더 `X-Employee-Id` (필수, `TODO(NFR-03)`).
- `200` `EnrollmentResponse` (순번은 조회 시점 값).
- `404 ENROLLMENT_NOT_FOUND`: 신청이 없거나 **다른 직원의 신청** (→ Q3, 존재 여부를 드러내지 않는다).
- `400 INVALID_REQUEST`: 헤더 누락·형식 오류, 경로 변수 형식 오류.

### 3.3 취소 — `POST /api/v1/enrollments/{enrollmentId}/cancel` (`cancelEnrollment`, 신규) → Q6

- 본문 없음. 헤더 `X-Employee-Id` (필수, `TODO(NFR-03)`).
- `200` `EnrollmentResponse`: 취소된 본인 신청 (`status: CANCELLED`, `waitingNumber: null`). 승급된 다른 사람의 정보는 응답에 넣지 않는다.

| 상태 | code | 언제 |
|---|---|---|
| 400 | `INVALID_REQUEST` | 헤더 누락·형식 오류 |
| 404 | `ENROLLMENT_NOT_FOUND` | 신청 없음, 다른 직원의 신청 (Q3) |
| 409 | `ENROLLMENT_NOT_CANCELLABLE` | 이미 취소·수료·미수료된 신청 |
| 409 | `SESSION_ALREADY_STARTED` | 회차 시작 시각이 지났음 (D-04 "회차 시작 전까지") |

- 경로가 `DELETE`가 아닌 이유: 행을 지우지 않고 상태를 바꾸며, 취소 내역은 FR-07에서 보여야 한다.
- 시작 판정은 회차 상태가 아니라 `startAt`으로 한다. 회차 시작 시 자동 마감(D-01)이 아직 없으므로 상태가 `RECRUITING`/`CLOSED`로 남아 있어도 시각이 지났으면 막는다. `COMPLETED` 회차는 항상 시작 후이므로 같은 경로로 막힌다.

## 4. 스키마 변경: `V3__add_enrollment_promoted.sql`

```sql
-- FR-06·D-04: 대기에서 승급해 확정되었는지 기록한다. FR-07 내역, FR-09 알림이 이 값을 쓴다.
-- 기존 행은 모두 직접 확정 또는 대기이므로 false로 채운다.
ALTER TABLE enrollment ADD COLUMN promoted BOOLEAN NOT NULL DEFAULT FALSE;
```

- `confirmed_at`은 이미 있다. 승급 때 승급 시각으로 채운다 (`applied_at`은 바꾸지 않는다).
- 취소 시각·취소 사유 컬럼은 이번에 추가하지 않는다. 사유("회차 시작")는 D-01 자동 마감 작업에서, 취소 시각은 FR-07에서 필요하면 그때 추가한다. → Q7
- 상태 CHECK는 FR-04에서 이미 `CANCELLED`를 포함한다. 바꾸지 않는다.
- V2 파일은 고치지 않는다.

## 5. 코드 구성

| 패키지 | 파일 | 변경 |
|---|---|---|
| course | `CourseSession` | `requireNotStarted(LocalDateTime now)` 추가: `!startAt.isAfter(now)`면 `ConflictException(SESSION_ALREADY_STARTED)` |
| enrollment | `Enrollment` | `boolean promoted` 필드. `cancel()`: `CONFIRMED`/`WAITING`만 → `CANCELLED`, 아니면 `ConflictException(ENROLLMENT_NOT_CANCELLABLE)`. `promote(LocalDateTime now)`: `WAITING`만 → `CONFIRMED`, `confirmedAt = now`, `promoted = true`, 아니면 `IllegalStateException`(서비스 버그) |
| enrollment | `EnrollmentRepository` | `findSessionIdById(id)`(JPQL, 회차 ID만), `countAhead(sessionId, appliedAt, id)`(JPQL, 2절 식), `findFirstBySessionIdAndStatusOrderByAppliedAtAscIdAsc(sessionId, WAITING)` |
| enrollment | `EnrollmentService` | `apply` 응답에 순번. `get(employeeId, enrollmentId)` readOnly. `cancel(employeeId, enrollmentId)`. 1순위 승급은 `boolean promoteFirstWaiting(CourseSession lockedSession, LocalDateTime now)`(패키지 전용, 회차 락을 쥔 호출자만 부른다, 자리가 있을 때만 승급 — 6.2절 W1)로 분리해 정원 증가 후속 작업(Q2)에서 재사용한다. 후속 작업이 course 패키지에서 쓰려면 public으로 바꾸거나 enrollment 패키지에 진입점을 둬야 한다 |
| enrollment | `EnrollmentResponse` | `waitingNumber`, `promoted` 추가. `from(enrollment, Integer waitingNumber)` |
| enrollment | `EnrollmentController` | `GET /{enrollmentId}`, `POST /{enrollmentId}/cancel` |
| enrollment | `EnrollmentNotFoundException` | `NotFoundException` 상속, code `ENROLLMENT_NOT_FOUND` |

- `ENROLLMENT_NOT_CANCELLABLE`, `SESSION_ALREADY_STARTED`는 기존 `ConflictException(code, message)`로 던진다 (FR-04의 `SESSION_NOT_RECRUITING`과 같은 방식). 새 예외 클래스·핸들러는 만들지 않는다.
- 의존 방향은 enrollment → course만 있다 (NFR-07). course는 바꾸는 것이 `CourseSession` 메서드 하나다.

## 6. 트랜잭션 경계와 동시성

### 6.1 락 규칙 (신청·취소 공통)

- 같은 회차의 정원·대기 순서를 바꾸는 쓰기(신청, 취소+승급)는 **모두 같은 회차 행 락 하나**(`CourseSessionRepository.findByIdForUpdate`, PESSIMISTIC_WRITE)를 먼저 잡는다.
- 한 트랜잭션은 회차 락을 **하나만** 잡는다. 다른 행 락은 잡지 않으므로 락 순서 문제(교착)가 없다.
- 확정 인원·대기 순서는 락을 잡은 **뒤에** 읽는다. PostgreSQL READ COMMITTED는 문장마다 새 스냅샷이므로 앞 트랜잭션의 커밋 결과를 본다.

### 6.2 `cancel(employeeId, enrollmentId)` (`@Transactional`)

1. `findSessionIdById(enrollmentId)` — 회차 ID만 읽는다 (엔티티를 영속성 컨텍스트에 올리지 않는다). 없으면 404.
2. `findByIdForUpdate(sessionId)` — 회차 행 락.
3. `findById(enrollmentId)` — **락을 잡은 뒤 처음으로** 신청 엔티티를 읽는다. 그래서 앞에서 같은 신청을 취소한 트랜잭션의 결과(`CANCELLED`)를 본다.
4. 본인 확인: `employeeId`가 다르면 404 `ENROLLMENT_NOT_FOUND` (Q3).
5. `session.requireNotStarted(now)` → 409 `SESSION_ALREADY_STARTED`.
6. `boolean wasConfirmed = enrollment.getStatus() == CONFIRMED`; `enrollment.cancel()` → 이미 취소 등이면 409 `ENROLLMENT_NOT_CANCELLABLE`.
7. `wasConfirmed`이면 `promoteFirstWaiting(session, now)`. 대기 취소면 승급하지 않는다(확정 인원이 그대로이므로). 순번은 저장하지 않으므로 뒤 대기자는 자동으로 당겨진다.
   - **W1 결정 (T3 비교 실험 검토, 2026-11-17)**: 승급은 "취소 반영 후 확정 인원 < 정원"일 때만 한다. 정원 하한 검사(D-02)가 아직 없어 관리자가 정원을 확정 인원보다 줄일 수 있고, 그 상태에서 무조건 승급하면 초과가 유지된다.
   - `promoteFirstWaiting(CourseSession lockedSession, LocalDateTime now)`가 조건을 스스로 갖는다: `enrollmentRepository.flush()` → `countBySessionIdAndStatus(CONFIRMED)` → `< capacity`일 때만 1순위를 `promote`, 승급했으면 true. 정원 증가 후속 작업(D-02)은 "true인 동안 반복"으로 재사용한다.
   - 명시적 `flush`를 고른 이유: 이 메서드는 호출자의 미반영 변경과 무관하게 맞아야 재사용할 수 있다. Hibernate의 쿼리 전 자동 flush에 기대지 않고, "취소 전 확정 수 − 1"은 취소 경로에서만 맞는 계산이라 쓰지 않는다.
8. 커밋 시 변경 감지로 UPDATE, 락 해제.

1단계에서 엔티티를 읽지 않는 이유: 락 전에 읽은 엔티티는 영속성 컨텍스트에 남아 3단계의 `findById`가 DB를 다시 읽지 않는다. 그러면 같은 신청을 동시에 두 번 취소할 때 두 번째 트랜잭션이 낡은 `CONFIRMED`를 보고 **한 번 더 승급**시켜 정원을 넘긴다. 이것이 이번 기능의 핵심 위험이고 동시성 테스트로 검증한다.

### 6.3 `apply` 변경

- 저장 직후, 같은 락 안에서 `WAITING`이면 `countAhead + 1`로 순번을 계산해 응답에 넣는다. `CONFIRMED`면 null.
- 확정 조건 `confirmed < capacity && waiting == 0`(FR-04 W1)은 그대로 둔다. 확정 취소 시 같은 트랜잭션에서 승급하므로 "자리가 남았는데 대기자가 있는" 상태는 이 기능의 경로로는 생기지 않는다. 다만 관리자 정원 증가(Q2)가 아직 승급하지 않으므로 그 경우의 추월 방지로 계속 필요하다.

### 6.4 `get(employeeId, enrollmentId)` (`@Transactional(readOnly = true)`)

- 락 없이 `findById` → 본인 확인(아니면 404) → `WAITING`이면 `countAhead + 1`.
- 두 쿼리 사이에 다른 취소가 커밋되면 순번이 한 칸 어긋난 값이 나올 수 있다. 조회 시점 값이라는 D-04의 요구 범위로 보고 허용한다.

### 6.5 왜 정합성이 지켜지는가

| 겹치는 경우 | 결과 |
|---|---|
| 같은 회차에서 확정 취소 + 새 신청 | 회차 락으로 한 줄. 신청이 먼저면 대기 뒤에 서고(대기자 있음 → WAITING), 취소가 먼저면 대기 1순위가 승급한 뒤 신청이 대기 뒤에 선다. 어느 순서든 확정 ≤ 정원, 새 신청이 대기자를 앞지르지 않는다 |
| 같은 신청을 동시에 두 번 취소 | 두 번째는 락 뒤에 다시 읽은 `CANCELLED`를 보고 409. 승급은 한 번 |
| 확정자 여러 명 동시 취소 | 한 줄로 서서 각각 그 시점 1순위를 승급. 같은 대기자가 두 번 승급되지 않는다 (락 뒤에 읽으므로 앞에서 승급된 사람은 이미 `CONFIRMED`) |
| 대기 취소 + 확정 취소 | 한 줄. 대기 1순위가 먼저 취소되면 승급 대상은 다음 사람 |
| 정원이 확정 인원보다 작게 줄어든 뒤 확정 취소 (W1) | 취소 반영 후 확정 ≥ 정원이면 승급하지 않는다. 초과분은 취소로만 줄어든다 |
| 다른 회차 | 서로 막지 않는다 |

### 6.6 알고 있는 제약

- 관리자 회차 수정(`CourseAdminService.updateSession`)은 여전히 락·하한 검사(D-02)·자동 승급이 없다 (Q2 결정: 이번 범위 밖). 신청·취소와 동시에 정원이 바뀌면 그 순간의 판정이 낡은 정원으로 이뤄질 수 있고, 정원을 늘려도 대기자가 승급하지 않는다(새 신청은 W1 조건으로 대기 뒤에 선다). 후속 작업은 같은 회차 락을 잡고 이번에 만드는 1순위 승급 메서드(`EnrollmentService.promoteFirstWaiting(session, now)`, 자리가 있을 때만 승급)를 false가 나올 때까지 반복 호출하면 된다. PR 위험 목록에도 적는다.
- 회차 시작 후 남은 대기는 D-01 자동 마감 전까지 `WAITING`으로 남는다. 취소는 시작 후 막히므로 그 사이에 승급은 일어나지 않는다.
- 락 대기 시간 제한은 FR-04와 같이 두지 않는다.

## 7. 질문과 결정 (2026-11-17 승인)

- ~~Q1. 대기 순번 동점 기준~~ **결정: `(applied_at, id)` 오름차순.** 같은 회차는 락으로 한 줄이라 id 순서가 처리 순서와 같다. `backend/CLAUDE.md`의 "동점 기준은 미정" 줄을 이 설계명세 참조로 고친다.
- ~~Q2. 관리자 정원 증가 시 자동 승급·정원 하한(D-02)~~ **결정: 이번 범위 밖, 별도 작업.** `updateSession`은 course 패키지라 enrollment를 부를 수 없다(NFR-07). 이번에 만드는 1순위 승급 메서드를 재사용할 수 있게 두고, 6.6절과 PR 위험 목록에 남긴다.
- ~~Q3. 다른 직원의 신청을 취소·조회하면~~ **결정: `404 ENROLLMENT_NOT_FOUND`.** 존재 여부를 숨기고, 핸들러를 추가하지 않는다.
- ~~Q4. FR-05 "조회"의 범위~~ **결정: 단건 조회 `GET /api/v1/enrollments/{id}`를 이번에 추가.** 목록은 FR-07.
- ~~Q5. 과정 상세 `remainingSeats`~~ **결정: 이번에도 범위 밖.**
- ~~Q6. 취소 API 모양~~ **결정: `POST /api/v1/enrollments/{id}/cancel`, 200 + 취소된 신청.**
- ~~Q7. 취소 시각·사유 컬럼~~ **결정: 이번에 추가하지 않는다.**
- 승인 조건: 동시 신청 시 대기 순번 테스트를 추가한다 (8절 동시성 4번).

## 8. 테스트 시나리오

| 종류 | 대상 | 시나리오 |
|---|---|---|
| 단위 | `CourseSession` | 시작 전이면 `requireNotStarted` 통과 / 시작 시각과 같거나 지나면 409 `SESSION_ALREADY_STARTED` / `CLOSED`라도 시작 전이면 통과 |
| 단위 | `Enrollment` | 확정 취소 → `CANCELLED` / 대기 취소 → `CANCELLED` / 이미 취소된 신청 취소 → 409 `ENROLLMENT_NOT_CANCELLABLE` / `promote` → `CONFIRMED`, `confirmedAt = now`, `promoted = true`, `appliedAt` 그대로 / 확정 신청 `promote` → `IllegalStateException` / 신규 신청은 `promoted = false` |
| 단위 (Mockito) | `EnrollmentService.apply` | 대기면 응답에 순번(앞선 대기 수 + 1), 확정이면 null |
| 단위 (Mockito) | `EnrollmentService.cancel` | 확정 취소 → 1순위 승급 / 확정 취소, 대기자 없음 → 승급 없음 / 대기 취소 → 승급 조회 안 함 / 없는 신청 404 / 다른 직원 404 / 시작된 회차 409 / 이미 취소 409 / **회차 락을 잡은 뒤에 신청을 읽는다**(`InOrder`: `findSessionIdById` → `findByIdForUpdate` → `findById`) |
| 단위 (Mockito) | `EnrollmentService.get` | 대기 순번 / 확정이면 null / 다른 직원 404 |
| `@DataJpaTest` | Repository·스키마 | `countAhead`: 신청 시각 순, 같은 시각이면 id 순, 다른 회차·다른 상태 제외 / `findFirst...`가 같은 기준의 첫 행 / `findSessionIdById` / `promoted` 컬럼 기본값 false |
| `@WebMvcTest` | `EnrollmentController` | 신청 201 본문에 `waitingNumber`·`promoted` / 조회 200·404 / 취소 200·404·409 두 code / 헤더 누락 400 |
| 동시성 (`@SpringBootTest`, test 프로필) | NFR-01·FR-06 | 아래 6.5 표의 경우 |

동시성 테스트 (`EnrollmentCancelConcurrencyTest`, 새 파일. FR-04 테스트와 같은 방식: `ExecutorService` + `CountDownLatch`, 메서드에 `@Transactional` 없음, 매번 새 과정·회차, 결과는 DB를 다시 세서 확인)

1. **확정 취소와 새 신청이 겹침**: 정원 5 회차에 확정 5 + 대기 20을 미리 만든다. 확정 5명 취소와 새 직원 20명 신청을 동시에 실행 → 확정 정확히 5, 승급(`promoted = true`) 정확히 5, 대기 35, 대기 순번(2절 식으로 각 행 계산)이 정확히 `1..35`, 승급된 5명은 원래 대기 1~5순위, 예외 0.
2. **같은 확정 신청을 10번 동시 취소**: 정원 1, 확정 1 + 대기 3 → 성공 1, `ENROLLMENT_NOT_CANCELLABLE` 9, 확정 1(원래 대기 1순위), 대기 2, 순번 `1..2`.
3. **확정자 여러 명 동시 취소**: 정원 10, 확정 10 + 대기 10 → 10명 동시 취소 → 확정 10, 모두 `promoted`, 대기 0.
4. **동시 신청 시 대기 순번** (승인 조건): 정원 1 회차에 서로 다른 직원 100명이 동시에 신청 → 응답 `waitingNumber`가 null인 응답 1개(확정), 나머지 99개의 순번이 `1..99`로 정확히 한 번씩 나온다. DB 기준(2절 식)으로 다시 계산한 순번도 `1..99`. 응답 순번은 같은 락 안에서 계산하므로 중복·누락이 없어야 한다.
5. **정원 축소 후 확정 취소 (W1, 실제 DB, 동시 실행 아님)**: 정원 5·확정 5·대기 2 → 정원 3으로 수정(하한 검사 없음) → 확정 1명 취소 → 확정 4, 대기 2, 승급 0. flush 후 카운트가 같은 트랜잭션의 취소를 반영하는지 실제 DB로 확인한다.

락 제거 검증 (작업 지시 4): 위 테스트가 통과한 뒤, `cancel`의 `findByIdForUpdate`를 `findById`로 임시로 바꿔 실행해 1·2번이 실패하는 것을 확인하고 원복한다. 그 출력을 구현 기록으로 남긴다(코드에는 남기지 않는다).
