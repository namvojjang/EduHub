# 구현계획: dev 프로필 기본 데이터 (과정·회차·신청)

- 설계명세: `docs/design/DEV-seed-courses.md` (승인됨 2026-11-27, Q1~Q5 권장안). 이 계획에 없는 결정은 설계명세를 따른다.
- 상태: 승인됨 (2026-11-27)
- 브랜치: `chore/dev-seed-courses`
- 진행: implementer 구현 → reviewer 검토(심각·경고는 수정·재검토 최대 2회) → critical-reviewer 최종 검토(지적은 고치기 전에 개발자에게)
- 공통 제약: Java 8(record·`var`·`List.of` 금지), `javax.*`, 엔티티 `@Setter` 금지, **도메인 코드(엔티티·서비스·리포지토리) 변경 금지**, 마이그레이션 추가·수정 금지. `course`·`enrollment`·`auth` 소스는 `com.example.eduhub.devdata`를 import하지 않는다.
- 경로는 `backend/src/main/java/com/example/eduhub/` 기준. 완료 명령은 `backend/`에서, 실제 출력으로 보고.
- 서브에이전트는 `bootRun`·8080을 쓰지 않는다. 실제 실행 확인(설계 T7)은 메인 세션이 한다.
- 규모(CLAUDE.md 절차 5): 새 파일 3개(로더·package-info·테스트) + 수정 2개(`DevAccountLoader` 한 줄, `backend/CLAUDE.md`). 약 250줄 예상.

## 단계별로 개발자가 직접 할 일

| 작업 | 직접 할 일 |
|---|---|
| 계획 | 이 구현계획 승인 |
| T1 | 없음 |
| T2 | 실행 확인은 **빈 dev DB**가 필요하다. 지금 dev DB에 과정이 있으면 로더는 아무것도 안 한다(설계 2장). DB를 비울지는 개발자가 정한다 |
| T3 | 최종 검토 지적 결정, PR 병합 |

## 작업 순서

```
T1 로더·테스트·문서 ─> T2 실행 확인(메인 세션) ─> T3 최종 검토·PR
```

---

## T1. `DevCourseLoader`

변경 파일
- 새로: `devdata/package-info.java` — "dev 프로필 전용 기본 데이터. course·enrollment·auth를 참조하지만, 도메인 패키지는 이 패키지를 참조하지 않는다 (NFR-07)"
- 새로: `devdata/DevCourseLoader.java`
  - `@Slf4j @Component @Profile("dev") @Order(2) implements ApplicationRunner`
  - 의존: `CourseRepository`, `CourseSessionRepository`, `EnrollmentRepository`, `EmployeeRepository`, `Clock`
  - 생성자 두 개(`auth/TokenService` 방식): `@Autowired public DevCourseLoader(4개 리포지토리)` → `this(..., Clock.systemDefaultZone())`, package-private `DevCourseLoader(4개 리포지토리, Clock clock)`
  - `@Override @Transactional public void run(ApplicationArguments args)`:
    1. `courseRepository.count() != 0`이면 return
    2. `LocalDateTime now = LocalDateTime.now(clock)`, `today10 = now.toLocalDate().atTime(10, 0)` 등 정시 값으로 계산(설계 4장 표)
       - 1-1: `now.toLocalDate().minusDays(1).atTime(10, 0)` (어제 10:00. 항상 과거)
       - 1-2: `+14일 10:00`, 2-1: `+7일 14:00`, 3-1: `+10일 09:00`
    3. 과정 3개를 `Course.create(title, category, description)` → `courseRepository.save`. 회차는 `course.openSession(startAt, place, capacity)` → `courseSessionRepository.save`. 저장은 인자로 넘긴 객체를 계속 쓴다(반환값 의존 없음)
    4. `employeeRepository.findByEmployeeNo("E1001"/"E1002")`. 둘 중 하나라도 없으면 `log.warn("개발 계정(E1001, E1002)이 없어 신청 데이터는 만들지 않습니다")` 후 신청 생략(설계 Q4)
    5. 신청: `Enrollment.confirm(session1_1, e1001.getId(), now.minusDays(7))`, 같은 회차 E1002, `Enrollment.confirm(session2_1, e1001.getId(), now.minusDays(1))` → `enrollmentRepository.save`
    6. 과정마다 `log.info("개발 과정 생성: {}", title)`
  - 과정 데이터(설계 4장, 확정)

    | 과정 | 분류 | 설명(한두 문장, 직접 작성) |
    |---|---|---|
    | 데이터 분석 with SQL | 데이터 | SELECT부터 집계·조인까지 업무 데이터를 SQL로 분석하는 실습 과정 |
    | Java 백엔드 기초 | 개발 | Spring Boot로 REST API를 만들고 테스트하는 입문 과정 |
    | 업무 커뮤니케이션 | 직무 | 보고·회의·메일 작성 등 일상 업무 소통 방법을 익히는 과정 |

    회차 장소·정원은 설계 4장 표 그대로(본사 3층 교육장 10/20, 온라인(Zoom) 2, 본사 5층 세미나실 30)
  - 클래스 Javadoc: dev 전용, 과정이 없을 때만, 지난 회차(1-1)는 수료 흐름(D-05) 확인용, API로는 지난 회차를 만들 수 없어 엔티티로 직접 만든다
- 수정: `auth/DevAccountLoader.java` — `@Order(1)` 추가, 주석 "과정 기본 데이터(`devdata.DevCourseLoader`, Order 2)가 사원 ID를 쓰므로 먼저 실행한다". 그 외 변경 금지
- 새로: `backend/src/test/java/com/example/eduhub/devdata/DevCourseLoaderTest.java` — mock 리포지토리(`DevAccountLoaderTest` 방식), `Clock.fixed(2026-11-27T05:30:00Z, ZoneId.of("Asia/Seoul"))`
  - `save`는 `thenAnswer(inv -> inv.getArgument(0))`로 인자를 돌려준다
  - 사원은 `Employee.create(...)` 후 `ReflectionTestUtils.setField(e, "id", 1L/2L)`
  - T1 `skipsWhenCoursesExist`: count 1 → 세 리포지토리 모두 `save` 호출 없음, `employeeRepository` 호출 없음
  - T2 `createsThreeCoursesFourSessionsThreeEnrollments`: 과정 제목 순서 `["데이터 분석 with SQL", "Java 백엔드 기초", "업무 커뮤니케이션"]`, 회차 4개, 신청 3건
  - T3 `pastSessionHasTwoConfirmedEnrollments`: 첫 과정의 첫 회차 `startAt`이 `2026-11-26T10:00`(고정 시계 기준 어제), 그 회차 신청 2건 사원 ID {1, 2}, 상태 CONFIRMED
  - T4 `otherSessionsStartInFuture`: 나머지 3회차 `startAt.isAfter(now)`
  - T5 `skipsEnrollmentsWhenDevAccountsMissing`: `findByEmployeeNo` → `Optional.empty()` → 과정 3·회차 4 저장, 신청 저장 없음
- 수정: `backend/CLAUDE.md`
  - "패키지와 계층 규칙"에 한 줄: "`com.example.eduhub.devdata`: dev 프로필 전용 기본 데이터(`DevCourseLoader`). 도메인 패키지를 참조할 수 있지만, 도메인 패키지는 이 패키지를 참조하지 않는다."
  - "인증" 절 사원 표 아래에 한 줄: "과정이 없으면 `DevCourseLoader`가 과정 3개(데이터 분석 with SQL, Java 백엔드 기초, 업무 커뮤니케이션)와 회차를 만든다. '데이터 분석 with SQL'의 어제 시작한 회차에 E1001·E1002가 확정돼 있어 바로 교육 완료·수료 처리를 확인할 수 있다. 이미 과정이 있는 DB에서는 만들지 않는다."

완료 명령
```bash
cd backend && ./gradlew spotlessApply && ./gradlew test --tests "com.example.eduhub.devdata.*" --tests "com.example.eduhub.auth.DevAccountLoaderTest" && ./gradlew check
grep -rn "eduhub.devdata" src/main/java/com/example/eduhub/course src/main/java/com/example/eduhub/enrollment src/main/java/com/example/eduhub/auth   # 출력 없어야 함 (설계 T6)
```

리뷰 중점: `@Profile("dev")`, 전부/전무 트랜잭션, 1-1이 항상 과거, D-03 위반 없음, 도메인 코드 무변경, 의존 방향.

## T2. 실행 확인 (메인 세션)

- 빈 dev DB에서 `./gradlew bootRun` → 로그 "개발 과정 생성" 3줄
- A0001 로그인 → `/api/v1/courses` 3건, 과정 ① 첫 회차 명단(관리자 API) 확정 2명 → 교육 완료 → 수료 1·미수료 1 처리 성공
- 다시 기동 → 생성 로그 없음(중복 없음)
- dev DB가 비어 있지 않으면 개발자에게 알리고 지시를 받는다(DB를 임의로 지우지 않는다)

## T3. 최종 검토·PR

- critical-reviewer: 설계명세 + 전체 diff + T1 검토 결과
- PR: `chore: dev 프로필 기본 과정·회차·신청 데이터 추가`, 본문에 실행 출력
