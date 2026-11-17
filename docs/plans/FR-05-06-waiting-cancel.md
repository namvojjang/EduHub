# 구현계획: FR-05 대기 순번 + FR-06 취소와 자동 승급

- 설계명세: `docs/design/FR-05-06-waiting-cancel.md` (승인됨 2026-11-17). 이 계획에 없는 결정은 설계명세를 따른다.
- 상태: 승인됨 (2026-11-17, T1 `applied_at` 정밀도 보완 조건)
- 브랜치: `feature/week3-fr-05-06`
- 진행: 작업마다 implementer가 구현하고 reviewer가 검토한다. 심각·경고는 수정·재검토 최대 2회, 넘으면 개발자에게 보고. 모든 작업이 끝나면 critical-reviewer가 최종 검토하고, 지적 사항은 고치기 전에 개발자에게 먼저 보인다.
- 공통 제약: Java 8(record·`var`·`List.of` 금지), `javax.*`, 엔티티 `@Setter` 금지, 엔티티를 응답으로 반환 금지. 상세는 `.claude/skills/eduhub-api/SKILL.md`.
- 경로는 `backend/src/main/java/com/example/eduhub/`(테스트는 `backend/src/test/java/...`) 기준. 완료 명령은 `backend/`에서 실행하고 실제 출력(테스트 수·실패 수)으로 보고한다.
- 커밋: 작업마다 1개 이상, Conventional Commits + 한국어, 요구사항 ID 참조. 커밋은 메인 세션이 검토 통과 후 한다(implementer는 커밋하지 않는다).

## 작업 순서

```
T1 스키마·엔티티 ─> T2 리포지토리 쿼리 ─> T3 서비스 ─> T4 컨트롤러 ─> T5 동시성 테스트 ─> T6 클라이언트·문서·최종 확인
```

순서대로 진행한다. T3은 T1·T2의 메서드를, T4는 T3의 응답을 쓴다.

---

## T1. 스키마와 엔티티 상태 메서드

변경 파일
- 새로 만듦: `src/main/resources/db/migration/V3__add_enrollment_promoted.sql`
- 수정: `enrollment/Enrollment.java`, `course/CourseSession.java`
- 수정(테스트): `enrollment/EnrollmentTest.java`, `course/CourseSessionTest.java`

내용
- `V3__add_enrollment_promoted.sql`: 설계명세 4절 SQL 그대로 (`promoted BOOLEAN NOT NULL DEFAULT FALSE`, 주석에 FR-06·D-04). V2는 고치지 않는다.
- `Enrollment`
  - 필드 `@Column(nullable = false) private boolean promoted;` (팩터리 `confirm`·`waiting`에서는 false 그대로).
  - `public void cancel()`: 상태가 `CONFIRMED`·`WAITING`이면 `CANCELLED`, 아니면 `ConflictException("ENROLLMENT_NOT_CANCELLABLE", "취소할 수 없는 신청입니다: " + status)`. 주석 D-04.
  - `public void promote(LocalDateTime now)`: 상태가 `WAITING`이 아니면 `IllegalStateException`(서비스 버그. 400으로 바뀌는 `IllegalArgumentException`과 구별). `status = CONFIRMED`, `confirmedAt = now`, `promoted = true`. `appliedAt`은 바꾸지 않는다. 주석 FR-06·D-04.
  - 클래스 주석에 FR-05·06 추가.
  - **시각 정밀도 (승인 보완)**: 엔티티에 들어가는 모든 시각(`appliedAt`, `confirmedAt` — 생성자·`confirm`·`promote`)을 `now.truncatedTo(ChronoUnit.MICROS)`로 맞춘다. 주석 한 줄: "PostgreSQL TIMESTAMP는 마이크로초까지 저장한다. 메모리 값과 DB 값이 같아야 순번의 동점 비교(appliedAt =)가 맞는다." JDK 8은 밀리초라 지금은 영향이 없지만 JDK를 올리면 나노초가 생긴다.
- `CourseSession.requireNotStarted(LocalDateTime now)`: `!startAt.isAfter(now)`이면 `ConflictException("SESSION_ALREADY_STARTED", "이미 시작된 회차입니다.")`. 상태는 보지 않는다(모집 마감이어도 시작 전이면 취소 가능, D-01·D-04). 기존 `requireOpenForEnrollment`는 바꾸지 않는다.

테스트
- `EnrollmentTest` (순수 단위)
  - `newEnrollmentIsNotPromoted` (confirm·waiting 모두 false)
  - `cancelConfirmedEnrollment`, `cancelWaitingEnrollment` → `CANCELLED`
  - `cancelCancelledEnrollmentIsConflict` (code `ENROLLMENT_NOT_CANCELLABLE`)
  - `promoteWaitingEnrollmentRecordsConfirmedAtAndPromoted` (`appliedAt` 불변 확인)
  - `promoteConfirmedEnrollmentIsIllegalState`
  - `timesAreTruncatedToMicros`: 나노초가 있는 시각(예: `LocalDateTime.of(2026, 1, 1, 9, 0, 0, 123456789)`)을 `waiting`·`confirm`·`promote`에 넘기면 `appliedAt`·`confirmedAt`의 나노가 `123456000`
- `CourseSessionTest` (순수 단위)
  - `sessionBeforeStartIsNotStarted`
  - `closedSessionBeforeStartIsNotStarted` (`close()` 후에도 통과)
  - `sessionAtStartTimeIsAlreadyStarted` (`now == startAt` → 409 `SESSION_ALREADY_STARTED`)
  - `sessionAfterStartIsAlreadyStarted`
- 시작 시각이 지난 회차는 `CourseSession.create`로 과거 시각을 넣어 만들 수 있는지 확인하고, 막혀 있으면 `ReflectionTestUtils`로 `startAt`을 바꾼다.

완료 명령
```bash
./gradlew spotlessApply test --tests "com.example.eduhub.enrollment.EnrollmentTest" --tests "com.example.eduhub.course.CourseSessionTest"
```
(`ddl-auto=validate`로 V3와 엔티티 일치는 T2의 `@DataJpaTest`에서도 확인된다.)

커밋: `feat: 신청 승급 여부 컬럼과 취소·승급 상태 메서드 추가(FR-06, D-04)`

---

## T2. 리포지토리 쿼리 (순번·1순위·회차 ID)

변경 파일
- 수정: `enrollment/EnrollmentRepository.java`
- 수정(테스트): `enrollment/EnrollmentRepositoryTest.java`

내용 (설계명세 2절, 6.2절)
```java
/** 취소 때 락 전에 회차 ID만 읽는다. 엔티티를 영속성 컨텍스트에 올리지 않기 위해서다 (설계명세 6.2). */
@Query("select e.session.id from Enrollment e where e.id = :id")
Optional<Long> findSessionIdById(@Param("id") Long id);

/** 대기 순번 = 이 값 + 1. 같은 회차 WAITING 중 (appliedAt, id)가 앞선 수 (FR-05, D-04, 설계명세 Q1). */
@Query("select count(e) from Enrollment e where e.session.id = :sessionId and e.status = :status"
    + " and (e.appliedAt < :appliedAt or (e.appliedAt = :appliedAt and e.id < :id))")
long countAhead(@Param("sessionId") Long sessionId, @Param("status") EnrollmentStatus status,
    @Param("appliedAt") LocalDateTime appliedAt, @Param("id") Long id);

/** 승급 대상(대기 1순위). 순번과 같은 정렬 기준 (FR-06). */
Optional<Enrollment> findFirstBySessionIdAndStatusOrderByAppliedAtAscIdAsc(
    Long sessionId, EnrollmentStatus status);
```
- `countAhead`는 status를 인자로 받되 서비스는 항상 `WAITING`을 넘긴다(JPQL에 enum 리터럴 경로를 쓰지 않기 위해).
- `findFirst...`가 생성하는 SQL이 `order by applied_at asc, id asc limit 1`인지 테스트 로그로 한 번 확인한다.

테스트 (`@DataJpaTest` + `@AutoConfigureTestDatabase(replace = NONE)` + `@ActiveProfiles("test")`, 기존 파일 방식 그대로. 직원 ID 고유값)
- `countAheadOrdersByAppliedAt`: 대기 3건(시각 t1<t2<t3) → 0, 1, 2
- `countAheadBreaksTieById`: 같은 `appliedAt` 대기 2건 → id 작은 쪽 0, 큰 쪽 1
- `countAheadIgnoresOtherSessionsAndStatuses`: 다른 회차 대기, 같은 회차 확정·취소는 세지 않는다
- `findFirstWaitingUsesSameOrder`: 같은 시각 2건 + 늦은 1건 → id 작은 같은 시각 행
- `findSessionIdByIdReturnsSessionId` / 없는 id → empty
- `promotedDefaultsToFalse`: 저장 후 `jdbcTemplate`(또는 네이티브 쿼리)로 `promoted` 컬럼 false 확인
- 같은 `appliedAt`을 만들려면 `Enrollment.waiting(session, emp, sameNow)`에 같은 `LocalDateTime`을 넘긴다. 취소 상태는 `cancel()` 메서드를 쓴다(이제 있음).

완료 명령
```bash
./gradlew spotlessApply test --tests "com.example.eduhub.enrollment.EnrollmentRepositoryTest"
```

커밋: `feat: 대기 순번·대기 1순위 조회 쿼리 추가(FR-05, FR-06, D-04)`

---

## T3. 서비스: 신청 응답 순번, 단건 조회, 취소·승급

변경 파일
- 새로 만듦: `enrollment/EnrollmentNotFoundException.java`
- 수정: `enrollment/EnrollmentService.java`, `enrollment/EnrollmentResponse.java`
- 수정(테스트): `enrollment/EnrollmentServiceTest.java`

내용
- `EnrollmentNotFoundException extends NotFoundException`, 생성자 `(Long enrollmentId)`, code `ENROLLMENT_NOT_FOUND`, 메시지 "신청을 찾을 수 없습니다: " + id. 다른 직원의 신청도 같은 예외(설계명세 Q3).
- `EnrollmentResponse`
  - 필드 추가: `Integer waitingNumber`, `boolean promoted` (기존 필드 뒤에).
  - `static from(Enrollment e, Integer waitingNumber)`로 바꾼다. 기존 `from(Enrollment)`는 지우고 호출부를 고친다(대기인데 순번을 빠뜨리는 실수를 컴파일에서 막기 위해).
- `EnrollmentService`
  - `apply`: 기존 흐름 그대로 두고, `saveAndFlush` 결과로 응답을 만들 때 `waitingNumberOf(saved)`를 넘긴다. try/catch 구조는 유지(위반 후 쿼리 금지): `saveAndFlush`만 try 안에 두고, 순번 계산과 응답 생성은 try 밖에서 한다.
  - `@Transactional(readOnly = true) public EnrollmentResponse get(Long employeeId, Long enrollmentId)`: `findById` → 없거나 `!employeeId.equals(e.getEmployeeId())`면 `EnrollmentNotFoundException` → `from(e, waitingNumberOf(e))`.
  - `public EnrollmentResponse cancel(Long employeeId, Long enrollmentId)`: 설계명세 6.2절 순서 **그대로**:
    1. `Long sessionId = enrollmentRepository.findSessionIdById(enrollmentId).orElseThrow(() -> new EnrollmentNotFoundException(enrollmentId))`
    2. `CourseSession session = courseSessionRepository.findByIdForUpdate(sessionId).orElseThrow(() -> new CourseSessionNotFoundException(sessionId))`
    3. `Enrollment enrollment = enrollmentRepository.findById(enrollmentId).orElseThrow(...)` — 1단계 전에 엔티티를 읽지 않는다
    4. 본인 아니면 `EnrollmentNotFoundException`
    5. `LocalDateTime now = LocalDateTime.now(); session.requireNotStarted(now);`
    6. `boolean wasConfirmed = enrollment.getStatus() == CONFIRMED; enrollment.cancel();`
    7. `if (wasConfirmed) promoteFirstWaiting(sessionId, now);`
    8. `return EnrollmentResponse.from(enrollment, null);`
    - 메서드 주석: FR-06, D-04, NFR-01, "락 전에 엔티티를 읽으면 낡은 상태로 이중 승급한다" 한 줄.
  - `void promoteFirstWaiting(Long sessionId, LocalDateTime now)` (패키지 전용): `findFirstBySessionIdAndStatusOrderByAppliedAtAscIdAsc(sessionId, WAITING).ifPresent(e -> e.promote(now))`. 주석: "회차 락을 쥔 호출자만 부른다. 정원 증가 승급(D-02, 후속 작업)에서 재사용한다."
  - `private Integer waitingNumberOf(Enrollment e)`: `WAITING`이 아니면 null, 맞으면 `(int) countAhead(sessionId, WAITING, appliedAt, id) + 1`.
  - **W1 보완 (T3 비교 실험 검토 후 결정, 별도 커밋)**: `promoteFirstWaiting`을 `boolean promoteFirstWaiting(CourseSession lockedSession, LocalDateTime now)`로 바꾼다. 순서: `enrollmentRepository.flush()`(명시적, 주석에 이유) → `countBySessionIdAndStatus(id, CONFIRMED) >= capacity`면 false → `findFirst...`가 없으면 false → `promote(now)`, true. `cancel` 7단계는 `promoteFirstWaiting(session, now)`. 설계명세 6.2절 7단계 참조.
  - **W2**: `apply`의 "자동 승급이 구현되면 … 항상 참" 주석을 "정원 증가 시 자동 승급(D-02)이 생기기 전까지 이 조건이 새 신청의 대기자 추월을 막는다"로 고친다.
  - W1 테스트: `cancelWhenOverCapacityDoesNotPromote`(정원 3·확정 5·대기 2, 확정 1명 취소 → 승급 없음, 확정 수 카운트 4로 mock), `cancelAtFullCapacityPromotesOne`(정원 5·확정 5·대기 2 → 취소 반영 후 4 → 승급 1), `promoteFirstWaitingFlushesBeforeCounting`(`InOrder`: `flush` → `countBySessionIdAndStatus`).
- 승급·취소는 변경 감지로 반영된다(`save` 호출 불필요). 승급 대상 조회 전에 취소 변경이 flush되지 않아도 결과는 같다(취소 대상과 승급 대상은 상태가 다르다).

테스트 (`@ExtendWith(MockitoExtension.class)`, 기존 파일 방식. 엔티티는 실제 객체 + `ReflectionTestUtils`로 id)
- apply: `waitingApplyReturnsWaitingNumber`(countAhead 2 → 3), `confirmedApplyHasNoWaitingNumber`, 기존 테스트는 응답 변경에 맞춰 고친다
- get: `getOwnWaitingEnrollmentReturnsWaitingNumber`, `getOthersEnrollmentIsNotFound`, `getMissingEnrollmentIsNotFound`
- cancel:
  - `cancelConfirmedPromotesFirstWaiting` (승급 대상 `CONFIRMED`·`promoted`·`confirmedAt`)
  - `cancelConfirmedWithoutWaitingPromotesNobody`
  - `cancelWaitingDoesNotLookUpPromotion` (`verify(..., never()).findFirst...`)
  - `cancelMissingEnrollmentIsNotFound`, `cancelOthersEnrollmentIsNotFound` (이 경우 상태가 바뀌지 않음)
  - `cancelAfterSessionStartIsConflict` (`SESSION_ALREADY_STARTED`)
  - `cancelCancelledEnrollmentIsConflict` (`ENROLLMENT_NOT_CANCELLABLE`, 승급 없음)
  - `cancelLocksSessionBeforeReadingEnrollment`: `InOrder`로 `findSessionIdById` → `findByIdForUpdate` → `findById` 순서 검증

완료 명령
```bash
./gradlew spotlessApply test --tests "com.example.eduhub.enrollment.*"
```
(서비스 응답 형태가 바뀌어 컨트롤러 테스트도 함께 돈다. 컨트롤러 테스트가 깨지면 응답 생성부만 고치고, 새 엔드포인트는 T4에서 한다.)

커밋: `feat: 대기 순번 응답과 신청 취소·대기 1순위 자동 승급(FR-05, FR-06, D-04)`

---

## T4. 컨트롤러: 단건 조회·취소 API

변경 파일
- 수정: `enrollment/EnrollmentController.java`
- 수정(테스트): `enrollment/EnrollmentControllerTest.java`

내용
- `@GetMapping("/{enrollmentId}")`, `@Operation(operationId = "getEnrollment", summary = "내 신청 단건 조회 (대기 순번 포함)")`. `@ApiResponse` 200(`EnrollmentResponse`), 400, 404.
- `@PostMapping("/{enrollmentId}/cancel")`, `@Operation(operationId = "cancelEnrollment", summary = "내 신청 취소 (확정 취소 시 대기 1순위 자동 확정)")`. `@ApiResponse` 200(`EnrollmentResponse`), 400, 404, 409(설명에 두 code). 상태 코드 200(기본).
- 두 메서드 모두 `@RequestHeader("X-Employee-Id") Long employeeId` + `// TODO(NFR-03): 로그인 사용자에서 employeeId를 꺼낸다. 헤더는 임시다.`, `@PathVariable Long enrollmentId`.
- 기존 `apply` 409 설명은 바꾸지 않는다. 클래스 주석에 FR-05·06 추가.
- `GlobalExceptionHandler`는 바꾸지 않는다(헤더 누락·형식 오류 400은 FR-04에서 이미 처리).

테스트 (`@WebMvcTest(EnrollmentController.class)` + `@MockBean EnrollmentService`)
- `applyResponseContainsWaitingNumberAndPromoted` (`$.waitingNumber`, `$.promoted`)
- `getReturnsOk`, `getMissingIsNotFound` (`ENROLLMENT_NOT_FOUND`), `getWithoutEmployeeHeaderIsBadRequest`
- `cancelReturnsOk` (`$.status = CANCELLED`), `cancelMissingIsNotFound`, `cancelNotCancellableIsConflict` (`ENROLLMENT_NOT_CANCELLABLE`), `cancelAfterStartIsConflict` (`SESSION_ALREADY_STARTED`), `cancelWithoutEmployeeHeaderIsBadRequest`

완료 명령
```bash
./gradlew spotlessApply test --tests "com.example.eduhub.enrollment.EnrollmentControllerTest"
```

커밋: `feat: 신청 단건 조회·취소 API 추가(FR-05, FR-06, NFR-04)`

---

## T5. 동시성 테스트 (NFR-01, FR-05, FR-06)

변경 파일
- 새로 만듦(테스트): `enrollment/EnrollmentCancelConcurrencyTest.java`
- 수정(테스트): `enrollment/EnrollmentConcurrencyTest.java` (시나리오 4만 추가)

내용
- 방식은 기존 `EnrollmentConcurrencyTest`와 같다: `@SpringBootTest @ActiveProfiles("test")`, `@Transactional` 없음, 매번 새 과정·회차(`startAt = now + 1일`), 고유 직원 ID, `CountDownLatch` 동시 출발, 결과는 DB를 다시 세서 확인. 도우미는 새 파일 안에 둔다(기존 테스트 클래스를 공용으로 바꾸지 않는다).
- 사전 데이터(확정 N + 대기 M)는 `enrollmentService.apply`를 **순차로** 불러 만든다(대기 순서가 apply 순서와 같아진다). 대기자의 원래 순서를 리스트로 기억한다.
- DB 기준 순번 검증 도우미: 회차의 `WAITING` 행을 `(appliedAt, id)` 순으로 읽어 각 행의 `enrollmentService.get(...)` 순번이 정확히 `1..n`인지 확인한다(서비스 경로를 그대로 검증).

시나리오 (설계명세 8절 동시성 1~4)
- `EnrollmentCancelConcurrencyTest`
  1. `confirmedCancelsAndNewAppliesKeepCapacityAndOrder`: 정원 5, 확정 5 + 대기 20 → 확정자 5명 취소 + 새 직원 20명 신청 동시 → 확정 5, `promoted = true`인 확정 5명이 원래 대기 1~5순위, 대기 35, 순번 `1..35`, 예외 0
  2. `sameEnrollmentCancelledTenTimesPromotesOnce`: 정원 1, 확정 1 + 대기 3 → 같은 신청 10번 동시 취소 → 성공 1, `ENROLLMENT_NOT_CANCELLABLE` 9, 확정 1(원래 대기 1순위, promoted), 대기 2, 순번 `1..2`
  3. `manyConfirmedCancelsPromoteEachWaitingOnce`: 정원 10, 확정 10 + 대기 15 → 확정자 10명 동시 취소 → 확정 10, 승급자 = 원래 대기 앞 10명, 대기 5
  5. `cancelAfterCapacityShrinkDoesNotPromote` (W1, 실제 DB, 동시 실행 아님): 정원 5·확정 5·대기 2 → `CourseAdminService.updateSession`으로 정원 3 → 확정 1명 `cancel` → 확정 4, 대기 2, `promoted = true` 0건 (파일별로 묶어서 번호가 4보다 앞에 온다. 이 테스트는 카운트가 취소를 반영함을 증명하지만 명시적 flush 자체는 고정하지 못한다 — 자동 flush로도 통과한다. 명시적 flush는 단위 테스트 `promoteFirstWaitingFlushesBeforeCounting`이 고정한다)
  6. `confirmedCancelAndFirstWaitingCancelPromoteSecond` (T5 검토 경고): 정원 1·확정 1·대기 3 회차 20개, 각 회차의 확정 취소와 대기 1순위 취소를 한꺼번에 동시 실행 → 회차마다 1순위 CANCELLED, 2순위 승급, 대기 1, 실패 0. 시나리오 3은 대기 15명으로 늘려 승급 10명 = 원래 앞 10명을 확인한다
- `EnrollmentConcurrencyTest`에 추가
  4. `hundredApplicantsGetDistinctWaitingNumbers`: 정원 1, 100명 동시 신청 → `waitingNumber == null` 응답 1개, 나머지 99개 순번 집합이 정확히 `{1..99}`(중복 없음: 리스트 크기 99, 집합 크기 99), DB 기준 순번도 `1..99`

락 제거 검증 (메인 세션이 직접 수행, 코드에 남기지 않음)
- 위 테스트 통과 후, `EnrollmentService.cancel`의 `findByIdForUpdate(sessionId)`를 `findById(sessionId)`로 임시 변경 → `EnrollmentCancelConcurrencyTest` 실행 → 1·2번이 실패하는 출력을 기록 → `git checkout -- EnrollmentService.java`로 원복 → 다시 통과 확인. 같은 방식으로 `apply`의 락을 빼 4번이 실패하는지도 확인한다.

완료 명령
```bash
./gradlew spotlessApply test --tests "com.example.eduhub.enrollment.EnrollmentCancelConcurrencyTest" --tests "com.example.eduhub.enrollment.EnrollmentConcurrencyTest"
```

커밋: `test: 취소·승급 동시성과 동시 신청 대기 순번 테스트 추가(NFR-01, FR-05, FR-06)`

---

## T6. API 클라이언트 재생성, 문서 갱신, 최종 확인

메인 세션이 진행한다(백엔드 실행 필요).

내용
- `./gradlew bootRun`(dev 프로필) 상태에서 `cd frontend && npm run generate:api`. `getEnrollment`, `cancelEnrollment` 메서드와 `EnrollmentResponse.waitingNumber`·`promoted`가 생겼는지 확인한다. 생성 코드는 손대지 않는다.
  커밋: `feat: 신청 조회·취소 API 클라이언트 재생성(FR-05, FR-06, NFR-04)`
- `backend/CLAUDE.md`의 "시각이 같을 때의 동점 기준은 미정이다. 임의로 정하지 않는다." 줄을 "동점이면 id 순이다(`(applied_at, id)`, `docs/design/FR-05-06-waiting-cancel.md` Q1)."로 고친다. **CLAUDE.md 변경이므로 개발자가 직접 확인한 뒤에 한다.**
  커밋: `docs: 대기 순번 동점 기준 반영(FR-05, D-04)`
- critical-reviewer에게 설계명세 + `git diff main...HEAD` + T1~T5 검토 결과를 넘긴다. 지적 사항은 고치기 전에 개발자에게 보인다.
- `./gradlew check --rerun-tasks` 실행, 결과 XML(`build/test-results/test/*.xml`)의 tests·failures·errors 합계와 `@Test` 개수를 대조한다.

완료 명령
```bash
./gradlew check --rerun-tasks
```

---

## 위험 영역

| 위험 | 어디서 | 대응 |
|---|---|---|
| 락 전에 신청 엔티티를 읽어 이중 승급 | T3 | 1단계는 회차 ID만 읽는다. T3의 `InOrder` 테스트와 T5-2가 잡는다. reviewer는 `cancel` 앞부분에 `findById(enrollmentId)`가 없는지 본다 |
| 취소에 락이 빠지면 정원 초과·승급 누락 | T3 | `findByIdForUpdate`. T5 락 제거 검증으로 테스트가 실제로 잡는지 확인한다 |
| 순번 계산과 승급 정렬 기준 불일치 | T2 | 둘 다 `(appliedAt, id)`. T2 테스트가 같은 데이터로 둘을 확인한다 |
| 유일 인덱스 위반 뒤 쿼리 | T3 | `apply`의 순번 계산은 `saveAndFlush` try 밖에서 한다. catch 안에서는 예외만 던진다 |
| 응답 계약 변경 | T3, T4, T6 | 필드 추가만 한다. 클라이언트 재생성으로 반영한다 |
| 조회 순번의 일시적 어긋남 | T3 | `get`은 락 없는 조회 시점 값(설계명세 6.4). 허용 |
| 관리자 정원 변경과 경합, 증원 시 미승급 | 범위 밖 (Q2) | PR 위험 목록에 적는다. 후속 작업은 enrollment 패키지의 public `@Transactional` 진입점에서 회차 락을 잡고 `promoteWaitingWhileSeatsAvailable`을 한 번 호출 |
| 정원 축소 후 무조건 승급 (실험 B 검토 W1) | T3 | 승급 전 확정 < 정원 확인(명시적 flush 후 카운트). 정원 하한 검사(D-02)는 후속 작업 |
| 단위 테스트로는 락 전 엔티티 로딩을 못 잡음 (S1) | T5 | T5-2(같은 신청 동시 취소)를 두고, `cancel` 1단계를 `findById`로 바꿔 실패하는지 확인한다 |
| 다른 직원 + 시작된 회차의 검사 순서 (S3) | T3 | 404가 409보다 먼저인지 단위 테스트 추가(T5 전, W1 커밋에 포함) |
| 순번이 서버 시계에 의존 (S4) | 운영 | 앱 여러 대의 시계가 어긋나면 처리 순서와 `applied_at` 순서가 다를 수 있다. 단일 인스턴스·NTP 전제. PR 위험 목록에 적는다 |
| 시작 후 남은 대기 | 범위 밖 (D-01) | 자동 마감 작업 전까지 `WAITING`으로 남는다. PR에 적는다 |
| 커넥션 풀 | T5 | 100 스레드 + 풀 10. FR-04 테스트와 같은 조건이라 문제없을 것으로 본다. 실패 시 풀 대기 시간을 먼저 확인한다 |
| 여러 계층·3개 이상 파일 | T3, T4 | 각 작업 diff는 수백 줄 이내로 예상한다. 계획 승인을 절차 5의 지시로 본다. 예상보다 커지면 멈추고 보고한다 |

---

## 최종 검토 반영 (2026-11-17, 개발자 결정: 제안 1·3·4·5·6 반영, 2는 후속)

- 제안 1 (`fix:`): `EnrollmentRepository.findSessionIdByIdAndEmployeeId`로 락 전 조회에 본인 조건을 넣어, 남의 신청·없는 신청은 락 없이 404. 기존 `findSessionIdById`는 사용처가 없으면 지운다. 테스트: 남의 신청 취소 시 `findByIdForUpdate` `never()`, 리포지토리 테스트(본인/남).
- 제안 4 (`fix:`): `promoteFirstWaiting` → `int promoteWaitingWhileSeatsAvailable(CourseSession, LocalDateTime)`. 루프마다 flush → 확정 ≥ 정원이면 종료 → 1순위 없으면 종료 → promote. 테스트: 정원 4·취소 후 확정 2·대기 3 → 2명 승급, 동시성 파일 시나리오 7(정원 2→4 후 확정 취소 → 승급 3).
- 제안 6 (`test:`): `Enrollment.cancel()`의 COMPLETED·NOT_COMPLETED 거부, GET 경로 변수·`X-Employee-Id` 형식 오류 400.
- 제안 3·5 (`docs:`): 설계명세 6.2절 명시적 flush의 성격, 3.3절 오류 판정 순서.
- 제안 2 (후속): 시나리오 4의 응답 순번을 신청별 DB 위치와 하나씩 대조.
- 검토: 1·4는 critical-reviewer 재검토. 통과 후 `./gradlew check --rerun-tasks`, 테스트 합계와 `@Test` 개수 대조.
