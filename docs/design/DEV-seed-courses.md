# 설계명세: dev 프로필 기본 데이터 (과정·회차·신청)

- 상태: 승인됨 (2026-11-27, Q1~Q5 권장안·가안 그대로). 구현계획: `docs/plans/DEV-seed-courses.md`
- 관련: FR-01~03(과정·회차), FR-04(확정), FR-08·D-05(명단·교육 완료·수료), D-01·D-03, NFR-06(운영 데이터·설정 분리), NFR-07(패키지 의존), NFR-08(이해도)
- 배경: Step 16 설계(`docs/design/FR-08-roster-ui.md`) Q6에서 미룬 작업. 지금 dev DB에는 사원 3명(`DevAccountLoader`)만 생긴다. 수료 흐름(D-05)을 확인하려면 2~3분 뒤 시작하는 회차를 만들고 기다려야 했다. 회차 등록 API(`SessionRequest.startAt`이 `@Future`)로는 지난 회차를 만들 수 없다
- 범위 밖: API·화면·스키마 변경, 운영·테스트 프로필 데이터, 기존 Flyway 마이그레이션 수정, 회차 시작 시 자동 모집 마감(D-01 스케줄러)

## 1. 목표

빈 dev DB에서 `./gradlew bootRun` → A0001(관리자)로 로그인하면 바로 다음을 확인할 수 있다.

1. 과정 목록에 교재와 같은 과정 3개
2. **시작 시각이 지난 회차**에 확정 2명(E1001, E1002) → 명단에서 "교육 완료" → 수료·미수료 처리
3. 사원(E1001·E1002)으로는 앞으로 열릴 회차에 신청·대기·취소를 해 볼 수 있다

## 2. 방식: dev 프로필 `ApplicationRunner` (기존 `DevAccountLoader`와 같은 방식)

- `@Component @Profile("dev")`. 운영·테스트 프로필에서는 빈이 만들어지지 않는다
- **과정이 하나도 없을 때만** 만든다(`courseRepository.count() == 0`). 이미 손으로 만든 과정이 있는 DB는 건드리지 않는다
- 한 트랜잭션(`@Transactional`)으로 전부 만들거나 전부 안 만든다(일부만 생기면 count가 0이 아니라 다시 채워지지 않는다. `DevAccountLoader`와 같은 이유)
- 엔티티 팩토리를 그대로 쓴다: `Course.create` → `course.openSession(startAt, place, capacity)` → `Enrollment.confirm(session, employeeId, appliedAt)`. `CourseSession.create`는 시작 시각을 검사하지 않으므로 지난 회차도 만들 수 있다. **도메인 코드는 바꾸지 않는다**
- SQL 시드(Flyway `R__`/`afterMigrate`)는 쓰지 않는다 → Q2

## 3. 위치와 의존 (NFR-07)

로더는 course(과정·회차), enrollment(신청), auth(사원 ID 조회)를 모두 써야 한다.

- `course`에 두면 enrollment를 import해야 한다 → 규칙 위반
- `enrollment`에 두면 규칙상 허용(enrollment → course). 다만 사번으로 사원 ID를 찾으려면 `auth.EmployeeRepository`가 필요해 "enrollment는 auth의 `CurrentUser`·`Employee`만" 규칙을 또 넓혀야 한다
- **새 패키지 `com.example.eduhub.devdata`에 둔다(권장, Q1)**. 개발용 데이터 전용이고 다른 도메인이 이 패키지를 참조하지 않는다(한 방향). 도메인 패키지 규칙은 그대로 둔다

```
devdata/package-info.java    (새)  "dev 프로필 전용 기본 데이터. 도메인 패키지는 이 패키지를 참조하지 않는다"
devdata/DevCourseLoader.java (새)  @Component @Profile("dev") @Order(2) ApplicationRunner
auth/DevAccountLoader.java   (수정) @Order(1) 한 줄 + 주석
```

### 실행 순서

신청에는 사원 ID가 필요하므로 계정 로더 다음에 돌아야 한다. 지금 `DevAccountLoader`에는 순서가 없다(같은 순위면 순서 보장 없음).

- `DevAccountLoader`에 `@Order(1)`, `DevCourseLoader`에 `@Order(2)`
- 그래도 사번(E1001·E1002)이 없으면(예: 사원을 손으로 지운 DB) 신청 없이 과정·회차만 만들고 `warn` 로그를 남긴다. 기동은 실패시키지 않는다 → Q4

## 4. 데이터

시각은 로더 실행 시각(`LocalDateTime.now()`) 기준 상대값. 매번 빈 DB에서 실행해도 "지난 회차"와 "앞으로 열릴 회차"가 생긴다. 시각은 정시로 자른다(`truncatedTo(HOURS)`).

> 과정 이름·분류·설명은 교재 5회차 화면에 맞춘다. 2·3번 이름은 개발자가 가안대로 확정했다(Q5)

| 과정 | 분류 | 회차 | 시작 | 장소 | 정원 | 신청 |
|---|---|---|---|---|---|---|
| ① 데이터 분석 with SQL | 데이터 | 1-1 | **어제 10:00** (지난 회차) | 본사 3층 교육장 | 10 | E1001·E1002 **확정**(신청 시각 7일 전) |
| | | 1-2 | 14일 뒤 10:00 | 본사 3층 교육장 | 20 | 없음 |
| ② Java 백엔드 기초 | 개발 | 2-1 | 7일 뒤 14:00 | 온라인(Zoom) | 2 | E1001 확정(신청 시각 1일 전) → 남은 자리 1 |
| ③ 업무 커뮤니케이션 | 직무 | 3-1 | 10일 뒤 09:00 | 본사 5층 세미나실 | 30 | 없음 |

- 1-1은 상태 `RECRUITING`(모집 중)으로 만든다. 시작이 지났으므로 신청은 막히고(`requireOpenForEnrollment`), 관리자 "교육 완료"가 가능하다(`complete`는 RECRUITING·CLOSED 모두 허용). D-01 자동 마감 스케줄러가 아직 없으므로 실제 데이터와 같은 모양이다
- 확정 2명만 넣고 대기는 넣지 않는다. 지난 회차에 대기가 있으면 D-01("시작 시 남은 대기 취소")과 어긋난 데이터가 된다
- 2-1(정원 2, 확정 1): E1002가 신청하면 정원 마감, 남은 자리 0 표시를 확인할 수 있다. 사원이 2명뿐이라 대기는 손으로 만든 과정에서 확인한다
- D-03(과정당 유효 신청 1건): E1001은 ①·② 각각 1건, E1002는 ① 1건. 위반 없음. V6 유일 인덱스도 통과
- 설명(description)은 한두 문장. 교재 문구를 그대로 옮기지 않고 요약한다

## 5. 변경 파일

| 파일 | 변경 |
|---|---|
| `devdata/DevCourseLoader.java` (새) | 위 데이터 생성. 생성 후 `info` 로그 "개발 과정 생성: {title}" |
| `devdata/package-info.java` (새) | 의존 방향 설명 |
| `auth/DevAccountLoader.java` | `@Order(1)` 추가(동작 변화 없음) |
| `test/.../devdata/DevCourseLoaderTest.java` (새) | 아래 6장 |
| `backend/CLAUDE.md` | 패키지 규칙에 `devdata` 한 줄, 인증 절의 dev 데이터 설명에 과정 3개 표 요약 |

- 스키마·API·OpenAPI·프론트 변경 없음. 마이그레이션 없음
- 리포지토리 메서드 추가 없음: `CourseRepository.count/save`, `CourseSessionRepository.save`, `EnrollmentRepository.save`, `EmployeeRepository.findByEmployeeNo`(이미 있음)를 쓴다

## 6. 테스트

| ID | 종류 | 시나리오 |
|---|---|---|
| T1 | 단위(mock 리포지토리, `DevAccountLoaderTest` 방식) | 과정이 있으면(count > 0) 아무것도 저장하지 않는다 |
| T2 | 단위 | 과정이 없으면 과정 3개, 회차 4개, 신청 3건을 저장한다. 과정 제목 순서 확인 |
| T3 | 단위 | 1-1 회차 시작 시각이 `now`보다 과거이고, 그 회차에 E1001·E1002 사원 ID로 확정 신청 2건 |
| T4 | 단위 | 나머지 회차는 시작 시각이 미래 |
| T5 | 단위 | 사번이 없으면 신청은 저장하지 않고 과정·회차는 저장한다(Q4) |
| T6 | 정적 확인(리뷰) | `@Profile("dev")`가 붙어 있다. `course`·`enrollment`·`auth` 소스가 `devdata`를 import하지 않는다 |
| T7 | 수동(메인 세션) | 빈 dev DB에서 `bootRun` → 로그에 과정 3개 생성 → A0001 로그인 → 과정 ① 명단에 확정 2명 → 교육 완료 → 수료·미수료 처리 성공 |

- 시각 검증을 위해 로더는 `TokenService`처럼 생성자 두 개를 둔다: 스프링용(`Clock.systemDefaultZone()`)과 테스트용(package-private, `Clock` 인자). `Clock` 빈은 없다
- 기존 `./gradlew check`(테스트 프로필)는 이 로더가 만들어지지 않으므로 영향 없음

## 7. 위험

| 위험 | 대응 |
|---|---|
| 운영에 시드가 들어감 | `@Profile("dev")`만. 운영은 프로필을 반드시 지정한다(backend/CLAUDE.md). 리뷰 T6 |
| 계정 로더보다 먼저 실행돼 신청이 빠짐 | `@Order(1)/(2)` + 사번 없을 때 건너뛰기(T5) |
| 이미 쓰던 dev DB에 중복 생성 | 과정이 하나라도 있으면 아무것도 안 함(T1). 이미 쓰던 DB에서 보고 싶으면 dev DB를 비우고 다시 실행(문서에 안내, `flywayClean`은 훅이 막으므로 DB를 지우는 방법은 개발자 판단) |
| course → enrollment 의존 | `devdata`에 둔다(Q1) |
| 같은 빈 dev DB로 두 프로세스를 동시에 기동하면 과정이 중복 생성될 수 있음(count 확인에 락 없음) | dev 전용이라 허용. 한 번에 하나만 기동 |

## 8. 질문과 결정

| # | 질문 | 권장 |
|---|---|---|
| Q1 | 로더 위치: ① 새 `devdata` 패키지 ② `enrollment` 패키지(auth 참조 규칙 확대) ③ `course`·`enrollment`에 로더 2개 | **①** 도메인 규칙을 바꾸지 않고, 개발용 코드가 한곳에 모인다 |
| Q2 | 방식: ① Java 로더 ② Flyway `afterMigrate.sql`(dev 전용 location) | **①** "지난 회차"를 실행 시각 기준으로 만들 수 있고 엔티티 규칙(정원 > 0 등)을 거친다. SQL은 날짜가 고정되거나 DB 함수에 의존한다 |
| Q3 | 시각 기준 | **실행 시각 기준 상대값, 정시로 자름** |
| Q4 | 사번이 없을 때 | **신청만 건너뛰고 warn 로그**. 기동 실패는 과하다 |
| Q5 | 과정 3개의 이름·분류(교재 5회차 화면) | ①은 "데이터 분석 with SQL". ②·③은 가안("Java 백엔드 기초", "업무 커뮤니케이션")으로 확정(2026-11-27) |
