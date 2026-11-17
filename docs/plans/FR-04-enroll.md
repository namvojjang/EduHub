# 구현계획: FR-04 수강 신청 + NFR-01 동시성

- 설계명세: `docs/design/FR-04-enroll.md` (승인됨). 이 계획에 없는 결정은 설계명세를 따른다.
- 상태: 승인됨 (2026-11-12)
- 브랜치: `feature/fr-04-enroll`
- 진행: 작업마다 implementer가 구현하고 reviewer가 검토한다. 심각·경고는 수정·재검토 최대 2회. 모든 작업이 끝나면 critical-reviewer가 최종 검토한다.
- 공통 제약: Java 8(record·`var`·`List.of` 금지), `javax.*`, 엔티티 `@Setter` 금지, 엔티티를 응답으로 반환 금지. 상세는 `.claude/skills/eduhub-api/SKILL.md`.
- 모든 작업의 완료 명령은 `backend/`에서 실행하고, 실제 출력(테스트 수·실패 수)으로 보고한다.

## 작업 순서

```
T1 스키마·엔티티 ─┐
T2 회차 락·검사 ──┼─> T3 서비스 ─> T4 컨트롤러 ─> T5 동시성 테스트 ─> T6 API 클라이언트·최종 확인
```

T1과 T2는 서로 의존하지 않는다. 같은 파일을 건드리지 않으므로 순서는 상관없다.

---

## T1. 스키마와 신청 엔티티·리포지토리

변경 파일
- 새로 만듦: `src/main/resources/db/migration/V2__create_enrollment.sql`
- 새로 만듦: `enrollment/EnrollmentStatus.java`, `enrollment/Enrollment.java`, `enrollment/EnrollmentRepository.java`
- 새로 만듦(테스트): `enrollment/EnrollmentRepositoryTest.java`, `enrollment/EnrollmentTest.java` (T1 검토 후 추가)

내용
- `V2__create_enrollment.sql`: 설계명세 3절의 SQL 그대로 (테이블, `ck_enrollment_status`, `idx_enrollment_session_status`, `idx_enrollment_course_employee`, `ux_enrollment_course_employee_active`).
- `EnrollmentStatus`: `CONFIRMED, WAITING, CANCELLED, COMPLETED, NOT_COMPLETED`. 클래스 주석에 D-04·D-05 참조.
- `Enrollment`: `@Entity @Table(name = "enrollment") @Getter @NoArgsConstructor(access = PROTECTED)`.
  - 필드: `id`, `@ManyToOne(fetch = LAZY, optional = false) session`, `Long courseId`, `Long employeeId`, `@Enumerated(STRING) status`, `appliedAt`, `confirmedAt`.
  - `static Enrollment confirm(CourseSession session, Long employeeId, LocalDateTime now)`: `status = CONFIRMED`, `appliedAt = confirmedAt = now`.
  - `static Enrollment waiting(CourseSession session, Long employeeId, LocalDateTime now)`: `status = WAITING`, `appliedAt = now`, `confirmedAt = null`.
  - 두 팩터리 모두 `courseId = session.getCourse().getId()`.
- `EnrollmentRepository extends JpaRepository<Enrollment, Long>`:
  - `long countBySessionIdAndStatus(Long sessionId, EnrollmentStatus status)`
  - `boolean existsByCourseIdAndEmployeeIdAndStatusIn(Long courseId, Long employeeId, Collection<EnrollmentStatus> statuses)`

테스트 (`@DataJpaTest` + `@AutoConfigureTestDatabase(replace = NONE)` + `@ActiveProfiles("test")`, `CourseRepositoryTest`와 같은 방식)
- `secondActiveEnrollmentInSameCourseViolatesUniqueIndex`: 같은 과정의 다른 회차 2개에 같은 직원 → 두 번째 `saveAndFlush`가 `DataIntegrityViolationException`
- `sameEmployeeCanEnrollInDifferentCourses`
- `cancelledEnrollmentDoesNotBlockReEnrollment`: 취소 상태 행은 테스트에서 네이티브 SQL `UPDATE`로 만든다(취소 메서드는 FR-06 범위라 엔티티에 만들지 않는다)
- `countBySessionIdAndStatusCountsOnlyThatStatus`
- `existsByCourseIdAndEmployeeIdAndStatusInFindsActiveEnrollment`
- 직원 ID는 테스트마다 고유한 값(예: `System.nanoTime()`)을 쓴다. 로컬 DB에 데이터가 남아도 충돌하지 않게 한다.
- 유일 인덱스 위반 테스트는 예외 타입뿐 아니라 메시지에 `ux_enrollment_course_employee_active`가 있는지 단언한다 (FK·NOT NULL 위반과 구별, T1 검토 제안).

테스트 (`EnrollmentTest`, 순수 단위 테스트, 설계명세 6절. T1 검토 후 추가)
- `confirmSetsConfirmedStatusAndTimes`: `CONFIRMED`, `appliedAt = confirmedAt = now`, `courseId`·`employeeId`·`session` 채움
- `waitingSetsWaitingStatusWithoutConfirmedAt`: `WAITING`, `confirmedAt == null`, `courseId` 채움

완료 명령
```bash
./gradlew spotlessApply test --tests "com.example.eduhub.enrollment.*"
```

---

## T2. 회차 신청 가능 검사와 비관적 락 조회

변경 파일
- 수정: `course/CourseSession.java`, `course/CourseSessionRepository.java`
- 새로 만듦(테스트): `course/CourseSessionTest.java`

내용
- `CourseSession.requireOpenForEnrollment(LocalDateTime now)`: 상태가 `RECRUITING`이 아니면 `ConflictException("SESSION_NOT_RECRUITING", "모집 중인 회차가 아닙니다.")`, `!startAt.isAfter(now)`이면 같은 code에 "이미 시작된 회차입니다." (D-01). 기존 `requireRecruiting`을 재사용한다.
- `CourseSessionRepository`:
  ```java
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select s from CourseSession s where s.id = :id")
  Optional<CourseSession> findByIdForUpdate(@Param("id") Long id);
  ```
  주석: NFR-01. 같은 회차 신청을 한 줄로 세운다.
- course 패키지는 enrollment를 import하지 않는다.

테스트 (`CourseSessionTest`, 순수 단위 테스트)
- `recruitingSessionBeforeStartIsOpenForEnrollment`
- `closedSessionIsNotOpenForEnrollment` (409 code 확인)
- `startedSessionIsNotOpenForEnrollment`
- 락 쿼리는 T5 동시성 테스트에서 검증한다.

완료 명령
```bash
./gradlew spotlessApply test --tests "com.example.eduhub.course.*"
```

---

## T3. 신청 서비스

선행: T1, T2

변경 파일
- 새로 만듦: `enrollment/EnrollmentService.java`, `enrollment/EnrollmentResponse.java`, `enrollment/DuplicateEnrollmentException.java`
- 새로 만듦(테스트): `enrollment/EnrollmentServiceTest.java`

내용
- `DuplicateEnrollmentException extends ConflictException`, code `DUPLICATE_ENROLLMENT`.
- `EnrollmentResponse`: Lombok `@Value` (`id, sessionId, status, appliedAt, confirmedAt`) + `static from(Enrollment)`. `sessionId`는 `enrollment.getSession().getId()`로 읽는다(지연 로딩 초기화 없이 ID만).
- `EnrollmentService` (`@Service @RequiredArgsConstructor @Transactional`):
  - `EnrollmentResponse apply(Long employeeId, Long sessionId)` — 설계명세 5절 순서 그대로:
    1. `courseSessionRepository.findByIdForUpdate(sessionId).orElseThrow(() -> new CourseSessionNotFoundException(sessionId))`
    2. `LocalDateTime now = LocalDateTime.now()`; `session.requireOpenForEnrollment(now)`
    3. `existsByCourseIdAndEmployeeIdAndStatusIn(courseId, employeeId, Arrays.asList(CONFIRMED, WAITING))`이면 `DuplicateEnrollmentException`
    4. `countBySessionIdAndStatus(sessionId, CONFIRMED) < session.getCapacity()`이고 `countBySessionIdAndStatus(sessionId, WAITING) == 0`이면 `Enrollment.confirm`, 아니면 `Enrollment.waiting` (대기자 조건은 최종 검토 W1에서 추가)
    5. `try { enrollmentRepository.saveAndFlush(e) } catch (DataIntegrityViolationException ex) { throw new DuplicateEnrollmentException(...) }` — 잡은 뒤 같은 트랜잭션에서 다른 쿼리를 하지 않는다.
       위반한 제약이 `ux_enrollment_course_employee_active`일 때만 변환하고, 다른 무결성 위반(NOT NULL, FK)은 원래 예외를 다시 던진다 (T3 검토 W1). 제약 이름은 원인 사슬의 Hibernate `ConstraintViolationException.getConstraintName()`으로 보고, 없으면 `getMostSpecificCause()` 메시지로 확인한다.
  - 메서드 주석에 FR-04, NFR-01, D-03 참조와 "락은 커밋 때 풀린다"를 적는다.

테스트 (`@ExtendWith(MockitoExtension.class)`, 리포지토리 mock, 회차·과정은 실제 엔티티 + `ReflectionTestUtils`로 id 설정)
- `applyWithSeatLeftIsConfirmed`
- `applyWhenFullIsWaiting`
- `applyToMissingSessionIsNotFound`
- `applyToClosedSessionIsConflict`
- `applyWithActiveEnrollmentInSameCourseIsDuplicate`
- `uniqueIndexViolationIsTranslatedToDuplicate`

완료 명령
```bash
./gradlew spotlessApply test --tests "com.example.eduhub.enrollment.EnrollmentServiceTest"
```

---

## T4. 신청 API

선행: T3

변경 파일
- 새로 만듦: `enrollment/EnrollmentController.java`, `enrollment/EnrollmentRequest.java`
- 수정: `common/error/GlobalExceptionHandler.java`
- 새로 만듦(테스트): `enrollment/EnrollmentControllerTest.java`

내용
- `EnrollmentRequest`: `@Getter @NoArgsConstructor @AllArgsConstructor`, `@NotNull Long sessionId`.
- `EnrollmentController`: `@Tag(name = "Enrollment", description = "수강 신청")`, `@RequestMapping("/api/v1/enrollments")`.
  - `@PostMapping @ResponseStatus(CREATED) @Operation(operationId = "applyEnrollment", summary = "수강 신청 (정원이 차면 대기)")`
  - 인자: `@RequestHeader("X-Employee-Id") Long employeeId`, `@Valid @RequestBody EnrollmentRequest request`
  - `// TODO(NFR-03): 로그인 사용자에서 employeeId를 꺼낸다. 헤더는 임시다.`
  - `@ApiResponse`: 201(`EnrollmentResponse` 스키마 명시), 400, 404, 409 (`ErrorResponse`). springdoc 1.x 규칙대로 성공 응답도 함께 단다.
- `GlobalExceptionHandler`: 헤더 누락(`MissingRequestHeaderException`)과 형식 오류(`MethodArgumentTypeMismatchException`)를 400 `INVALID_REQUEST`로 바꾸는 핸들러 추가. 지금은 처리되지 않아 공통 오류 형식이 아닌 응답이 나간다.

테스트 (`@WebMvcTest(EnrollmentController.class)` + `@MockBean EnrollmentService`)
- `applyReturnsCreated` (201, 본문 `status`)
- `applyWithoutSessionIdIsBadRequest`
- `applyWithoutEmployeeHeaderIsBadRequest` (`code = INVALID_REQUEST`)
- `applyToMissingSessionIsNotFound` (`SESSION_NOT_FOUND`)
- `applyToClosedSessionIsConflict` (`SESSION_NOT_RECRUITING`)
- `duplicateApplyIsConflict` (`DUPLICATE_ENROLLMENT`)

완료 명령
```bash
./gradlew spotlessApply test --tests "com.example.eduhub.enrollment.EnrollmentControllerTest"
```

---

## T5. 동시성 테스트 (NFR-01, D-03)

선행: T3

변경 파일
- 새로 만듦(테스트): `enrollment/EnrollmentConcurrencyTest.java`

내용
- `@SpringBootTest` + `@ActiveProfiles("test")`. 클래스·메서드에 `@Transactional`을 달지 않는다(각 스레드가 실제로 커밋해야 한다).
- 테스트마다 `CourseRepository`·`CourseSessionRepository`로 새 과정·회차(`startAt = now + 1일`)를 만들어 저장한다.
- 도우미: 작업 N개를 `ExecutorService`(N 스레드)에 넣고, `CountDownLatch ready/start`로 동시에 출발시켜 `enrollmentService.apply`를 부른다. 성공 수와 예외를 종류별로 모은다. `executor.awaitTermination` 제한 시간 60초.
- 결과는 `EnrollmentRepository.countBySessionIdAndStatus`로 DB를 다시 세서 확인한다.

시나리오
- `hundredApplicantsForOneSeatConfirmExactlyOne`: 정원 1, 직원 100명 → `CONFIRMED` 1, `WAITING` 99, 예외 0
- `hundredApplicantsForFiveSeatsConfirmExactlyFive`: 정원 5 → 5 / 95
- `sameEmployeeTenTimesOnSameSessionLeavesOneActive`: 1건 성공, 9건 `DuplicateEnrollmentException`
- `sameEmployeeOnFiveSessionsOfSameCourseLeavesOneActive`: 같은 과정 회차 5개 → 1건 성공, 4건 `DuplicateEnrollmentException` (유일 인덱스 경로)

완료 명령
```bash
./gradlew spotlessApply test --tests "com.example.eduhub.enrollment.EnrollmentConcurrencyTest"
```
이 테스트는 사람이 자기 터미널에서 직접 한 번 더 실행해 확인한다 (6회차 목표).

---

## T6. 프론트 API 클라이언트 재생성과 최종 확인

선행: T4, T5. implementer가 아니라 메인 세션(또는 개발자)이 진행한다. 백엔드 실행이 필요하기 때문이다.

내용
- `./gradlew bootRun`으로 백엔드를 띄운 뒤 `cd frontend && npm run generate:api`.
- 생성된 클라이언트에 `applyEnrollment` 메서드와 `EnrollmentRequest`, `EnrollmentResponse`, `EnrollmentStatus` 타입이 생겼는지 확인한다. 생성 코드는 손대지 않는다.
- critical-reviewer에게 설계명세 + 전체 diff(`git diff main...HEAD`에서 설정 커밋 제외 범위) + T1~T5 검토 결과를 넘긴다.

완료 명령
```bash
./gradlew check
```

---

## 위험 영역

| 위험 | 어디서 | 대응 |
|---|---|---|
| 락 없이 카운트하면 정원 초과 | T3 | 반드시 `findByIdForUpdate`로 회차를 먼저 읽는다. reviewer는 `findById`로 바뀌지 않았는지 본다. T5가 회귀를 잡는다 |
| 다른 회차 동시 신청은 락이 못 막음 | T1, T3 | 부분 유일 인덱스가 막는다. 예외 변환이 `saveAndFlush`를 감싸야 한다(`save`만 하면 커밋 시점에 터져 변환되지 않는다) |
| 락 보유 중 course SELECT 1회 추가 | T3 | `session.getCourse().getId()`가 LAZY 프록시를 초기화한다(필드 접근, Hibernate 5). 정합성 문제는 아니다. `join fetch`는 course 행까지 잠가 같은 과정의 회차 신청을 모두 직렬화하므로 쓰지 않는다. T5에서 병목이 보이면 다시 검토한다 (T3 검토 S1) |
| 유일 인덱스 위반 후 같은 트랜잭션에서 쿼리 | T3 | PostgreSQL은 트랜잭션을 중단 상태로 둔다. catch 안에서는 예외만 던진다 |
| 커넥션 풀 고갈 | T5 | 100 스레드가 풀(기본 10)을 기다린다. 풀 대기 30초를 넘기면 실패한다. 실패 시 test 프로필의 풀 설정을 확인한다(설정 파일은 개발자가 확인) |
| 테스트 데이터 잔류 | T1, T5 | 로컬 DB를 공유하므로 매번 새 과정·회차와 고유 직원 ID를 쓴다. 삭제에 기대지 않는다 |
| 관리자 정원 수정과 경합 | 범위 밖 | `CourseAdminService.update`는 락을 쓰지 않는다. D-02(정원 축소 금지·증원 승급)를 구현할 때 `findByIdForUpdate`를 쓴다 |
| 계층·의존 규칙 위반 | T2 | course 패키지가 enrollment를 import하면 안 된다 (NFR-07) |
| 3개 이상 파일·여러 계층 | T1, T3, T4 | CLAUDE.md 절차 5에 따라 작업 시작 전에 개발자에게 알린다. 각 작업은 한 기능 단위로 묶여 있고 diff는 수백 줄 이내로 예상된다 |
