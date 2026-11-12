# 설계명세: FR-04 수강 신청 + NFR-01 동시성

- 상태: 승인됨 (2026-11-12). 구현계획: `docs/plans/FR-04-enroll.md`
- 관련: FR-04, NFR-01, NFR-03(TODO), D-01, D-03, D-04
- 범위: 신청 API와 동시성 처리. 대기 순번 계산·응답(FR-05), 취소·승급(FR-06), 수료(FR-08)는 하지 않는다.
  정원이 차면 `WAITING`으로 저장만 한다 (순번은 저장하지 않는다, D-04).

## 1. 요구사항 정리

| ID | 이번에 지킬 것 |
|---|---|
| FR-04 | 회차에 신청한다. 중복 신청할 수 없다 |
| D-03 | 중복 기준은 **과정**이다. 한 직원은 같은 과정에 유효 신청(확정·대기)을 1건만 가진다. 다른 회차라도 마찬가지다. 취소하면 다시 신청할 수 있다 (개발자 결정, Q1) |
| NFR-01 | 동시에 100명이 마지막 1자리에 신청해도 확정 인원이 정원을 넘지 않는다 |
| D-01 | 모집 중(`RECRUITING`)이고 아직 시작 전인 회차에만 신청할 수 있다 |
| D-04 | 순번은 저장하지 않고 신청 시각(`applied_at`) 순으로 계산한다. 이번에는 시각만 기록한다 |
| NFR-03 | 로그인 연동 전이므로 employeeId는 서비스 인자로 받고, Controller에 `TODO(NFR-03)`을 남긴다 |

## 2. API

`POST /api/v1/enrollments` (operationId `applyEnrollment`, Tag `Enrollment`)

요청 (`EnrollmentRequest`)

| 필드 | 타입 | 검증 |
|---|---|---|
| sessionId | Long | `@NotNull` |

임시 신원 전달: 요청 헤더 `X-Employee-Id: Long` (필수). Controller에 `// TODO(NFR-03): 로그인 사용자에서 꺼낸다` 주석. → 질문 Q3

응답 `201 Created` (`EnrollmentResponse`)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | Long | 신청 ID |
| sessionId | Long | |
| status | `EnrollmentStatus` | `CONFIRMED` 또는 `WAITING` |
| appliedAt | LocalDateTime | 신청 시각 (대기 순번 계산 기준, D-04) |
| confirmedAt | LocalDateTime | 확정 시각. 대기면 null |

대기 순번(`waitingNumber`)은 FR-05에서 이 응답에 추가한다.

오류 (본문은 공통 `ErrorResponse {code, message}`)

| 상태 | code | 언제 |
|---|---|---|
| 400 | `INVALID_REQUEST` | sessionId 누락, 헤더 누락·형식 오류 |
| 404 | `SESSION_NOT_FOUND` | 회차 없음 (기존 `CourseSessionNotFoundException`) |
| 409 | `SESSION_NOT_RECRUITING` | 회차가 모집 중이 아니거나 이미 시작됨 (기존 code 재사용) |
| 409 | `DUPLICATE_ENROLLMENT` | 같은 과정(어느 회차든)에 이미 확정·대기 신청이 있음 (D-03) |

정원이 찬 경우는 오류가 아니다. `201` + `status: WAITING`이다.

## 3. 스키마 변경: `V2__create_enrollment.sql`

```sql
CREATE TABLE enrollment (
    id           BIGSERIAL   PRIMARY KEY,
    session_id   BIGINT      NOT NULL REFERENCES course_session (id),
    course_id    BIGINT      NOT NULL REFERENCES course (id),  -- 회차의 과정을 복사해 둔다. 과정 단위 중복 방지용 (D-03)
    employee_id  BIGINT      NOT NULL,          -- 직원 테이블이 없어 FK 없음 (NFR-03 때 결정)
    status       VARCHAR(20) NOT NULL,
    applied_at   TIMESTAMP   NOT NULL,
    confirmed_at TIMESTAMP,
    CONSTRAINT ck_enrollment_status CHECK (status IN ('CONFIRMED', 'WAITING', 'CANCELLED', 'COMPLETED', 'NOT_COMPLETED'))
);

-- FK 인덱스 겸 확정 인원 계산(session_id + status)용
CREATE INDEX idx_enrollment_session_status ON enrollment (session_id, status);

-- FK 인덱스 겸 과정 단위 중복 사전 확인용
CREATE INDEX idx_enrollment_course_employee ON enrollment (course_id, employee_id);

-- FR-04·D-03 중복 방지의 최종 보장: 같은 과정에 유효 신청 1건.
-- 취소된 신청은 제외해 재신청을 허용한다
CREATE UNIQUE INDEX ux_enrollment_course_employee_active
    ON enrollment (course_id, employee_id)
    WHERE status IN ('CONFIRMED', 'WAITING');
```

- `course_id`는 신청 시 `session.getCourse().getId()`로 채우고 이후 바꾸지 않는다. 회차가 다른 과정으로 옮겨지는 기능이 없으므로 값이 어긋나지 않는다.
  DB로도 강제하려면 `course_session (id, course_id)` 유일 제약 + 복합 FK가 필요한데, 이번에는 두지 않는다.

- 상태 CHECK에 이후 상태(취소·수료·미수료)까지 미리 넣는다. 나중에 CHECK를 바꾸는 마이그레이션을 피하려는 것이다. → 질문 Q4
- 승급 여부 컬럼(D-04)은 FR-06에서 추가한다.
- `course_session`은 바꾸지 않는다. 확정 인원은 컬럼으로 두지 않고 매번 센다(원천 데이터 하나).

## 4. 코드 구성

| 패키지 | 파일 | 내용 |
|---|---|---|
| course | `CourseSessionRepository` | `@Lock(PESSIMISTIC_WRITE) @Query findByIdForUpdate(id)` 추가 |
| course | `CourseSession` | `requireOpenForEnrollment(LocalDateTime now)` 추가: 모집 중 아님·시작 시각 지남 → `ConflictException(SESSION_NOT_RECRUITING)` |
| enrollment | `Enrollment` | 엔티티. `confirm(session, employeeId, now)`, `waiting(session, employeeId, now)` 정적 팩터리. `@ManyToOne(LAZY) session`, `Long courseId`(팩터리에서 회차의 과정 ID로 채움) |
| enrollment | `EnrollmentStatus` | `CONFIRMED, WAITING, CANCELLED, COMPLETED, NOT_COMPLETED` |
| enrollment | `EnrollmentRepository` | `countBySessionIdAndStatus`, `existsByCourseIdAndEmployeeIdAndStatusIn` |
| enrollment | `EnrollmentService` | `apply(Long employeeId, Long sessionId)` |
| enrollment | `EnrollmentController` | `POST /api/v1/enrollments` |
| enrollment | `EnrollmentRequest`, `EnrollmentResponse` | DTO (Lombok, Java 8) |
| enrollment | `DuplicateEnrollmentException` | `ConflictException` 상속, code `DUPLICATE_ENROLLMENT` |

의존 방향은 enrollment → course만 있다. course는 enrollment를 모른다 (NFR-07).

## 5. 트랜잭션 경계와 동시성

`EnrollmentService.apply`는 하나의 `@Transactional`(기본 READ COMMITTED)이다.

1. `findByIdForUpdate(sessionId)`: `SELECT ... FROM course_session WHERE id = ? FOR UPDATE`. 없으면 404.
   같은 회차 신청은 여기서 한 줄로 선다. 다른 회차 신청은 서로 막지 않는다.
2. `session.requireOpenForEnrollment(now)`: 상태·시작 시각 확인.
3. 중복 사전 확인: 같은 과정·직원의 `CONFIRMED`/`WAITING`이 있으면 `DUPLICATE_ENROLLMENT`.
4. 확정 인원 = `countBySessionIdAndStatus(sessionId, CONFIRMED)`.
5. 확정 인원 < 정원이면 `Enrollment.confirm(...)`, 아니면 `Enrollment.waiting(...)`.
6. `saveAndFlush`. 유일 인덱스 위반(`DataIntegrityViolationException`)은 `DUPLICATE_ENROLLMENT`로 바꾼다.
7. 커밋할 때 락이 풀린다.

왜 정합성이 지켜지는가
- 4~6단계는 회차 행 락을 쥔 상태에서만 실행된다. 앞 트랜잭션이 커밋한 뒤에 다음 트랜잭션이 락을 얻는다.
  PostgreSQL READ COMMITTED는 문장마다 새 스냅샷을 쓰므로, 4단계의 카운트는 앞 신청을 본다. 그래서 확정 인원이 정원을 넘지 않는다.
- 같은 직원이 **같은 회차**에 동시에 신청하면 같은 락에 줄을 서므로 3단계에서 걸린다.
- 같은 직원이 **같은 과정의 다른 회차**에 동시에 신청하면 서로 다른 행을 잠그므로 락이 막지 못한다. 둘 다 3단계를 통과할 수 있고, 6단계의 `(course_id, employee_id)` 부분 유일 인덱스가 나중에 커밋하려는 쪽을 막는다(PostgreSQL은 앞 트랜잭션이 끝날 때까지 기다렸다가 위반을 판정한다). 그래서 이 경로에서 유일 인덱스는 예비가 아니라 실제로 동작하는 방어다.
- 과정 행을 잠가 모든 회차를 한 줄로 세우는 방법도 있지만, 인기 과정의 회차끼리 서로 기다리게 되므로 쓰지 않는다.
- 유일 인덱스 위반이 나면 PostgreSQL 트랜잭션은 중단 상태가 된다. 서비스는 예외를 바꿔 던지기만 하고 그 트랜잭션에서 더 쿼리하지 않는다(롤백).

알고 있는 제약
- 락 대기 시간 제한은 두지 않는다. 대기는 커넥션 풀 크기(Hikari 기본 10)만큼만 DB에서 일어나고, 나머지 요청은 풀 대기(기본 30초)다.
- 관리자 회차 수정(`CourseAdminService.update`)은 아직 락을 쓰지 않는다. 정원 축소 규칙(D-02)을 붙일 때 같은 `findByIdForUpdate`를 쓰도록 한다 (이번 범위 밖, 구현계획의 위험 영역에 적는다).
- 과정 상세의 남은 자리(`SessionResponse.remainingSeats`)는 아직 정원 그대로다. course가 enrollment를 참조할 수 없어서, 계산 위치를 정해야 한다. → 질문 Q5

## 6. 테스트 시나리오

| 종류 | 대상 | 시나리오 |
|---|---|---|
| 단위 | `CourseSession` | 모집 중·시작 전이면 통과 / `CLOSED`·`COMPLETED`면 409 / 시작 시각이 지났으면 409 |
| 단위 | `Enrollment` | `confirm`은 확정 시각이 있고, `waiting`은 확정 시각이 null |
| 단위 (Mockito) | `EnrollmentService` | 자리 있으면 `CONFIRMED` / 정원 찼으면 `WAITING` / 회차 없음 404 / 모집 마감 409 / 중복 사전 확인 409 / `DataIntegrityViolationException` → `DUPLICATE_ENROLLMENT` |
| `@WebMvcTest` | `EnrollmentController` | 201 본문 / sessionId 누락 400 / 헤더 누락 400 / 404 / 409 두 종류의 `code` 값 |
| `@DataJpaTest` | 스키마·Repository | 같은 과정·직원의 두 번째 유효 신청은 다른 회차여도 유일 인덱스 위반 / 다른 과정이면 허용 / 취소 후 재신청은 허용 / 상태별 카운트 |
| 단위 (Mockito) | `EnrollmentService` | 같은 과정의 다른 회차에 유효 신청이 있으면 409 `DUPLICATE_ENROLLMENT` |
| 동시성 (`@SpringBootTest`, test 프로필, 로컬 PostgreSQL) | NFR-01 | 정원 1 회차에 서로 다른 직원 100명이 동시에 신청 → `CONFIRMED` 정확히 1, `WAITING` 99, 예외 0 |
| 동시성 | NFR-01 | 정원 5, 100명 → `CONFIRMED` 5, `WAITING` 95 |
| 동시성 | FR-04 | 같은 직원이 같은 회차에 10번 동시 신청 → 유효 신청 1건, 나머지 9건은 `DUPLICATE_ENROLLMENT` |
| 동시성 | D-03 | 같은 직원이 같은 과정의 서로 다른 회차 5개에 동시 신청 → 유효 신청 1건, 나머지 4건은 `DUPLICATE_ENROLLMENT` (유일 인덱스 경로 검증) |

동시성 테스트 방법
- `ExecutorService`(스레드 100개) + `CountDownLatch` 출발 신호로 동시에 `enrollmentService.apply`를 호출한다.
- 테스트 메서드에 `@Transactional`을 달지 않는다 (각 스레드가 실제로 커밋해야 한다). 테스트마다 새 과정·회차를 만들어 다른 데이터와 섞이지 않게 한다.
- 결과는 DB를 다시 세서 확인한다. 실패하면 확정 인원을 메시지에 넣는다.

## 7. 질문과 결정

- ~~Q1. 중복 기준이 회차인가, 과정인가?~~ **결정: 과정 단위 (D-03).** `enrollment.course_id` + `(course_id, employee_id)` 부분 유일 인덱스로 반영했다.
- ~~Q2. 정원이 찼을 때 지금 `WAITING`으로 저장하나?~~ **결정: 저장한다.** 순번 계산·응답만 FR-05에서 붙인다.
- ~~Q3. 임시 신원 전달 방식~~ **결정: `X-Employee-Id` 헤더.** NFR-03에서 로그인 사용자로 바꿀 때 요청 본문 계약은 바뀌지 않는다.
- ~~Q4. 상태 CHECK에 이후 상태를 미리 넣나?~~ **결정: 넣는다** (`CANCELLED`, `COMPLETED`, `NOT_COMPLETED` 포함).
- ~~Q5. 과정 상세의 남은 자리(FR-02)를 이번에 고치나?~~ **결정: 이번 범위 밖.** `SessionResponse.remainingSeats`는 정원 그대로 둔다. 계산 위치는 FR-05·FR-07 설계 때 정한다.
- ~~Q6. 수료한 과정 재신청 불가(D-03)~~ **결정: FR-08로 미룬다.** 수료 상태가 생길 때 사전 확인에 추가한다.
