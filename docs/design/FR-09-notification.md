# 설계명세: 신청 확정·대기 승급 알림 기록 (FR-09)

- 상태: 승인됨 (2026-11-27, Q1~Q6 권장안)
- 관련: FR-09(확정·대기 승급 시 알림, 처음에는 로그·DB 기록), D-04(자동 승급, `promoted` 기록), NFR-01(정원 정합성), NFR-03(개인정보), NFR-07(패키지 규칙)
- 참고: 교육 6회차 5장(커밋 이후 이벤트)
- 범위 밖: 메일·메신저 실제 발송, 프론트 화면, 알림 조회 API(Q5), 대기 등록·취소·수료 알림

## 1. 요구사항 정리

| 언제 | 알림 | 지금 코드 |
|---|---|---|
| 신청이 바로 **확정**됨 | "수강 신청이 확정되었습니다" | `EnrollmentService.apply`에서 `Enrollment.confirm(...)` |
| 대기에서 **승급**되어 확정됨 | "대기에서 확정되었습니다" | `promoteWaitingWhileSeatsAvailable`의 `promote(now)` (지금은 확정 취소 때, 나중에 D-02 정원 증가 때도 같은 메서드) |

- 대기로 저장된 신청은 알림이 없다(FR-09 범위는 확정·승급). 대기는 신청 응답에 순번이 바로 보인다.
- **신청이 실제로 커밋된 뒤에만** 남긴다. 롤백된 신청의 알림은 없어야 한다.
- **알림 실패가 신청을 실패시키지 않는다.**

## 2. 흐름: 커밋 이후 이벤트

```
EnrollmentService (트랜잭션, 회차 락)
  ├─ 확정 또는 승급
  ├─ publishEvent(EnrollmentConfirmedEvent)   ← 아직 실행되지 않고 커밋을 기다림
  └─ COMMIT (락 해제)
        └─ NotificationListener  @TransactionalEventListener(AFTER_COMMIT)
              └─ 새 트랜잭션(REQUIRES_NEW)으로 notification 저장 + INFO 로그(ID만)
```

| 방식 | 판단 |
|---|---|
| 서비스 안에서 바로 저장 | ✗ 뒤에서 예외가 나 신청이 롤백돼도 알림이 남는다. 실제 발송을 붙이면 "확정" 메일이 나간 뒤 신청이 사라진다 |
| `@EventListener`(일반) | ✗ 같은 트랜잭션 안에서 실행 → 알림 저장 실패가 신청까지 롤백 |
| **`@TransactionalEventListener(AFTER_COMMIT)` + `REQUIRES_NEW`** | ✓ 커밋된 신청만. 회차 락도 풀린 뒤라 신청 처리 시간을 늘리지 않는다 |

### 2-1. 리스너가 실패하면

Spring에서 AFTER_COMMIT 리스너가 던진 예외는 **이미 커밋된 요청의 호출자에게 전달**된다. 그대로 두면 신청은 저장됐는데 사용자는 500을 받는다. 그래서:

- 리스너는 예외를 잡아 **WARN 로그(ID와 예외 종류만)를 남기고 다시 던지지 않는다**
- 알림 기록이 빠질 수 있다는 뜻이다. 처음 단계(로그·DB 기록)에서는 받아들인다. 실제 발송을 붙일 때 재시도(아웃박스 테이블 등)를 따로 설계한다(후속)

### 2-2. 동기 실행 (Q3)

리스너는 요청 스레드에서 커밋 직후 실행한다(`@Async` 아님). INSERT 1건이라 응답 지연이 작고, 테스트가 단순하다. 실제 발송을 붙일 때 비동기를 검토한다.

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
    └── NotificationListener.java       # AFTER_COMMIT + REQUIRES_NEW, 예외는 WARN 로그
```

- **의존 방향**: `notification` → `enrollment`(이벤트 클래스만). `enrollment`는 `notification`을 모른다(이벤트만 발행). `course`는 둘 다 모른다. `backend/CLAUDE.md` 패키지 규칙에 한 줄 추가
- 이벤트에 과정명(`courseTitle`)을 담는다: 리스너가 다른 도메인을 다시 조회하지 않게. 발행 시점에는 트랜잭션 안이라 지연 로딩이 된다. 승급 경로는 회차 락을 쥔 `CourseSession`에서 꺼낸다
- 승급이 여러 건이면(빈자리 여러 개) 승급마다 이벤트 1건

## 4. 스키마 (V7)

```sql
-- FR-09: 신청 확정·대기 승급 알림 기록. 처음에는 기록만 하고 발송은 하지 않는다.
CREATE TABLE notification (
    id            BIGSERIAL    PRIMARY KEY,
    employee_id   BIGINT       NOT NULL REFERENCES employee (id),
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
- 메시지 예: `"[Java 기초] 수강 신청이 확정되었습니다."`, `"[Java 기초] 대기에서 확정되었습니다."` (과정명 100자 이내라 200자에 들어간다. 구현 때 과정명 길이 확인)

## 5. 로그 (NFR-03)

- INFO: `notification saved: type=ENROLLMENT_PROMOTED, enrollmentId=12, employeeId=3`
- WARN(실패): `notification failed: enrollmentId=12, error=DataAccessException` — 메시지 본문·이름·사번·과정명을 남기지 않는다

## 6. 테스트

| ID | 종류 | 시나리오 |
|---|---|---|
| N1 | 통합(`@SpringBootTest`, test DB) | 정원 남은 회차 신청 → 커밋 후 알림 1건(ENROLLMENT_CONFIRMED, 해당 사원·신청) |
| N2 | 통합 | 정원 찬 회차 신청(대기) → 알림 0건 |
| N3 | 통합 | 확정자 취소 → 대기 1순위 승급 → ENROLLMENT_PROMOTED 1건(승급한 사원), 취소한 사원은 0건 |
| N4 | 통합 | **롤백**: `TransactionTemplate` 안에서 `apply` 후 `setRollbackOnly()` → 신청 0건, 알림 0건 (실제 롤백을 만든다) |
| N5 | 통합 | 리스너 저장 실패(Repository를 `@SpyBean`으로 예외) → 신청 API는 성공, 신청은 커밋됨, 예외가 호출자로 안 나감 |
| N6 | 단위 | `Notification.confirmed(event)`의 type·message, 메시지 길이 |
| N7 | 기존 | 동시성 테스트(100명 마지막 1자리, 취소·승급) 그대로 통과 — 알림 수 = 확정 수 확인 한 줄 추가 |

- 테스트 데이터는 고유 값으로(로컬 PostgreSQL 공유). 비동기가 아니므로 대기(sleep) 없이 확인한다
- 완료: `./gradlew check` (spotless + test)

## 7. 위험

| 위험 | 대응 |
|---|---|
| 리스너 예외로 커밋된 신청이 500 | 리스너에서 잡고 WARN (2-1), N5 |
| 승급 경로 발행 누락 | `promoteWaitingWhileSeatsAvailable` 안에서 발행(정원 증가 후속도 자동 포함), N3 |
| 이벤트 발행이 락 시간을 늘림 | 발행은 메모리 등록뿐, 저장은 커밋·락 해제 뒤 |
| 이름만 롤백인 테스트 | N4가 실제 롤백 트랜잭션을 만들고 신청 0건도 함께 확인 |
| 로그 개인정보 | ID만, 5장 |
| 같은 이벤트 중복 저장 | 리스너는 이벤트당 INSERT 1건. 유일 제약은 두지 않는다(같은 신청이 확정→취소→재신청은 다른 enrollment_id) |

## 8. 질문과 결정

| # | 질문 | 권장 |
|---|---|---|
| Q1 | 알림 대상 | **바로 확정, 대기에서 승급 두 가지만**(FR-09 문구). 대기 등록·취소·수료는 넣지 않는다 |
| Q2 | 리스너 실패 처리 | **잡아서 WARN 로그, 다시 던지지 않는다**(2-1). 교재 코드에는 없지만 그대로 두면 커밋된 신청이 500이 된다 |
| Q3 | 동기/비동기 | **동기**(2-2). 발송을 붙일 때 비동기 검토 |
| Q4 | 메시지에 과정명 | **넣는다**(이벤트에 담아 전달). 로그에는 넣지 않는다 |
| Q5 | 내 알림 조회 API(`/api/v1/me/notifications`)·화면 | **이번엔 하지 않는다**(교재 범위: 기록만). 필요하면 다음 작업 |
| Q6 | 패키지 | **새 도메인 패키지 `notification`**, 이벤트 클래스는 `enrollment`에 둔다(발행하는 쪽이 계약을 가짐) |
