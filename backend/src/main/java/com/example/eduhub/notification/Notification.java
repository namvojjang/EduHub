package com.example.eduhub.notification;

import com.example.eduhub.enrollment.ConfirmationReason;
import com.example.eduhub.enrollment.EnrollmentConfirmedEvent;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.EnumType;
import javax.persistence.Enumerated;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 신청 확정·대기 승급 알림 기록 (FR-09). 지금은 기록만 하고 발송하지 않는다. */
@Entity
@Table(name = "notification")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Notification {

  static final int MESSAGE_MAX_LENGTH = 200;
  private static final String CONFIRMED_SUFFIX = " 수강 신청이 확정되었습니다.";
  private static final String PROMOTED_SUFFIX = " 대기에서 확정되었습니다.";

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "employee_id", nullable = false)
  private Long employeeId;

  @Column(name = "enrollment_id", nullable = false)
  private Long enrollmentId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  private NotificationType type;

  @Column(nullable = false, length = 200)
  private String message;

  @Column(name = "created_at", nullable = false)
  private LocalDateTime createdAt;

  private Notification(
      Long employeeId,
      Long enrollmentId,
      NotificationType type,
      String message,
      LocalDateTime now) {
    this.employeeId = employeeId;
    this.enrollmentId = enrollmentId;
    this.type = type;
    this.message = message;
    this.createdAt = now.truncatedTo(ChronoUnit.MICROS);
  }

  /** 확정 이벤트로 알림을 만든다. 종류와 문구는 확정 이유가 정한다. */
  public static Notification confirmed(EnrollmentConfirmedEvent event, LocalDateTime now) {
    boolean promoted = event.getReason() == ConfirmationReason.PROMOTED;
    NotificationType type =
        promoted ? NotificationType.ENROLLMENT_PROMOTED : NotificationType.ENROLLMENT_CONFIRMED;
    String suffix = promoted ? PROMOTED_SUFFIX : CONFIRMED_SUFFIX;
    return new Notification(
        event.getEmployeeId(),
        event.getEnrollmentId(),
        type,
        buildMessage(event.getCourseTitle(), suffix),
        now);
  }

  /** "[과정명]" + 문구. 과정명이 길면(최대 200자) 메시지가 200자를 넘지 않게 과정명을 자르고 …을 붙인다. */
  private static String buildMessage(String courseTitle, String suffix) {
    String title = courseTitle == null ? "" : courseTitle;
    int room = MESSAGE_MAX_LENGTH - suffix.length() - 2; // 대괄호 2자
    if (title.length() > room) {
      title = title.substring(0, room - 1) + "…";
    }
    return "[" + title + "]" + suffix;
  }
}
