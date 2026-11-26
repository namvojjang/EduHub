# 구현계획: FR-07 내 신청 내역

- 설계명세: `docs/design/FR-07-my-enrollments.md` (승인됨 2026-11-26, Q1~Q7 권장안). 이 계획에 없는 결정은 설계명세를 따른다.
- 상태: 승인됨 (2026-11-26)
- 브랜치: `feature/week4-fr-07-my-enrollments`
- 진행: 작업마다 implementer가 구현하고 reviewer가 검토한다. 심각·경고는 수정·재검토 최대 2회, 넘으면 개발자에게 보고. 모든 작업이 끝나면 critical-reviewer가 최종 검토하고, 지적 사항은 고치기 전에 개발자에게 먼저 보인다.
- 공통 제약: Java 8(record·`var`·text block 금지), `javax.*`, Hibernate 5.6, 엔티티를 응답으로 반환 금지. 상세는 `.claude/skills/eduhub-api/SKILL.md`, `backend/CLAUDE.md`.
- 경로는 `backend/src/main/java/com/example/eduhub/`(테스트는 `backend/src/test/java/...`) 기준. 완료 명령은 `backend/`에서 실행하고 실제 출력으로 보고한다.
- 커밋: 작업마다, Conventional Commits + 한국어, `FR-07` 참조. 커밋은 메인 세션이 검토 통과 후 한다.
- 개발자의 백엔드가 8080에서 돌 수 있다. 서브에이전트는 `bootRun`·8080을 쓰지 않는다. 실제 실행 확인·클라이언트 재생성·MCP EXPLAIN은 메인 세션이 한다.

## 단계별로 개발자가 직접 할 일

| 작업 | 직접 할 일 |
|---|---|
| 계획 | 이 구현계획 승인 |
| T1 | 없음. 단, **Hibernate 5.6에서 한 번 쿼리가 안 되면(설계 Q7) 대안으로 바꾸기 전에 보고**하니 확인 |
| T2 | 없음 |
| T3 | 없음 (EXPLAIN 결과에서 인덱스를 안 쓰는 것으로 나오면 판단) |
| T4 | 최종 검토 지적 사항 중 고칠 것 결정, PR 리뷰·병합 |

## 작업 순서

```
T1 인덱스·DTO·쿼리(Hibernate 5.6 확인) ─> T2 서비스·API·테스트 ─> T3 클라이언트·EXPLAIN·문서 ─> T4 최종 검토·PR
```

---

## T1. 인덱스, 응답 DTO, 한 번 쿼리 (위험 먼저 확인)

변경 파일
- 새로: `src/main/resources/db/migration/V5__add_enrollment_employee_index.sql`
- 새로: `enrollment/MyEnrollmentResponse.java`
- 수정: `enrollment/EnrollmentRepository.java` (메서드 `findMyEnrollments` 1개)
- 테스트: `enrollment/MyEnrollmentRepositoryTest.java` (새)

내용
- `V5`: 설계 4장 SQL 그대로. 주석에 FR-07. V1~V4는 고치지 않는다.
- `MyEnrollmentResponse`: Lombok `@Value`. 필드는 설계 2장 표 순서(enrollmentId, sessionId, courseId, courseTitle, sessionStartAt, place, status, waitingNumber, appliedAt, confirmedAt, promoted). JPQL 생성자 표현식용 생성자를 하나 더 둔다: 순번 인자는 `Long waitingRank`, `status == WAITING`이면 `waitingRank.intValue()`, 아니면 `null`. 주석에 D-04.
- `findMyEnrollments(Long employeeId, EnrollmentStatus status)`: 설계 3장 JPQL. 주석: "FR-07. 과정·회차·대기 순번을 SQL 한 번으로(NFR-02). 순번 기준은 countAhead와 같은 (appliedAt, id)(D-04)".
- **먼저 확인할 것**: 쿼리를 쓰자마자 테스트로 실제 PostgreSQL에서 동작하는지 본다.
  - 막히면(파싱 오류, `:status is null` 타입 추론 실패 등) **대안으로 바꾸기 전에 멈추고 메인 세션에 원인과 오류 원문을 보고**한다. 메인 세션이 개발자에게 알리고 설계 Q7 (a) 네이티브 SQL 한 번으로 진행한다.
  - `:status is null` 하나만 문제면 리포지토리 메서드를 두 개(상태 있음/없음)로 나누는 것은 허용(SQL 한 번 유지). 그렇게 했으면 보고한다.

테스트 (`@DataJpaTest` + `@AutoConfigureTestDatabase(replace = NONE)` + `@ActiveProfiles("test")`, 고유 값, `hibernate.generate_statistics=true`)
- 준비: 설계 6장 준비 데이터. 신청은 `EnrollmentRepository`에 `Enrollment.confirm/waiting`로 직접 저장(서비스 없이). 사원 ID는 고유 숫자(예: 현재 nanoTime 기반) — 사원 테이블 FK 없음.
- `returnsOnlyMyEnrollmentsNewestFirst` (S1 핵심: 박 2건, 순서, 과정 제목·회차 시작·장소)
- `waitingNumberMatchesCountAhead` (S10 리포지토리 수준: 대기 2번의 값 = `countAhead + 1`)
- `filtersByStatus` (S4)
- `nonWaitingHasNullWaitingNumber`
- `runsSingleQuery` (S9: `em.flush(); em.clear();` 후 통계 초기화 → 호출 → `getPrepareStatementCount() == 1`)

완료 명령
```bash
./gradlew spotlessApply test --tests "com.example.eduhub.enrollment.MyEnrollmentRepositoryTest"
```

커밋: `feat: 내 신청 내역 조회 쿼리와 인덱스 추가(FR-07, NFR-02)`

---

## T2. 조회 서비스와 API

변경 파일
- 새로: `enrollment/MyEnrollmentQueryService.java`
- 수정: `enrollment/EnrollmentController.java` (메서드 1개 추가, 생성자 의존성 추가)
- 테스트: `enrollment/MyEnrollmentsTest.java`(새, 통합), `enrollment/EnrollmentControllerTest.java`(수정)

내용
- `MyEnrollmentQueryService`: `@Service @Transactional(readOnly = true)`, `List<MyEnrollmentResponse> list(Long employeeId, EnrollmentStatus status)` → 리포지토리 위임. 주석 FR-07, NFR-03("employeeId는 컨트롤러가 토큰에서 꺼낸 값만").
- `EnrollmentController`: 클래스 `@RequestMapping("/api/v1/enrollments")`라 경로가 다르다. 메서드에 절대 경로를 쓰지 말고, **같은 컨트롤러에 둘지 새 `MyEnrollmentController`(`/api/v1/me`)를 만들지** 구현자가 판단해 보고한다. 권장: 새 `MyEnrollmentController`(`@Tag(name = "Enrollment")`, `@RequestMapping("/api/v1/me")`) — 경로가 클래스와 맞고 기존 테스트에 영향이 없다. 그렇게 하면 변경 파일이 `EnrollmentController` 대신 새 컨트롤러가 된다.
  - `GET /enrollments` operationId `listMyEnrollments`, `@RequestParam(required = false) EnrollmentStatus status`, `@Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt` → `CurrentUser.from(jwt).getEmployeeId()`.
  - `@ApiResponse` 200(배열 스키마: `@ArraySchema(schema = @Schema(implementation = MyEnrollmentResponse.class))`), 400, 401.
- 사원 ID를 받는 파라미터는 **만들지 않는다**.

테스트
- `MyEnrollmentsTest` (`@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional`, `TestAuth.as`): 설계 6장 S1~S8, S10(FR-05 `GET /api/v1/enrollments/{id}`의 waitingNumber와 같음). 준비 데이터는 `EnrollmentService.apply`로 만든다(실제 경로). S5는 `EnrollmentService.cancel` 후 조회.
- 컨트롤러 단위(새 컨트롤러면 `MyEnrollmentControllerTest`, `@WebMvcTest` + `@Import({SecurityConfig, SecurityErrorHandlers})` + `@MockBean JwtDecoder`): `listUsesEmployeeIdFromToken`(토큰 42 → `verify(service).list(42L, null)`), `employeeIdQueryParamIsIgnored`(`?employeeId=7` 무시), `invalidStatusIsBadRequest`, `withoutTokenIsUnauthorized`.

완료 명령
```bash
./gradlew spotlessApply test
```

커밋: `feat: 내 신청 내역 조회 API 추가(FR-07, NFR-03)`

---

## T3. 클라이언트 재생성, EXPLAIN, 문서 (메인 세션이 직접)

- 백엔드 재시작 → `cd frontend && npm run generate:api` → `listMyEnrollments`·`MyEnrollmentResponse` 생성 확인 → `npm test`
- 실제 호출: E1001 토큰으로 `GET /api/v1/me/enrollments` 200, `?status=WAITING`, 토큰 없음 401
- eduhub-db MCP로 `EXPLAIN`(내 신청 내역 쿼리와 같은 SQL, 실제 사원 ID 하나) → 인덱스 사용 여부를 그대로 기록. dev DB(testdb)의 데이터 분포 때문에 순차 스캔이 나오면 그 사실만 보고
- `backend/CLAUDE.md`에 바꿀 내용이 있으면(예: "내 것" 조회 경로 규칙 `/api/v1/me/...`) 한 줄 추가

커밋: `feat: 내 신청 내역 API 클라이언트 재생성(FR-07, NFR-04)` (+ 문서 변경이 있으면 `docs:` 별도)

---

## T4. 최종 검토와 PR

- `./gradlew check`, `npm test` 실제 출력
- critical-reviewer: 설계명세 + `git diff main...` + T1~T3 검토 결과. 중점: 본인 데이터만(우회 경로), SQL 1번이 실제로 지켜지는지, 순번이 FR-05와 같은지, 인덱스, Hibernate 5.6 동작
- 지적 사항은 고치기 전에 개발자에게 보인다
- PR 본문: "Claude에게 맡긴 것 / 직접 한 것", EXPLAIN 결과, Step 15 화면에서 쓸 응답 필드

## 위험 영역

| 위험 | 대응 |
|---|---|
| Hibernate 5.6이 select 절 상관 서브쿼리·`:status is null`을 처리하지 못함 | T1에서 가장 먼저 실제 DB로 확인. 막히면 멈추고 보고 → 설계 Q7 (a) |
| 순번 계산이 FR-05(`countAhead + 1`)와 어긋남 | T1 `waitingNumberMatchesCountAhead`, T2 S10 |
| N+1 재발(누가 엔티티 조회로 바꿈) | `runsSingleQuery`가 SQL 수를 센다 |
| 남의 내역 노출 | 사원 ID 파라미터 없음, S2·`employeeIdQueryParamIsIgnored` |
| dev DB(testdb)에 테스트 데이터가 많아 EXPLAIN이 운영과 다름 | 결과만 기록, 판단은 개발자 |
