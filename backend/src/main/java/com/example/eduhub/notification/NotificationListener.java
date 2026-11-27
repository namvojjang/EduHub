package com.example.eduhub.notification;

import com.example.eduhub.enrollment.EnrollmentConfirmedEvent;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 신청 확정·승급 알림을 기록한다 (FR-09). 신청과 같은 트랜잭션에서 커밋 직전(BEFORE_COMMIT)에 저장한다. 저장이 실패하면 예외가 그대로 전파되어 신청도
 * 롤백되고, 신청이 롤백되면 알림도 남지 않는다.
 *
 * <p>AFTER_COMMIT + REQUIRES_NEW는 원래 커넥션을 쥔 채 두 번째 커넥션을 잡아 동시 요청에서 풀이 고갈된다(설계명세 2장). 로그에는 ID만 쓴다
 * (NFR-03).
 *
 * <p>트랜잭션 밖에서 발행된 이벤트에는 실행되지 않는다(fallbackExecution 기본값 false). 그래서 EnrollmentService가 발행 직전에 트랜잭션이
 * 활성인지 확인해 아니면 바로 실패한다. 승급 경로를 늘릴 때(D-02 정원 증가 등) 발행 지점도 같은 검사를 거치게 한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationListener {

  private final NotificationRepository notificationRepository;

  @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
  public void onEnrollmentConfirmed(EnrollmentConfirmedEvent event) {
    Notification saved =
        notificationRepository.save(Notification.confirmed(event, LocalDateTime.now()));
    log.info(
        "notification saved: type={}, enrollmentId={}, employeeId={}",
        saved.getType(),
        event.getEnrollmentId(),
        event.getEmployeeId());
  }
}
