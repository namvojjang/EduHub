# 설계명세: FR-07 내 신청 내역

- 상태: 승인됨 (2026-11-26, 9장 Q1~Q7 모두 권장안). 구현계획: `docs/plans/FR-07-my-enrollments.md`
- 관련: FR-07, NFR-02(N+1 없음), NFR-03(본인만), NFR-04(OpenAPI), D-04(순번 계산·승급 기록), D-05(미수료 상태)
- 참고: 교육 5회차 Step 10. 교재는 Java 21 / Boot 3라 이 프로젝트(Java 8 / Boot 2.7 / Hibernate 5.6)에 맞게 바꿨다 (8장)
- 범위 밖: 화면(Step 15), FR-08 명단·수료, 회차 시작 시 대기 자동 취소(D-01, 아직 미구현)

## 1. 요구사항 정리

| ID | 이번에 지킬 것 |
|---|---|
| FR-07 | 로그인한 사원이 **자기** 신청 내역을 상태(확정·대기·취소·수료·미수료)별로 조회한다 |
| D-04 | 대기 순번은 저장하지 않고 조회 시점에 `(applied_at, id)` 순으로 계산한다(FR-05와 같은 기준). 확정 시각과 "대기에서 승급" 여부를 내역에 보여 준다 |
| D-05 | 상태 목록에 미수료(`NOT_COMPLETED`)가 있다 |
| NFR-02 | 목록은 SQL **한 번**으로 조회한다(행마다 회차·과정·순번을 다시 읽지 않는다) |
| NFR-03 | 사원 ID는 토큰에서만 꺼낸다(`CurrentUser.from(jwt).getEmployeeId()`). 경로·쿼리·본문으로 사원 ID를 받지 않는다 (NFR-03 최종 검토 메모) |
| NFR-04 | OpenAPI 문서, 프론트 클라이언트 재생성 |

## 2. API

`GET /api/v1/me/enrollments` (operationId `listMyEnrollments`, Tag `Enrollment`) — 로그인 필요 (SecurityConfig의 `anyRequest().authenticated()`, 규칙 추가 없음)

| 쿼리 파라미터 | 타입 | 설명 |
|---|---|---|
| status | `EnrollmentStatus` (선택) | 주면 그 상태만. 생략하면 전체. 하나만 받는다 → Q6 |

응답 `200`: `List<MyEnrollmentResponse>` — **페이지 없이 전체 목록** (→ Q2), 최근 신청순(`applied_at desc, id desc`)

| 필드 | 타입 | 설명 |
|---|---|---|
| enrollmentId | Long | 신청 ID (취소 API에 쓴다) |
| sessionId | Long | 회차 ID |
| courseId | Long | 과정 ID (상세 화면 링크용) |
| courseTitle | String | 과정 제목 |
| sessionStartAt | LocalDateTime | 회차 시작 일시 |
| place | String | 장소 |
| status | `EnrollmentStatus` | CONFIRMED, WAITING, CANCELLED, COMPLETED, NOT_COMPLETED |
| waitingNumber | Integer | 대기일 때만 순번(1부터), 그 밖에는 null. 기존 `EnrollmentResponse.waitingNumber`와 같은 이름·같은 계산 |
| appliedAt | LocalDateTime | 신청 시각 |
| confirmedAt | LocalDateTime | 확정 시각. 대기·대기 중 취소면 null (D-04) |
| promoted | boolean | 대기에서 승급해 확정됐는가 (D-04) |

오류 (본문은 공통 `ErrorResponse`)

| 상태 | code | 언제 |
|---|---|---|
| 400 | `INVALID_REQUEST` | status 값이 enum에 없음 (기존 `MethodArgumentTypeMismatchException` 처리) |
| 401 | `UNAUTHENTICATED` | 토큰 없음·위조·만료 (NFR-03) |

- 신청이 없으면 `200 []`이다(404 아님).
- 경로를 `/api/v1/me/...`로 둔 이유: "내 것"이라는 뜻이 경로에 드러나고, 사원 ID 경로 변수가 들어갈 자리가 없다.

## 3. 조회 방식 (N+1 없음, 순번 계산)

`EnrollmentRepository`에 JPQL 생성자 표현식 쿼리 하나를 추가한다.

```java
@Query("select new com.example.eduhub.enrollment.MyEnrollmentResponse("
    + " e.id, s.id, c.id, c.title, s.startAt, s.place, e.status,"
    + " (select count(w) from Enrollment w"
    + "   where w.session = s and w.status = com.example.eduhub.enrollment.EnrollmentStatus.WAITING"
    + "     and (w.appliedAt < e.appliedAt or (w.appliedAt = e.appliedAt and w.id <= e.id))),"
    + " e.appliedAt, e.confirmedAt, e.promoted)"
    + " from Enrollment e join e.session s join s.course c"
    + " where e.employeeId = :employeeId and (:status is null or e.status = :status)"
    + " order by e.appliedAt desc, e.id desc")
List<MyEnrollmentResponse> findMyEnrollments(@Param("employeeId") Long employeeId,
                                             @Param("status") EnrollmentStatus status);
```

- 순번: 같은 회차 대기 중 `(appliedAt, id)`가 나보다 앞서거나 나 자신인 수 = 순번. 기존 `countAhead + 1`과 같은 결과다. 대기가 아니면 DTO 생성자에서 null로 바꾼다.
- `MyEnrollmentResponse`는 Lombok `@Value` + `@AllArgsConstructor`(Java 8이라 record 금지)에 JPQL용 생성자(순번이 `Long`으로 들어옴)를 하나 더 둔다. 두 생성자는 8번째 인자 타입(Integer/Long)으로만 갈리므로 JPQL 전용 생성자에 주석을 단다.
- **Hibernate 5.6 확인 결과**: select 절의 상관 서브쿼리, `:status is null` 조건, 생성자 표현식이 이 프로젝트(Hibernate 5.6 + PostgreSQL)에서 **위 JPQL 그대로 동작**했다(T1에서 확인, 근거 `MyEnrollmentRepositoryTest`). Q7 대안은 쓰지 않았다.
- 서비스: `MyEnrollmentQueryService`(`@Transactional(readOnly = true)`) 하나를 새로 둔다. 기존 `EnrollmentService`(변경·락)와 조회를 나눈다. Controller → Service → Repository 규칙을 지킨다.

## 4. 스키마 변경: `V5__add_enrollment_employee_index.sql`

기존 인덱스 `(session_id, status)`, `(course_id, employee_id)`, 부분 유일 `(course_id, employee_id) WHERE 유효`는 `employee_id`만으로 찾는 이 조회에 맞지 않는다(선두 컬럼이 다름).

```sql
-- FR-07: 내 신청 내역(employee_id로 찾고 최근 신청순)
CREATE INDEX idx_enrollment_employee_applied ON enrollment (employee_id, applied_at DESC, id DESC);
```

- 구현 후 eduhub-db MCP로 `EXPLAIN`을 실행해 이 인덱스를 쓰는지 확인한다(교재 Step 10 "MCP로 결과 확인"). 데이터가 적으면 순차 스캔이 나올 수 있으므로, 결과는 그대로 기록만 하고 판단은 개발자에게 맡긴다.
- 대기 순번 서브쿼리는 기존 `(session_id, status)` 인덱스를 쓴다.

## 5. 동시성·트랜잭션

- 조회 전용(`readOnly`), 락 없음. 순번은 "조회 시점 값"이다(FR-05 단건 조회와 같은 성격, D-04). 조회 중 다른 사람이 취소하면 다음 조회에서 바뀐다.
- 신청·취소 로직(NFR-01 락, D-03 유일 제약)은 바꾸지 않는다.

## 6. 테스트 시나리오

`MyEnrollmentsTest` (`@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional`, 실제 쿼리. 사원·과정은 고유 값)

준비: 정원 1 회차 A(과정 "가"), 정원 10 회차 B(과정 "나"). 사원 김·이·박. 김→A(확정), 이→A(대기 1), 박→A(대기 2), 박→B(확정). 신청은 기존 `EnrollmentService.apply`로 만든다.

| # | 시나리오 | 기대 |
|---|---|---|
| S1 | 박 토큰으로 조회 | 2건, 최근 신청순(B 확정 → A 대기), A의 `waitingNumber`=2, B는 null, 과정 제목·회차 시작·장소 포함 |
| S2 | **다른 사원 ID를 쿼리로 넣어도**: 박 토큰 + `?employeeId=<김>` | 박의 2건만 (파라미터 무시) |
| S3 | 김 토큰 | 1건, CONFIRMED, `confirmedAt` 있음, `promoted=false` |
| S4 | `?status=WAITING` (박) | 1건, WAITING |
| S5 | 김이 취소 → 이 승급 후 이 토큰으로 조회 | CONFIRMED, `promoted=true`, `confirmedAt` 있음 (D-04) |
| S6 | 신청 없는 사원 | `200 []` |
| S7 | `?status=NOPE` | 400 `INVALID_REQUEST` |
| S8 | 토큰 없음 | 401 `UNAUTHENTICATED` |
| S9 | **SQL 개수**: `hibernate.generate_statistics=true`로 조회 1회의 prepared statement 수 | **1** |
| S10 | 순번 일치: 같은 대기 신청을 `GET /api/v1/enrollments/{id}`(FR-05)로 본 `waitingNumber`와 이 목록의 값 | 같다 |

- 컨트롤러 단위 테스트(`@WebMvcTest`)는 S7·S8과 "서비스가 토큰의 사원 ID로 호출된다"만 확인한다.
- 동시성 테스트는 추가하지 않는다(조회 전용).

## 7. 영향 범위

| 항목 | 내용 |
|---|---|
| 새 파일 | `MyEnrollmentResponse`, `MyEnrollmentQueryService`, `MyEnrollmentController`(`/api/v1/me`), `V5__...sql`, 테스트 3개(`MyEnrollmentRepositoryTest`, `MyEnrollmentsTest`, `MyEnrollmentControllerTest`) |
| 수정 | `EnrollmentRepository`(쿼리 1개). 기존 `EnrollmentController`는 경로(`/api/v1/enrollments`)가 달라 바꾸지 않고 새 컨트롤러로 분리했다(구현계획 T2) |
| 프론트 | 클라이언트 재생성(`listMyEnrollments`, `MyEnrollmentResponse`). 화면은 Step 15 |
| 규모 | 파일 약 7개, diff 수백 줄 예상 |

## 8. 교재와 다르게 하는 것

| 교재 | 이 프로젝트 |
|---|---|
| `GET /api/me/enrollments` | `GET /api/v1/me/enrollments` (팀 경로 규칙) |
| `record`, text block | Lombok `@Value`, 문자열 연결 |
| `waitingNo`, `startDate`(LocalDate) | `waitingNumber`(기존 응답과 같은 이름), `sessionStartAt`(이 프로젝트의 `start_at`은 일시) |
| `confirmedAt`, `promoted` 없음 | 포함 (D-04 "내역에 바로 보이게") |
| 인덱스는 "Step 9 결과 없으면 추가" | Step 9에서 `employee_id` 선두 인덱스가 없는 것을 확인 → V5로 추가 |
| `EmployeeRepository`, `new Employee(...)` | 이 프로젝트는 사원 ID만 쓴다. 테스트는 사원 엔티티 없이 고유 ID 숫자로 신청해도 된다(FK 없음, NFR-03 설계 Q2) |

## 9. 질문과 결정

> 개발자 결정 (2026-11-26): Q1~Q7 모두 권장안.

- **Q1. 경로를 `/api/v1/me/enrollments`로.** (권장: 그렇다. 팀 규칙 `/api/v1/...`)
- **Q2. 페이지 없이 전체 목록.** 한 사원의 신청은 많아야 수십 건이고 화면도 상태 필터만 쓴다(교재 결정). (권장: 페이지 없음)
- **Q3. `confirmedAt`·`promoted`·`courseId`를 응답에 포함.** (권장: 포함. D-04와 화면 링크)
- **Q4. D-01의 "회차 시작으로 자동 취소(사유)"는 표시하지 않는다.** 자동 취소 기능과 사유 컬럼이 아직 없다. (권장: 이번 범위 밖, 그 기능을 만들 때 응답에 `cancelReason` 추가)
- **Q5. `V5` 인덱스 `(employee_id, applied_at DESC, id DESC)` 추가.** (권장: 추가)
- **Q6. 상태 필터는 하나만.** 여러 상태(`status=CONFIRMED&status=WAITING`)는 받지 않는다. (권장: 하나. 화면이 탭 하나씩 보여 주는 구조)
- **Q7. Hibernate 5.6에서 3장의 한 번 쿼리가 안 되면?**
  - (a) 네이티브 SQL 한 번(`ROW_NUMBER()` 또는 상관 서브쿼리)으로 DTO 인터페이스 프로젝션
  - (b) 목록 1번 + 대기 순번 1번(내 대기 신청들의 순번을 한 번에) = 고정 2번
  - 권장: (a). "SQL 1번" 기준을 지킨다. 결정은 첫 작업에서 실제로 막혔을 때 다시 보고한다
