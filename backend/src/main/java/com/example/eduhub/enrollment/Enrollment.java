package com.example.eduhub.enrollment;

import com.example.eduhub.course.CourseSession;
import java.time.LocalDateTime;
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

/** 수강 신청 (FR-04). courseId는 과정 단위 중복 방지를 위해 회차의 과정 ID를 복사해 둔다 (D-03). */
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

  private Enrollment(
      CourseSession session, Long employeeId, EnrollmentStatus status, LocalDateTime now) {
    this.session = session;
    this.courseId = session.getCourse().getId();
    this.employeeId = employeeId;
    this.status = status;
    this.appliedAt = now;
  }

  /** 자리가 있을 때: 확정. 신청 시각과 확정 시각이 같다. */
  public static Enrollment confirm(CourseSession session, Long employeeId, LocalDateTime now) {
    Enrollment enrollment = new Enrollment(session, employeeId, EnrollmentStatus.CONFIRMED, now);
    enrollment.confirmedAt = now;
    return enrollment;
  }

  /** 정원이 찼을 때: 대기. 확정 시각은 없다. */
  public static Enrollment waiting(CourseSession session, Long employeeId, LocalDateTime now) {
    return new Enrollment(session, employeeId, EnrollmentStatus.WAITING, now);
  }
}
