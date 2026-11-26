# 설계명세: 회차 남은 자리 계산 (FR-02 버그 수정)

- 상태: 승인됨 (2026-11-26, 7장 Q1~Q4 모두 권장안). 구현계획: `docs/plans/FR-02-remaining-seats.md`
- 관련: FR-02(회차의 남은 자리), FR-04·05(정원), D-01·D-02·D-05, NFR-02(N+1 없음), NFR-07(course는 enrollment에 의존하지 않음)
- 발견: Step 15 브라우저 확인(PR #11). 정원 1 회차에 확정 1명인데 상세가 "남은 자리 1 / 1"
- 범위 밖: 정원 증가 시 대기자 자동 확정(D-02 앞부분), 정원 감소 검사(D-02 "확정 인원보다 작게 줄일 수 없다"), 화면 문구 변경. 7장 Q3 참고

## 1. 원인

`course/SessionResponse.from`이 2주차 임시값을 그대로 쓴다.

```java
// 수강 신청(3주차) 전까지는 정원 그대로. 확정 인원 계산은 그때 붙인다.
session.getCapacity(),
```

3주차 신청(FR-04)을 붙일 때 이 계산이 빠졌다. 테스트(`CourseControllerTest`)도 신청이 없는 회차만 확인해서 잡지 못했다.

같은 `from`을 쓰는 곳은 다섯 군데다.
- 공개 상세: `CourseQueryService.getDetail` → `CourseDetailResponse.of`
- 관리자: `CourseAdminService`(createCourse·updateCourse·closeCourse가 돌려주는 상세, createSession·updateSession·closeSession)
- 회차 교육 완료: `EnrollmentAdminService.completeSession`

## 2. 핵심 제약: course는 enrollment를 모른다 (NFR-07)

남은 자리를 계산하려면 신청(enrollment) 수를 세야 한다. 그런데 `course` 패키지는 `enrollment`를 import할 수 없다. 의존 방향은 enrollment → course만 허용된다.

**해결: course에 "회차별 자리 수를 알려 주는" 인터페이스를 두고, enrollment가 구현한다.** 이 방식을 의존 역전이라고 한다.

```
course/SeatCounter.java            (새, 인터페이스)  Map<Long, Long> occupiedSeats(Collection<Long> sessionIds)
enrollment/EnrollmentSeatCounter.java (새, @Component, SeatCounter 구현)  → EnrollmentRepository 집계 쿼리 1번
```

- `course`는 자기 패키지의 `SeatCounter`만 안다. import 방향은 지금 규칙 그대로다.
- Spring이 실행 시 `EnrollmentSeatCounter`를 주입한다.
- 대안과 비교: 7장 Q1

## 3. 계산 규칙

- `remainingSeats = max(0, capacity - occupied)`
- `occupied` = 그 회차에서 자리를 차지한 신청 수. **CONFIRMED + COMPLETED + NOT_COMPLETED**(7장 Q2)
  - WAITING·CANCELLED는 자리를 차지하지 않는다
  - 신청 판단(`EnrollmentService.apply`)은 지금처럼 CONFIRMED만 센다. 수료 상태는 교육 완료 회차에만 있고, 그런 회차는 신청을 받지 않는다. 그래서 두 기준은 신청이 가능한 회차에서 항상 같은 값이 된다
- `max(0, …)`: 정원 감소 검사(D-02)가 아직 없다. 정원이 확정 인원보다 작아지면 음수가 나오므로 0으로 막는다
- 조회 시점의 스냅샷이다(락 없음). 신청 가능 여부는 계속 `apply`의 FOR UPDATE가 판단한다. 남은 자리가 0이어도 대기 신청은 된다(FR-05)

## 4. 변경

| 파일 | 변경 |
|---|---|
| `course/SeatCounter.java` (새) | `Map<Long, Long> occupiedSeats(Collection<Long> sessionIds)`. 빈 목록이면 빈 Map. 신청이 없는 회차는 Map에 없음(0으로 본다) |
| `course/SessionResponse.java` | `from(CourseSession session, long occupied)`로 바꾼다. 인자 없는 `from`은 지운다. 컴파일러가 빠진 호출을 찾아 준다 |
| `course/CourseDetailResponse.java` | `of(course, sessions, Map<Long, Long> occupied)` |
| `course/CourseQueryService.java` | 회차 id 목록으로 `seatCounter.occupiedSeats(ids)` **1번** → `of` |
| `course/CourseAdminService.java` | 상세를 돌려주는 곳은 위와 같이 처리. 회차 하나를 돌려주는 곳은 `occupiedSeats(singleton(id))` |
| `enrollment/EnrollmentRepository.java` | `@Query("select e.session.id, count(e) from Enrollment e where e.session.id in :ids and e.status in :statuses group by e.session.id") List<Object[]> countBySessionIds(...)` |
| `enrollment/EnrollmentSeatCounter.java` (새) | 위 쿼리로 Map을 만든다. 상태 집합(Q2)은 이 클래스의 상수 |
| `enrollment/EnrollmentAdminService.completeSession` | `SessionResponse.from(session, …)`. 이미 enrollment 안이므로 `SeatCounter`를 같이 쓴다 |
| `course/package-info.java`, `backend/CLAUDE.md` | "course는 `SeatCounter` 인터페이스로만 자리 수를 받는다(enrollment가 구현)" 한 줄 |

- API 응답 형식은 그대로다(`remainingSeats` 필드는 원래 있음). OpenAPI 스펙과 생성 클라이언트도 바뀌지 않는다
- 스키마 변경 없음. 마이그레이션 없음

## 5. 테스트

| ID | 대상 | 시나리오 |
|---|---|---|
| S1 | 통합(`CourseQueryService` 또는 `/api/v1/courses/{id}`) | 정원 3: 확정 2, 대기 0 → 남은 1 |
| S2 | 통합 | 정원 1: 확정 1, 대기 2 → 남은 0 (대기는 세지 않음) |
| S3 | 통합 | 확정 1, 취소 1 → 취소는 세지 않음 |
| S4 | 통합 | 수료 1, 미수료 1(교육 완료 회차) → 둘 다 자리를 차지 (Q2) |
| S5 | 통합 | 신청 없는 회차는 정원 그대로, 회차 없는 과정은 빈 목록(쿼리를 부르지 않음) |
| S6 | 통합 | **N+1 없음**: 회차 1개 과정과 회차 5개 과정의 상세 조회 SQL 수가 같다(Hibernate Statistics, 기존 `MyEnrollmentsTest` 방식) |
| S7 | 통합 | 관리자 `updateSession`·`closeSession` 응답도 확정 인원을 반영한다 |
| S8 | 단위 | `SessionResponse.from`: 확정 > 정원이면 0 |
| S9 | 아키텍처 | `course` 패키지 소스가 `com.example.eduhub.enrollment`를 import하지 않는다(grep 확인, 리뷰 중점) |

- 기존 `CourseControllerTest`(`remainingSeats` 30)는 `@WebMvcTest`로 서비스를 mock하므로 그대로 둔다
- 확인(메인 세션): 백엔드 재시작 후 "Step15 확인용 과정"(정원 1, E1002 확정)의 상세가 **0 / 1**, 화면에서 빨간 "0 (정원 마감)"

## 6. 위험

| 위험 | 대응 |
|---|---|
| course → enrollment 의존이 생김 | 인터페이스는 course에 두고 구현은 enrollment에 둔다. S9 |
| 상세에서 회차마다 count(N+1) | `in` + `group by` 1번. S6 |
| `from`을 쓰는 곳 중 하나를 빠뜨림(관리자 응답만 정원 그대로) | 인자 없는 `from`을 지워 컴파일 오류로 찾는다. S7 |
| 관리자 서비스 단위 테스트가 새 의존성 때문에 깨짐 | `SeatCounter` mock 추가. 테스트 수정 범위로 본다 |
| 정원 감소로 음수 | `max(0, …)`, S8 |

## 7. 질문과 결정

| # | 질문 | 권장 |
|---|---|---|
| Q1 | 남은 자리를 어떻게 셀까? ① course 인터페이스 + enrollment 구현(의존 역전) ② course 리포지토리에 `enrollment` 테이블 네이티브 SQL(import는 없지만 숨은 의존) ③ `course_session`에 확정 인원 컬럼을 두고 신청·취소·승급마다 갱신 | **①** 규칙(NFR-07)을 지키고 의존이 코드에 드러난다(NFR-08). ③은 마이그레이션과 모든 변경 경로 갱신이 필요하고 값이 어긋날 위험이 있다 |
| Q2 | 수료(COMPLETED)·미수료(NOT_COMPLETED)도 자리를 차지한 것으로 셀까? | **센다.** 교육이 끝난 회차가 "남은 자리 10 / 10"으로 보이면 이상하다. 신청 판단에는 영향이 없다(3장) |
| Q3 | D-02의 빠진 두 규칙(정원 감소 검사, 정원 증가 시 자동 확정)도 이번에 할까? | **이번엔 하지 않는다.** 둘 다 같은 `SeatCounter`로 구현할 수 있다. 다만 회차 락과 승급 로직이 필요해서 별도 작업(FR-03·D-02)으로 제안한다 |
| Q4 | 남은 자리 0일 때 신청 버튼 문구를 "대기 신청"으로 바꿀까? | **이번엔 하지 않는다**(백엔드 버그 수정만). 화면은 이미 빨간 "0 (정원 마감)"을 보인다. 필요하면 Step 16 이후 화면 작업에서 |
