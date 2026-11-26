# 구현계획: FR-08 회차 명단과 수료 처리

- 설계명세: `docs/design/FR-08-roster-completion.md` (승인됨 2026-11-26, Q1~Q7 권장안). 이 계획에 없는 결정은 설계명세를 따른다.
- 상태: 승인됨 (2026-11-26)
- 브랜치: `feature/week4-fr-08-roster-completion`
- 진행: 작업마다 implementer 구현 → reviewer 검토. 심각·경고는 수정·재검토 최대 2회, 넘으면 개발자에게 보고. 모든 작업 후 critical-reviewer 최종 검토, 지적 사항은 고치기 전에 개발자에게 먼저 보인다.
- 공통 제약: Java 8(record·`var`·text block·`List.of` 금지), `javax.*`, Hibernate 5.6, 엔티티 `@Setter` 금지, 엔티티를 응답으로 반환 금지. `.claude/skills/eduhub-api/SKILL.md`, `backend/CLAUDE.md`.
- 경로는 `backend/src/main/java/com/example/eduhub/` 기준. 완료 명령은 `backend/`에서, 실제 출력으로 보고.
- 커밋: 작업마다, Conventional Commits + 한국어, `FR-08`·`D-xx` 참조. 메인 세션이 검토 통과 후 커밋.
- 서브에이전트는 `bootRun`·8080을 쓰지 않는다. 실제 실행 확인·클라이언트 재생성은 메인 세션이 한다.
- 규모(CLAUDE.md 절차 5): course·enrollment 두 패키지 + 마이그레이션 + 기존 신청 로직. 작업마다 결과를 개발자에게 보고한다.

## 단계별로 개발자가 직접 할 일

| 작업 | 직접 할 일 |
|---|---|
| 계획 | 이 구현계획 승인 |
| T1~T3 | 없음 (작업마다 결과 확인) |
| T4 | 없음 (실제 호출 결과 확인) |
| T5 | 최종 검토 지적 사항 결정, PR 리뷰·병합 |

## 작업 순서

```
T1 상태 규칙·D-03(엔티티, V6, 신청 사전 확인) ─> T2 명단 조회 ─> T3 회차 완료·수료 처리(락, 동시성) ─> T4 클라이언트·실행 확인·문서 ─> T5 최종 검토·PR
```

T1이 엔티티 메서드와 V6를 만들고, T2·T3이 그것을 쓴다. T2와 T3은 같은 새 서비스·컨트롤러 파일을 건드리므로 순서대로 한다.

---

## T1. 상태 규칙과 D-03 수료 재신청 금지

변경 파일
- 새로: `src/main/resources/db/migration/V6__block_reapply_after_completion.sql` (설계 4장 SQL 그대로, 인덱스 이름 유지)
- 수정: `course/CourseSession.java` — `complete(LocalDateTime now)`, `requireCompleted()` (설계 3장, code `SESSION_NOT_STARTED`·`SESSION_ALREADY_COMPLETED`·`SESSION_NOT_COMPLETED`)
- 수정: `enrollment/Enrollment.java` — `recordCompletion(boolean passed)`: `CONFIRMED`만 → `COMPLETED`/`NOT_COMPLETED`, 아니면 `IllegalStateException`(서비스가 사유 코드로 바꾼다. 400이 되는 `IllegalArgumentException`과 구별)
- 수정: `enrollment/EnrollmentService.apply` — 사전 확인을 두 단계로: ① 같은 과정에 `COMPLETED`가 있으면 `ConflictException("ALREADY_COMPLETED_COURSE", "이미 수료한 과정입니다: " + courseId)` ② 기존 확정·대기 확인(`DUPLICATE_ENROLLMENT`) 그대로. 유일 인덱스 위반 처리(`isActiveEnrollmentViolation`)는 그대로 `DUPLICATE_ENROLLMENT`
- 리포지토리: 필요하면 `existsByCourseIdAndEmployeeIdAndStatus(...)` 추가
- 테스트: `CourseSessionTest`, `EnrollmentTest`(엔티티 단위), `EnrollmentServiceTest`(D1·D2 단위, Mockito), `EnrollmentRepositoryTest`(D3: 수료 행이 있는 (과정, 사원)으로 신청 행 `saveAndFlush` → `DataIntegrityViolationException`, 미수료 행이면 통과)

먼저 확인: V6 적용 전 eduhub-db에 `COMPLETED` 행이 없음(메인 세션이 설계 단계에서 확인함: CANCELLED·CONFIRMED·WAITING만). 테스트 DB도 같은 `testdb`다.

테스트 이름 예: `completeBeforeStartIsConflict`, `completeAfterStartChangesStatus`, `completeTwiceIsConflict`, `closedSessionCanBeCompleted`, `recordCompletionOnConfirmed`, `recordNotCompletedOnConfirmed`, `recordCompletionOnWaitingIsIllegalState`, `applyToCompletedCourseIsConflict`, `applyAfterNotCompletedIsAllowed`, `completedRowBlocksNewActiveRowByUniqueIndex`

완료 명령: `./gradlew spotlessApply test` (전체 — V6가 기존 신청·동시성 테스트에 영향이 없는지)

커밋: `feat: 회차 교육 완료·수료 상태 규칙과 수료 과정 재신청 금지(FR-08, D-03, D-05)`

---

## T2. 명단 조회

변경 파일
- 새로: `enrollment/RosterEntry.java`, `enrollment/RosterResponse.java` (Lombok `@Value`, 설계 2-2 필드)
- 새로: `enrollment/EnrollmentAdminService.java` (`@Service @Transactional`, 이 작업에서는 `roster(sessionId)`만, `@Transactional(readOnly = true)`)
- 새로: `enrollment/EnrollmentAdminController.java` (`@Tag(name = "EnrollmentAdmin")`, `@RequestMapping("/api/v1/admin/sessions/{sessionId}")`, `GET /roster` operationId `getRoster`, 200·403·404 `@ApiResponse`)
- 수정: `enrollment/EnrollmentRepository.java` — 명단 쿼리: `left join Employee m on m.id = e.employeeId`, 상태 집합 필터, `order by e.appliedAt, e.id`. 대기 순번은 같은 기준이라 대기 목록을 순서대로 1부터 매긴다(FR-05·07과 같은 `(appliedAt, id)`). JPQL 생성자 표현식으로 엔티티 로딩 없이. 확정 목록 1번 + 대기 목록 1번 + 회차 조회 = SQL 고정 개수(N+1 없음)
- 수정: `auth/package-info.java`, `backend/CLAUDE.md` — 패키지 규칙 "enrollment는 auth의 `CurrentUser`와 `Employee`(명단 조회 읽기)만 참조" (설계 Q7)
- 테스트: `RosterTest`(통합) R1·R2·R3(명단 부분), `EnrollmentAdminControllerTest`(`@WebMvcTest` + 보안 Import, 403·404 위주)

주의: `left join Employee ... on`이 Hibernate 5.6에서 되는지 먼저 확인. 안 되면 대안으로 바꾸기 전에 멈추고 보고한다.

완료 명령: `./gradlew spotlessApply test`

커밋: `feat: 회차 명단 조회 API 추가(FR-08)`

---

## T3. 회차 교육 완료와 수료 처리

변경 파일
- 수정: `enrollment/EnrollmentAdminService.java` — `completeSession(sessionId)`: `courseSessionRepository.findByIdForUpdate` → `session.complete(now)` → 그 회차 `WAITING` 전부 `cancel()` → `SessionResponse` 반환. `recordCompletions(sessionId, result, employeeIds)`: 회차 락 → `requireCompleted()` → 요청 사원 ID 중복 제거(순서 유지) → 회차·사원 ID로 신청 일괄 조회(SQL 1번) → 사원마다 `recordCompletion` 또는 실패 사유(설계 2-3 code). `NOT_ENROLLED`/`WAITING`/`CANCELLED`/`ALREADY_RECORDED`
- 새로: `enrollment/CompletionRequest.java`(`result` `@NotNull`, `employeeIds` `@NotEmpty @Size(max = 200)`, 원소 `@NotNull`), `CompletionResponse.java`, `CompletionFailure.java`, `CompletionResult` enum(`COMPLETED`, `NOT_COMPLETED`) — 이름이 `EnrollmentStatus`와 헷갈리지 않게 enum 이름은 구현자가 판단(예: `CompletionOutcome`)하고 보고
- 수정: `enrollment/EnrollmentAdminController.java` — `POST /complete`(operationId `completeSession`), `POST /completions`(operationId `recordCompletions`), 200·400·403·404·409 `@ApiResponse`
- 리포지토리: `findBySessionIdAndEmployeeIdIn`, `findBySessionIdAndStatus`(대기 취소용) 등 필요한 것
- 테스트: `RosterTest`에 C1~C3, P1~P5 / 동시성 `EnrollmentCompletionConcurrencyTest`(K1, 기존 `EnrollmentCancelConcurrencyTest` 방식: 두 스레드가 같은 사원 수료 처리 → processed 1명, `ALREADY_RECORDED` 1명) / `EnrollmentAdminControllerTest`에 400·409 / FR-07 연동(P4: 미수료가 `/api/v1/me/enrollments`에 `NOT_COMPLETED`로)

완료 명령: `./gradlew spotlessApply test` (전체)

커밋: `feat: 회차 교육 완료와 수료·미수료 처리 API 추가(FR-08, D-01, D-05)`

---

## T4. 클라이언트, 실행 확인, 문서 (메인 세션)

- 백엔드 재시작 → `npm run generate:api` → `getRoster`, `completeSession`, `recordCompletions` 생성 확인 → `npm test`
- 실제 호출(A0001 관리자, E1001 사원): 명단 200/403, 시작 전 회차 완료 409, 시작 지난 회차 완료 → 대기 취소 확인, 수료 처리 부분 성공, 수료한 E1001 재신청 409 `ALREADY_COMPLETED_COURSE`. dev DB에 남는 데이터는 확인 후 가능한 범위에서 정리하고 남은 것은 보고
- eduhub-db로 V6 인덱스 정의와 명단 쿼리 `EXPLAIN`
- `docs/requirements.md`는 바꾸지 않는다(D-05를 따랐으므로). 교재와 다른 점은 설계명세 8장에 이미 있다

커밋: `feat: 명단·수료 처리 API 클라이언트 재생성(FR-08, NFR-04)`

---

## T5. 최종 검토와 PR

- `./gradlew check`, `npm test`
- critical-reviewer: 설계명세 + `git diff main...` + T1~T4 검토 결과. 중점: D-05 규칙이 빠짐없이 지켜지는가, 락과 동시성, V6가 기존 동작(취소 후 재신청, 미수료 재신청)을 깨지 않는가, 관리자 권한, 패키지 의존
- 지적 사항은 고치기 전에 개발자에게
- PR 본문: 교재와 다른 업무 규칙(D-05), "Claude에게 맡긴 것 / 직접 한 것", Step 16 화면에서 쓸 API

## 위험 영역

| 위험 | 대응 |
|---|---|
| V6 인덱스 교체가 기존 신청 중복 판별을 깨뜨림 | 인덱스 이름 유지, T1 전체 테스트(동시성 포함) |
| V6 마이그레이션 실패(수료 행 + 유효 행 공존) | 현재 COMPLETED 0건 확인. 운영 적용 전에도 같은 조회 |
| 수료 처리 동시 실행으로 이중 처리 | 회차 락 + K1 동시성 테스트 |
| 회차 완료와 신청·취소가 겹침 | 같은 회차 락 사용(신청·취소도 회차 락) |
| `left join Employee on`이 Hibernate 5.6에서 안 됨 | T2에서 먼저 확인, 막히면 보고 |
| course → enrollment 역의존 생김 | 회차 완료 API를 enrollment 쪽 서비스에 둠(설계 5장). 리뷰 중점 |
| D-05를 어기는 경로(완료 전 수료) | `requireCompleted` + P1 테스트 |
