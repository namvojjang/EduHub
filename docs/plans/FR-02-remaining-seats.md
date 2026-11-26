# 구현계획: 회차 남은 자리 계산 (FR-02 버그 수정)

- 설계명세: `docs/design/FR-02-remaining-seats.md` (승인됨 2026-11-26, Q1~Q4 권장안). 이 계획에 없는 결정은 설계명세를 따른다.
- 상태: 승인됨 (2026-11-26)
- 브랜치: `feature/week2-fr-02-remaining-seats`
- 진행: implementer 구현 → reviewer 검토(심각·경고는 수정·재검토 최대 2회) → critical-reviewer 최종 검토(지적은 고치기 전에 개발자에게)
- 공통 제약: Java 8(record·`var`·`List.of` 금지), `javax.*`, 엔티티 `@Setter` 금지, `backend/CLAUDE.md`. **`course` 패키지는 `com.example.eduhub.enrollment`를 import하지 않는다.**
- 경로는 `backend/src/main/java/com/example/eduhub/` 기준. 완료 명령은 `backend/`에서, 실제 출력으로 보고.
- 서브에이전트는 `bootRun`·8080을 쓰지 않는다. 실제 실행 확인은 메인 세션이 한다.
- 규모(CLAUDE.md 절차 5): course·enrollment 두 패키지, 파일 약 10개. 결과를 개발자에게 보고한다.

## 단계별로 개발자가 직접 할 일

| 작업 | 직접 할 일 |
|---|---|
| 계획 | 이 구현계획 승인 |
| T1 | 없음 |
| T2 | (선택) 화면에서 "Step15 확인용 과정"이 0 / 1로 보이는지 확인 |
| T3 | 최종 검토 지적 결정, PR 병합 |

## 작업 순서

```
T1 SeatCounter·집계 쿼리·응답 계산 ─> T2 실행 확인 ─> T3 최종 검토·PR
```

---

## T1. 남은 자리 계산

변경 파일
- 새로: `course/SeatCounter.java` — 인터페이스 `Map<Long, Long> occupiedSeats(Collection<Long> sessionIds)`. Javadoc에 "enrollment가 구현한다(의존 역전, NFR-07)", 반환 Map에 없는 회차는 0
- 수정: `course/SessionResponse.java` — `from(CourseSession session, long occupied)`, `remainingSeats = (int) Math.max(0, capacity - occupied)`. 인자 없는 `from`과 2주차 주석 삭제
- 수정: `course/CourseDetailResponse.java` — `of(Course, List<CourseSession>, Map<Long, Long> occupied)` (`getOrDefault(id, 0L)`)
- 수정: `course/CourseQueryService.java` — `SeatCounter` 주입, 회차 id 목록으로 1번 조회. 회차가 없으면 호출하지 않는다
- 수정: `course/CourseAdminService.java` — 상세를 돌려주는 메서드는 같은 방식(공통 private 메서드), 회차 하나는 `Collections.singleton(id)`
- 수정: `enrollment/EnrollmentRepository.java` — `countBySessionIds(Collection<Long> ids, Collection<EnrollmentStatus> statuses)`: `select e.session.id, count(e) ... where e.session.id in :ids and e.status in :statuses group by e.session.id`, `List<Object[]>`
- 새로: `enrollment/EnrollmentSeatCounter.java` — `@Component`, `SeatCounter` 구현. 상태 상수 `CONFIRMED, COMPLETED, NOT_COMPLETED`(설계 Q2). 빈 입력이면 쿼리 없이 빈 Map
- 수정: `enrollment/EnrollmentAdminService.java` — `completeSession`이 `SeatCounter`로 계산
- 수정: `course/package-info.java`, `backend/CLAUDE.md` 패키지 규칙에 한 줄
- 테스트
  - 새로: `course/RemainingSeatsTest.java`(통합, 기존 `RosterTest`·`MyEnrollmentsTest` 방식): 설계 5장 S1~S7. S6은 Hibernate Statistics로 회차 1개·5개 과정 상세의 SQL 수가 같음
  - `SessionResponse` 단위 S8
  - 기존 서비스 단위 테스트가 생성자 변경으로 깨지면 `SeatCounter` mock 추가
- 확인: `grep -rn "eduhub.enrollment" src/main/java/com/example/eduhub/course` 결과 없음(S9)

완료 명령: `./gradlew spotlessApply test` (전체)

커밋: `fix: 회차 남은 자리를 확정·수료 인원으로 계산(FR-02, NFR-02, NFR-07)`

---

## T2. 실행 확인 (메인 세션)

- 백엔드 재시작 → `GET /api/v1/courses/3660`("Step15 확인용 과정", 정원 1, E1002 확정)의 `remainingSeats`가 0
- 화면 상세에서 "0 (정원 마감)" 빨간 표시
- `npm run generate:api` 후 생성 클라이언트에 차이가 없는지(스펙 불변) 확인
- eduhub-db로 집계 쿼리 `EXPLAIN`(유일 인덱스·session_id 인덱스 사용 여부)

## T3. 최종 검토와 PR

- `./gradlew check`, 프론트 `npm test`(응답 형식 불변 확인)
- critical-reviewer: 설계명세 + `git diff main...` + T1 검토 + T2 결과. 중점: 의존 방향, N+1, 빠진 호출처, 상태 집합, 음수 방지
- PR 본문: 원인, 의존 역전 설명(NFR-08), 남은 D-02 규칙(Q3) 후속 제안

## 위험 영역

| 위험 | 대응 |
|---|---|
| course → enrollment import | 인터페이스는 course, 구현은 enrollment. S9 grep |
| N+1 | in + group by 1번, S6 |
| 관리자 응답 누락 | 인자 없는 `from` 삭제로 컴파일 오류, S7 |
| 테스트 DB(testdb) 공유로 집계가 섞임 | 테스트마다 새 과정·회차를 만들어 그 id로만 검증 |
