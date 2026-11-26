package com.example.eduhub.enrollment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.eduhub.common.error.ConflictException;
import com.example.eduhub.course.Course;
import com.example.eduhub.course.CourseSession;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/** 스프링·DB 없이 Enrollment 팩터리의 상태와 시각 설정을 확인한다 (FR-04). */
class EnrollmentTest {

  private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 12, 10, 0);
  private static final Long COURSE_ID = 7L;
  private static final Long EMPLOYEE_ID = 100L;

  @Test
  void confirmSetsConfirmedStatusAndTimes() {
    CourseSession session = newSession();

    Enrollment enrollment = Enrollment.confirm(session, EMPLOYEE_ID, NOW);

    assertThat(enrollment.getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
    assertThat(enrollment.getAppliedAt()).isEqualTo(NOW);
    assertThat(enrollment.getConfirmedAt()).isEqualTo(NOW);
    assertThat(enrollment.getCourseId()).isEqualTo(COURSE_ID);
    assertThat(enrollment.getEmployeeId()).isEqualTo(EMPLOYEE_ID);
    assertThat(enrollment.getSession()).isSameAs(session);
  }

  @Test
  void waitingSetsWaitingStatusWithoutConfirmedAt() {
    CourseSession session = newSession();

    Enrollment enrollment = Enrollment.waiting(session, EMPLOYEE_ID, NOW);

    assertThat(enrollment.getStatus()).isEqualTo(EnrollmentStatus.WAITING);
    assertThat(enrollment.getAppliedAt()).isEqualTo(NOW);
    assertThat(enrollment.getConfirmedAt()).isNull();
    assertThat(enrollment.getCourseId()).isEqualTo(COURSE_ID);
  }

  @Test
  void newEnrollmentIsNotPromoted() {
    CourseSession session = newSession();

    assertThat(Enrollment.confirm(session, EMPLOYEE_ID, NOW).isPromoted()).isFalse();
    assertThat(Enrollment.waiting(session, EMPLOYEE_ID, NOW).isPromoted()).isFalse();
  }

  @Test
  void cancelConfirmedEnrollment() {
    Enrollment enrollment = Enrollment.confirm(newSession(), EMPLOYEE_ID, NOW);

    enrollment.cancel();

    assertThat(enrollment.getStatus()).isEqualTo(EnrollmentStatus.CANCELLED);
  }

  @Test
  void cancelWaitingEnrollment() {
    Enrollment enrollment = Enrollment.waiting(newSession(), EMPLOYEE_ID, NOW);

    enrollment.cancel();

    assertThat(enrollment.getStatus()).isEqualTo(EnrollmentStatus.CANCELLED);
  }

  @Test
  void cancelCancelledEnrollmentIsConflict() {
    Enrollment enrollment = Enrollment.waiting(newSession(), EMPLOYEE_ID, NOW);
    enrollment.cancel();

    assertThatThrownBy(enrollment::cancel)
        .isInstanceOf(ConflictException.class)
        .satisfies(
            e ->
                assertThat(((ConflictException) e).getCode())
                    .isEqualTo("ENROLLMENT_NOT_CANCELLABLE"));
  }

  @Test
  void cancelCompletedOrNotCompletedEnrollmentIsConflict() {
    for (EnrollmentStatus status :
        new EnrollmentStatus[] {EnrollmentStatus.COMPLETED, EnrollmentStatus.NOT_COMPLETED}) {
      Enrollment enrollment = Enrollment.confirm(newSession(), EMPLOYEE_ID, NOW);
      ReflectionTestUtils.setField(enrollment, "status", status);

      assertThatThrownBy(enrollment::cancel)
          .as(status.name())
          .isInstanceOf(ConflictException.class)
          .satisfies(
              e ->
                  assertThat(((ConflictException) e).getCode())
                      .isEqualTo("ENROLLMENT_NOT_CANCELLABLE"));
      assertThat(enrollment.getStatus()).isEqualTo(status);
    }
  }

  @Test
  void promoteWaitingEnrollmentRecordsConfirmedAtAndPromoted() {
    Enrollment enrollment = Enrollment.waiting(newSession(), EMPLOYEE_ID, NOW);
    LocalDateTime later = NOW.plusHours(3);

    enrollment.promote(later);

    assertThat(enrollment.getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
    assertThat(enrollment.getConfirmedAt()).isEqualTo(later);
    assertThat(enrollment.isPromoted()).isTrue();
    assertThat(enrollment.getAppliedAt()).isEqualTo(NOW);
  }

  @Test
  void promoteConfirmedEnrollmentIsIllegalState() {
    Enrollment enrollment = Enrollment.confirm(newSession(), EMPLOYEE_ID, NOW);

    assertThatThrownBy(() -> enrollment.promote(NOW.plusHours(1)))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void recordCompletionOnConfirmed() {
    Enrollment enrollment = Enrollment.confirm(newSession(), EMPLOYEE_ID, NOW);

    enrollment.recordCompletion(true);

    assertThat(enrollment.getStatus()).isEqualTo(EnrollmentStatus.COMPLETED);
  }

  @Test
  void recordNotCompletedOnConfirmed() {
    Enrollment enrollment = Enrollment.confirm(newSession(), EMPLOYEE_ID, NOW);

    enrollment.recordCompletion(false);

    assertThat(enrollment.getStatus()).isEqualTo(EnrollmentStatus.NOT_COMPLETED);
  }

  @Test
  void recordCompletionOnWaitingIsIllegalState() {
    Enrollment enrollment = Enrollment.waiting(newSession(), EMPLOYEE_ID, NOW);

    assertThatThrownBy(() -> enrollment.recordCompletion(true))
        .isInstanceOf(IllegalStateException.class);
    assertThat(enrollment.getStatus()).isEqualTo(EnrollmentStatus.WAITING);
  }

  @Test
  void recordCompletionOnCancelledOrAlreadyRecordedIsIllegalState() {
    Enrollment cancelled = Enrollment.confirm(newSession(), EMPLOYEE_ID, NOW);
    cancelled.cancel();
    Enrollment recorded = Enrollment.confirm(newSession(), EMPLOYEE_ID, NOW);
    recorded.recordCompletion(true);

    assertThatThrownBy(() -> cancelled.recordCompletion(true))
        .isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> recorded.recordCompletion(false))
        .isInstanceOf(IllegalStateException.class);
    assertThat(recorded.getStatus()).isEqualTo(EnrollmentStatus.COMPLETED);
  }

  @Test
  void timesAreTruncatedToMicros() {
    LocalDateTime nanos = LocalDateTime.of(2026, 1, 1, 9, 0, 0, 123456789);
    CourseSession session = newSession();

    Enrollment waiting = Enrollment.waiting(session, EMPLOYEE_ID, nanos);
    Enrollment confirmed = Enrollment.confirm(session, EMPLOYEE_ID, nanos);
    waiting.promote(nanos);

    assertThat(waiting.getAppliedAt().getNano()).isEqualTo(123456000);
    assertThat(waiting.getConfirmedAt().getNano()).isEqualTo(123456000);
    assertThat(confirmed.getAppliedAt().getNano()).isEqualTo(123456000);
    assertThat(confirmed.getConfirmedAt().getNano()).isEqualTo(123456000);
  }

  private CourseSession newSession() {
    Course course = Course.create("테스트 과정", "개발", "설명");
    ReflectionTestUtils.setField(course, "id", COURSE_ID);
    return CourseSession.create(course, NOW.plusDays(1), "교육장", 10);
  }
}
