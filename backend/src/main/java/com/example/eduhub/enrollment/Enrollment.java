package com.example.eduhub.enrollment;

import com.example.eduhub.common.error.ConflictException;
import com.example.eduhub.course.CourseSession;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.EnumType;
import javax.persistence.Enumerated;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 수강 신청 (FR-04, FR-05, FR-06). courseId는 과정 단위 중복 방지를 위해 회차의 과정 ID를 복사해 둔다 (D-03). */
@Entity
@Table(name = "enrollment")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Enrollment {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "session_id", nullable = false)
  private CourseSession session;

  @Column(name = "course_id", nullable = false)
  private Long courseId;

  @Column(name = "employee_id", nullable = false)
  private Long employeeId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private EnrollmentStatus status;

  @Column(name = "applied_at", nullable = false)
  private LocalDateTime appliedAt;

  @Column(name = "confirmed_at")
  private LocalDateTime confirmedAt;

  /** 대기에서 승급해 확정되었는가 (FR-06, D-04). */
  @Column(nullable = false)
  private boolean promoted;

  private Enrollment(
      CourseSession session, Long employeeId, EnrollmentStatus status, LocalDateTime now) {
    this.session = session;
    this.courseId = session.getCourse().getId();
    this.employeeId = employeeId;
    this.status = status;
    this.appliedAt = truncate(now);
  }

  /** 자리가 있을 때: 확정. 신청 시각과 확정 시각이 같다. */
  public static Enrollment confirm(CourseSession session, Long employeeId, LocalDateTime now) {
    Enrollment enrollment = new Enrollment(session, employeeId, EnrollmentStatus.CONFIRMED, now);
    enrollment.confirmedAt = truncate(now);
    return enrollment;
  }

  /** 정원이 찼을 때: 대기. 확정 시각은 없다. */
  public static Enrollment waiting(CourseSession session, Long employeeId, LocalDateTime now) {
    return new Enrollment(session, employeeId, EnrollmentStatus.WAITING, now);
  }

  /** 취소 (FR-06, D-04). 확정·대기만 취소할 수 있다. */
  public void cancel() {
    if (status != EnrollmentStatus.CONFIRMED && status != EnrollmentStatus.WAITING) {
      throw new ConflictException("ENROLLMENT_NOT_CANCELLABLE", "취소할 수 없는 신청입니다: " + status);
    }
    this.status = EnrollmentStatus.CANCELLED;
  }

  /**
   * 대기에서 확정으로 승급 (FR-06, D-04). 확정 시각과 승급 여부를 기록하고 신청 시각은 그대로 둔다.
   *
   * <p>대기가 아닌 신청을 승급하는 것은 호출한 서비스의 버그이므로 IllegalStateException이다.
   */
  public void promote(LocalDateTime now) {
    if (status != EnrollmentStatus.WAITING) {
      throw new IllegalStateException("대기 상태가 아닌 신청은 승급할 수 없습니다: " + status);
    }
    this.status = EnrollmentStatus.CONFIRMED;
    this.confirmedAt = truncate(now);
    this.promoted = true;
  }

  // PostgreSQL TIMESTAMP는 마이크로초까지 저장한다. 메모리 값과 DB 값이 같아야 순번의 동점 비교(appliedAt =)가 맞는다.
  private static LocalDateTime truncate(LocalDateTime time) {
    return time.truncatedTo(ChronoUnit.MICROS);
  }
}
