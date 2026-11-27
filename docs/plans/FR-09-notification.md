# 구현계획: 신청 확정·대기 승급 알림 기록 (FR-09)

- 설계명세: `docs/design/FR-09-notification.md` (승인됨 2026-11-27, Q1~Q6 권장안). 이 계획에 없는 결정은 설계명세를 따른다.
- 상태: 승인됨 (2026-11-27, "승인, T1 시작")
- 브랜치: `feature/week5-fr-09-notification`
- 진행: implementer 구현 → reviewer 검토(심각·경고는 수정·재검토 최대 2회) → critical-reviewer 최종 검토(지적은 고치기 전에 개발자에게) → PR
- 공통 제약: Java 8 / Spring Boot 2.7(`javax.*`), `.claude/skills/eduhub-api` 절차, `backend/CLAUDE.md`. 기존 마이그레이션 수정 금지(새 파일 V7). 프론트·API 변경 없음(생성 클라이언트 재생성 불필요)
- 완료 명령(`backend/`): `./gradlew spotlessApply check`. 실제 출력(테스트 수·실패 수)으로 보고
- 규모(CLAUDE.md 절차 5): 새 파일 약 8개 + 서비스 1개 수정 + 테스트, 백엔드 한 계층

## 단계별로 개발자가 직접 할 일

| 작업 | 직접 할 일 |
|---|---|
| T1 | 없음 (결과 확인) |
| T2 | **알림 문구를 IDE에서 직접 다듬기**(교재 5-2 "직접 고치기 연습") 후 "문구를 바꿨어, 테스트만 다시 돌려줘" |
| T3 | 최종 검토 지적 결정, PR 병합 |

## T1. 이벤트·리스너·테이블·테스트

변경 파일
- 새로: `db/migration/V7__create_notification.sql` — 설계 4장(테이블·CHECK·FK·인덱스). `employee`·`enrollment` 실제 테이블·컬럼명은 V2·V4로 확인
- 새로: `enrollment/ConfirmationReason.java`(APPLIED, PROMOTED), `enrollment/EnrollmentConfirmedEvent.java`(`@Value`: enrollmentId, employeeId, sessionId, courseId, courseTitle, reason)
- 수정: `enrollment/EnrollmentService.java` — `ApplicationEventPublisher` 주입. `apply`에서 상태가 CONFIRMED로 저장된 뒤 발행(APPLIED). `promoteWaitingWhileSeatsAvailable`에서 `promote` 직후 발행(PROMOTED). 기존 락·flush 순서 유지
- 새로: `notification/` — `package-info.java`(의존 방향 설명), `NotificationType`, `Notification`(엔티티, `confirmed(event, now)` 팩터리, 메시지 `"[과정명] 수강 신청이 확정되었습니다."`/`"[과정명] 대기에서 확정되었습니다."`, 200자 안), `NotificationRepository`, `NotificationListener`(`@TransactionalEventListener(AFTER_COMMIT)` + `@Transactional(REQUIRES_NEW)`, INFO 로그 ID만, 예외는 잡아 WARN·재던지기 없음)
  - 주의: 예외를 잡으려면 REQUIRES_NEW 트랜잭션 **바깥**에서 잡아야 커밋 실패도 잡힌다(리스너가 별도 빈의 `@Transactional` 메서드를 부르거나 `TransactionTemplate` 사용). 구현 방식을 보고
- 수정: `backend/CLAUDE.md` 패키지 규칙 — "`notification`은 `enrollment`의 이벤트만 참조한다. `enrollment`는 `notification`을 모른다"
- 테스트: 설계 6장 N1~N7. N4는 실제 롤백, N5는 저장 실패 시 신청 성공·커밋 확인. 기존 서비스 단위 테스트(Mockito)는 `ApplicationEventPublisher` mock 추가로 맞추고 발행 호출(인자 포함)을 검증

완료 명령: `./gradlew spotlessApply check`, `grep -rn "import com.example.eduhub.notification" src/main/java/com/example/eduhub/enrollment src/main/java/com/example/eduhub/course` 결과 없음

커밋: `feat(notification): 신청 확정·대기 승급 알림 기록(FR-09, D-04)`

## T2. 알림 문구 직접 다듬기 (개발자)

- `Notification` 메시지 문구를 개발자가 IDE에서 고친다 → 메인 세션이 `./gradlew check`로 확인, 문구 테스트가 깨지면 개발자에게 보고(테스트도 직접 고칠지 확인)
- 커밋: `chore(notification): 알림 문구 다듬기(FR-09)` (개발자 이름으로, 바꾼 것이 없으면 생략)

## T3. 최종 검토와 PR

- critical-reviewer: 설계명세 + `git diff main...` + T1 검토. 중점: AFTER_COMMIT·REQUIRES_NEW 정확성, 리스너 예외가 호출자로 새지 않는지, 롤백 테스트가 실제 롤백인지, 승급 경로 발행 누락, 락 시간, 동시성 테스트, 로그 개인정보, Flyway 번호
- 실행 확인(메인 세션): 백엔드를 띄우고 신청·취소(승급) 후 `notification` 행과 로그 확인
- PR 본문: 커밋 이후 이벤트를 쓴 이유, 교재와 다른 점(리스너 예외 처리), 후속(실제 발송·재시도, 알림 조회 API)

## 위험 영역

| 위험 | 대응 |
|---|---|
| 리스너 예외가 커밋된 요청을 500으로 | 트랜잭션 바깥에서 잡기, N5 |
| 테스트가 `@Transactional` 테스트 트랜잭션 안에서 돌아 AFTER_COMMIT이 실행 안 됨 | 통합 테스트는 테스트 트랜잭션 없이(커밋되게) 실행하고 고유 데이터로 정리 |
| 승급 경로 누락 | N3 |
| 동시성 테스트 영향 | N7 |
