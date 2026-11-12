package com.example.eduhub.enrollment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.eduhub.course.Course;
import com.example.eduhub.course.CourseSession;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

/** 로컬 PostgreSQL의 테스트 DB에 Flyway V2를 적용한 뒤 유일 인덱스와 조회 쿼리를 확인한다 (FR-04, D-03). */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class EnrollmentRepositoryTest {

  private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 12, 10, 0);

  // nanoTime으로 시작해 실행마다 다르고, 증가시켜 같은 실행 안에서 겹치지 않게 한다.
  private static final AtomicLong NEXT_EMPLOYEE_ID = new AtomicLong(System.nanoTime());

  @Autowired private EnrollmentRepository enrollmentRepository;

  @Autowired private TestEntityManager em;

  @Test
  void secondActiveEnrollmentInSameCourseViolatesUniqueIndex() {
    Course course = newCourse();
    CourseSession first = newSession(course);
    CourseSession second = newSession(course);
    Long employeeId = uniqueEmployeeId();
    enrollmentRepository.saveAndFlush(Enrollment.confirm(first, employeeId, NOW));

    assertThatThrownBy(
            () -> enrollmentRepository.saveAndFlush(Enrollment.waiting(second, employeeId, NOW)))
        .isInstanceOf(DataIntegrityViolationException.class)
        // 인덱스 이름은 최상위 예외가 아니라 가장 깊은 원인(PSQLException) 메시지에만 나온다.
        .satisfies(
            e ->
                assertThat(((DataIntegrityViolationException) e).getMostSpecificCause())
                    .hasMessageContaining("ux_enrollment_course_employee_active"));
  }

  @Test
  void sameEmployeeCanEnrollInDifferentCourses() {
    CourseSession sessionA = newSession(newCourse());
    CourseSession sessionB = newSession(newCourse());
    Long employeeId = uniqueEmployeeId();

    enrollmentRepository.saveAndFlush(Enrollment.confirm(sessionA, employeeId, NOW));
    Enrollment second =
        enrollmentRepository.saveAndFlush(Enrollment.confirm(sessionB, employeeId, NOW));

    assertThat(second.getId()).isNotNull();
  }

  @Test
  void cancelledEnrollmentDoesNotBlockReEnrollment() {
    Course course = newCourse();
    CourseSession first = newSession(course);
    CourseSession second = newSession(course);
    Long employeeId = uniqueEmployeeId();
    Enrollment enrollment =
        enrollmentRepository.saveAndFlush(Enrollment.confirm(first, employeeId, NOW));

    // 취소 메서드는 FR-06 범위라 엔티티에 없다. 네이티브 SQL로 취소 상태를 만든다.
    em.getEntityManager()
        .createNativeQuery("UPDATE enrollment SET status = 'CANCELLED' WHERE id = :id")
        .setParameter("id", enrollment.getId())
        .executeUpdate();

    Enrollment again =
        enrollmentRepository.saveAndFlush(Enrollment.confirm(second, employeeId, NOW));

    assertThat(again.getId()).isNotNull();
  }

  @Test
  void countBySessionIdAndStatusCountsOnlyThatStatus() {
    CourseSession session = newSession(newCourse());
    enrollmentRepository.saveAndFlush(Enrollment.confirm(session, uniqueEmployeeId(), NOW));
    enrollmentRepository.saveAndFlush(Enrollment.confirm(session, uniqueEmployeeId(), NOW));
    enrollmentRepository.saveAndFlush(Enrollment.waiting(session, uniqueEmployeeId(), NOW));

    assertThat(
            enrollmentRepository.countBySessionIdAndStatus(
                session.getId(), EnrollmentStatus.CONFIRMED))
        .isEqualTo(2);
    assertThat(
            enrollmentRepository.countBySessionIdAndStatus(
                session.getId(), EnrollmentStatus.WAITING))
        .isEqualTo(1);
    assertThat(
            enrollmentRepository.countBySessionIdAndStatus(
                session.getId(), EnrollmentStatus.CANCELLED))
        .isZero();
  }

  @Test
  void existsByCourseIdAndEmployeeIdAndStatusInFindsActiveEnrollment() {
    Course course = newCourse();
    CourseSession session = newSession(course);
    Long employeeId = uniqueEmployeeId();
    enrollmentRepository.saveAndFlush(Enrollment.waiting(session, employeeId, NOW));

    assertThat(
            enrollmentRepository.existsByCourseIdAndEmployeeIdAndStatusIn(
                course.getId(),
                employeeId,
                Arrays.asList(EnrollmentStatus.CONFIRMED, EnrollmentStatus.WAITING)))
        .isTrue();
    assertThat(
            enrollmentRepository.existsByCourseIdAndEmployeeIdAndStatusIn(
                course.getId(), employeeId, Arrays.asList(EnrollmentStatus.CONFIRMED)))
        .isFalse();
    assertThat(
            enrollmentRepository.existsByCourseIdAndEmployeeIdAndStatusIn(
                course.getId(),
                uniqueEmployeeId(),
                Arrays.asList(EnrollmentStatus.CONFIRMED, EnrollmentStatus.WAITING)))
        .isFalse();
  }

  private Course newCourse() {
    return em.persistAndFlush(Course.create("테스트 과정", "개발", "설명"));
  }

  private CourseSession newSession(Course course) {
    return em.persistAndFlush(CourseSession.create(course, NOW.plusDays(1), "교육장", 10));
  }

  /** 로컬 DB에 데이터가 남아도 충돌하지 않도록 매번 고유한 직원 ID를 쓴다. */
  private Long uniqueEmployeeId() {
    return NEXT_EMPLOYEE_ID.incrementAndGet();
  }
}
