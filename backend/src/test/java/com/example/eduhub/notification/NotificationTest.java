package com.example.eduhub.notification;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.eduhub.enrollment.ConfirmationReason;
import com.example.eduhub.enrollment.EnrollmentConfirmedEvent;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

/** N6: 알림 팩터리의 종류·문구·길이 (FR-09). */
class NotificationTest {

  private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 27, 10, 0);

  private static EnrollmentConfirmedEvent event(String title, ConfirmationReason reason) {
    return new EnrollmentConfirmedEvent(12L, 3L, 5L, 7L, title, reason);
  }

  @Test
  void appliedEventMakesConfirmedNotification() {
    Notification n = Notification.confirmed(event("Java 기초", ConfirmationReason.APPLIED), NOW);

    assertThat(n.getType()).isEqualTo(NotificationType.ENROLLMENT_CONFIRMED);
    assertThat(n.getMessage()).isEqualTo("[Java 기초] 수강 신청이 확정되었습니다.");
    assertThat(n.getEmployeeId()).isEqualTo(3L);
    assertThat(n.getEnrollmentId()).isEqualTo(12L);
    assertThat(n.getCreatedAt()).isEqualTo(NOW);
  }

  @Test
  void promotedEventMakesPromotedNotification() {
    Notification n = Notification.confirmed(event("Java 기초", ConfirmationReason.PROMOTED), NOW);

    assertThat(n.getType()).isEqualTo(NotificationType.ENROLLMENT_PROMOTED);
    assertThat(n.getMessage()).isEqualTo("[Java 기초] 대기에서 확정되었습니다.");
  }

  @Test
  void messageStaysWithin200CharsForLongestCourseTitle() {
    StringBuilder title = new StringBuilder();
    for (int i = 0; i < 200; i++) {
      title.append('가');
    }
    for (ConfirmationReason reason : ConfirmationReason.values()) {
      Notification n = Notification.confirmed(event(title.toString(), reason), NOW);

      assertThat(n.getMessage().length()).isLessThanOrEqualTo(200);
      assertThat(n.getMessage()).startsWith("[가가가").contains("…]");
    }
  }

  @Test
  void shortTitleIsNotTruncated() {
    Notification n = Notification.confirmed(event("가", ConfirmationReason.APPLIED), NOW);

    assertThat(n.getMessage()).doesNotContain("…");
  }
}
