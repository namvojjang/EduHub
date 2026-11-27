# 설계명세: 신청 확정·대기 승급 알림 기록 (FR-09)

- 상태: 승인됨 (2026-11-27, Q1~Q6 권장안). **개정 2026-11-27**: 구현 중 AFTER_COMMIT + REQUIRES_NEW가 동시 요청에서 커넥션 풀을 고갈시키는 것을 확인해, 같은 트랜잭션(BEFORE_COMMIT) 기록으로 바꿨다(2장, Q2·Q3, 개발자 결정 "같은 트랜잭션")
- 관련: FR-09(확정·대기 승급 시 알림, 처음에는 로그·DB 기록), D-04(자동 승급, `promoted` 기록), NFR-01(정원 정합성), NFR-03(개인정보), NFR-07(패키지 규칙)
- 참고: 교육 6회차 5장(커밋 이후 이벤트)
- 범위 밖: 메일·메신저 실제 발송, 프론트 화면, 알림 조회 API(Q5), 대기 등록·취소·수료 알림

## 1. 요구사항 정리

| 언제 | 알림 | 지금 코드 |
|---|---|---|
| 신청이 바로 **확정**됨 | "수강 신청이 확정되었습니다" | `EnrollmentService.apply`에서 `Enrollment.confirm(...)` |
| 대기에서 **승급**되어 확정됨 | "대기에서 확정되었습니다" | `promoteWaitingWhileSeatsAvailable`의 `promote(now)` (지금은 확정 취소 때, 나중에 D-02 정원 증가 때도 같은 메서드) |

- 대기로 저장된 신청은 알림이 없다(FR-09 범위는 확정·승급). 대기는 신청 응답에 순번이 바로 보인다.
- **커밋된 신청에만** 알림 기록이 있다. 롤백된 신청의 알림은 없어야 한다.
- 신청과 알림 기록은 **함께 커밋되거나 함께 롤백**된다(원자성). 알림 기록은 나중에 실제 발송을 붙일 때 "보낼 목록"(아웃박스)이 된다.

## 2. 흐름: 같은 트랜잭션에서 커밋 직전 기록 (개정)

```
EnrollmentService (트랜잭션, 회차 락)
  ├─ 확정 또는 승급
  ├─ publishEvent(EnrollmentConfirmedEvent)   ← 아직 실행되지 않고 커밋 직전을 기다림
  ├─ NotificationListener  @TransactionalEventListener(BEFORE_COMMIT)
  │     └─ 같은 트랜잭션·같은 커넥션으로 notification 저장 + DEBUG/INFO 로그(ID만)
  └─ COMMIT (신청과 알림이 함께, 락 해제)
```

| 방식 | 판단 |
|---|---|
| 서비스 안에서 바로 저장 | △ 원자성은 같지만 enrollment가 notification을 알게 된다(패키지 규칙) |
| `@EventListener`(일반) | △ 발행 즉시 실행돼, 발행 뒤 예외로 롤백될 일을 리스너가 미리 처리한다. 커밋 직전이 더 명확하다 |
| `@TransactionalEventListener(AFTER_COMMIT)` + `REQUIRES_NEW` (최초 설계, 교재) | ✗ **커넥션 풀 고갈**: Spring은 AFTER_COMMIT 콜백을 원래 커넥션을 반납하기 전에 실행한다. 요청 하나가 커넥션 2개를 잡아, 동시 요청이 풀 크기(Hikari 기본 10) 이상이면 모두 두 번째 커넥션을 기다리다 30초 뒤 실패한다. 구현 중 기존 취소 동시성 테스트에서 신청 요청 20건 실패·알림 누락으로 확인 |
| **`@TransactionalEventListener(BEFORE_COMMIT)`** | ✓ 커넥션 1개. 롤백되면 알림도 없다. enrollment는 이벤트만 발행한다 |
| `@Async` | 선택 안 함: 서버 종료 시 유실, 테스트 대기·스레드풀 설정 필요 |

### 2-1. 알림 저장이 실패하면

- 신청도 함께 롤백된다(같은 트랜잭션). 같은 DB에 행 하나를 넣는 것이라 드물고, "신청은 있는데 알림 기록은 없다"보다 일관적이다
- 리스너는 예외를 잡지 않는다. `GlobalExceptionHandler`에는 `DataAccessException`·`Exception` 처리기가 없으므로 Spring Boot 기본 오류 응답(500)이 나간다. 다른 예상 밖 예외와 같은 경로다

### 2-2. 동기 실행 (Q3)

요청 스레드·같은 트랜잭션에서 실행한다. INSERT 1건이 회차 락을 쥔 시간에 더해지지만 작다. 실제 발송은 나중에 이 테이블을 읽는 별도 처리(아웃박스 발송기)로 붙인다.

## 3. 구조

```
backend/src/main/java/com/example/eduhub/
├── enrollment/
│   ├── EnrollmentConfirmedEvent.java   # 새: @Value (enrollmentId, employeeId, sessionId, courseId, courseTitle, reason)
│   ├── ConfirmationReason.java         # 새: APPLIED, PROMOTED
│   └── EnrollmentService.java          # 수정: ApplicationEventPublisher 주입, 확정·승급마다 발행
└── notification/                       # 새 도메인 패키지
    ├── package-info.java
    ├── Notification.java               # 엔티티: 정적 팩터리 confirmed(event)
    ├── NotificationType.java           # ENROLLMENT_CONFIRMED, ENROLLMENT_PROMOTED
    ├── NotificationRepository.java
    └── NotificationListener.java       # BEFORE_COMMIT, 같은 트랜잭션에서 저장
```

- **의존 방향**: `notification` → `enrollment`(이벤트 클래스만). `enrollment`는 `notification`을 모른다(이벤트만 발행). `course`는 둘 다 모른다. `backend/CLAUDE.md` 패키지 규칙에 한 줄 추가
- 이벤트에 과정명(`courseTitle`)을 담는다: 리스너가 다른 도메인을 다시 조회하지 않게. 발행 시점에는 트랜잭션 안이라 지연 로딩이 된다. 승급 경로는 회차 락을 쥔 `CourseSession`에서 꺼낸다
- 승급이 여러 건이면(빈자리 여러 개) 승급마다 이벤트 1건

## 4. 스키마 (V7)

```sql
-- FR-09: 신청 확정·대기 승급 알림 기록. 처음에는 기록만 하고 발송은 하지 않는다.
CREATE TABLE notification (
    id            BIGSERIAL    PRIMARY KEY,
    employee_id   BIGINT       NOT NULL,   -- enrollment.employee_id처럼 FK 없음(V4 주석, 동시성 테스트가 가상 사원 ID 사용)
    enrollment_id BIGINT       NOT NULL REFERENCES enrollment (id),
    type          VARCHAR(30)  NOT NULL CHECK (type IN ('ENROLLMENT_CONFIRMED', 'ENROLLMENT_PROMOTED')),
    message       VARCHAR(200) NOT NULL,
    created_at    TIMESTAMP    NOT NULL
);
CREATE INDEX idx_notification_employee ON notification (employee_id, created_at);
CREATE INDEX idx_notification_enrollment ON notification (enrollment_id);
```

- FK 컬럼에 인덱스(PostgreSQL은 자동으로 만들지 않음). 사원별 최신순 조회를 대비해 `(employee_id, created_at)`
- 기존 `employee`·`enrollment` 테이블 이름과 컬럼은 구현 때 V2·V4로 확인한다
- 메시지 예: `"[Java 기초] 수강 신청이 확정되었습니다."`, `"[Java 기초] 대기에서 확정되었습니다."` (과정명 컬럼은 200자라 긴 과정명은 `…`로 잘라 200자 안에 맞춘다)

## 5. 로그 (NFR-03)

- INFO: `notification saved: type=ENROLLMENT_PROMOTED, enrollmentId=12, employeeId=3` (커밋 직전에 남으므로 "커밋 대기"라는 뜻. 롤백되면 기록은 없다)
- 메시지 본문·이름·사번·과정명을 로그에 남기지 않는다

## 6. 테스트

| ID | 종류 | 시나리오 |
|---|---|---|
| N1 | 통합(`@SpringBootTest`, test DB) | 정원 남은 회차 신청 → 커밋 후 알림 1건(ENROLLMENT_CONFIRMED, 해당 사원·신청) |
| N2 | 통합 | 정원 찬 회차 신청(대기) → 알림 0건 |
| N3 | 통합 | 확정자 취소 → 대기 1순위 승급 → ENROLLMENT_PROMOTED 1건(승급한 사원), 취소한 사원은 0건 |
| N4 | 통합 | **롤백**: `TransactionTemplate` 안에서 `apply` 후 `setRollbackOnly()` → 신청 0건, 알림 0건 (실제 롤백을 만든다) |
| N5 | 통합 | 리스너 저장 실패(Repository를 `@SpyBean`으로 예외) → `apply`가 예외, 신청 0건(함께 롤백) |
| N6 | 단위 | `Notification.confirmed(event)`의 type·message, 메시지 길이 |
| N7 | 기존 | 동시성 테스트(100명 마지막 1자리, 취소·승급) 그대로 통과 — 알림 수 = 확정 수 확인 한 줄 추가. 이 테스트가 커넥션 풀 고갈(2장)을 잡는 회귀 테스트다 |

- 테스트 데이터는 고유 값으로(로컬 PostgreSQL 공유). 비동기가 아니므로 대기(sleep) 없이 확인한다
- 완료: `./gradlew check` (spotless + test)

## 7. 위험

| 위험 | 대응 |
|---|---|
| 커밋 후 새 트랜잭션이 커넥션 풀 고갈 | 같은 트랜잭션(BEFORE_COMMIT)으로, N7 |
| 알림 저장 실패가 신청을 실패시킴 | 같은 DB 행 하나라 드묾, 원자성을 택함(2-1), N5 |
| 승급 경로 발행 누락 | `promoteWaitingWhileSeatsAvailable` 안에서 발행(정원 증가 후속도 자동 포함), N3 |
| 알림 저장이 락 시간을 늘림 | INSERT 1건(승급 n건이면 n건)뿐, 동시성 테스트로 확인 |
| 이름만 롤백인 테스트 | N4가 실제 롤백 트랜잭션을 만들고 신청 0건도 함께 확인 |
| 로그 개인정보 | ID만, 5장 |
| 같은 이벤트 중복 저장 | 리스너는 이벤트당 INSERT 1건. 유일 제약은 두지 않는다(같은 신청이 확정→취소→재신청은 다른 enrollment_id) |

## 8. 질문과 결정

| # | 질문 | 권장 |
|---|---|---|
| Q1 | 알림 대상 | **바로 확정, 대기에서 승급 두 가지만**(FR-09 문구). 대기 등록·취소·수료는 넣지 않는다 |
| Q2 | 알림 저장 시점·실패 처리 | **(개정) 같은 트랜잭션, 커밋 직전(BEFORE_COMMIT). 실패하면 신청도 롤백**(2-1). 최초 결정(AFTER_COMMIT + 예외 무시)은 커넥션 풀 고갈로 폐기 |
| Q3 | 동기/비동기 | **동기**(2-2). 실제 발송은 이 테이블을 읽는 발송기로 나중에 |
| Q4 | 메시지에 과정명 | **넣는다**(이벤트에 담아 전달). 로그에는 넣지 않는다 |
| Q5 | 내 알림 조회 API(`/api/v1/me/notifications`)·화면 | **이번엔 하지 않는다**(교재 범위: 기록만). 필요하면 다음 작업 |
| Q6 | 패키지 | **새 도메인 패키지 `notification`**, 이벤트 클래스는 `enrollment`에 둔다(발행하는 쪽이 계약을 가짐) |
