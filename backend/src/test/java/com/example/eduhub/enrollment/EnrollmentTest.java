package com.example.eduhub.enrollment;

import static org.assertj.core.api.Assertions.assertThat;

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

  private CourseSession newSession() {
    Course course = Course.create("테스트 과정", "개발", "설명");
    ReflectionTestUtils.setField(course, "id", COURSE_ID);
    return CourseSession.create(course, NOW.plusDays(1), "교육장", 10);
  }
}
