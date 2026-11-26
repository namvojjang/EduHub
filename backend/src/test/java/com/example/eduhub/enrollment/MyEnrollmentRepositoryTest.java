package com.example.eduhub.enrollment;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.eduhub.course.Course;
import com.example.eduhub.course.CourseSession;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import javax.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

/** 내 신청 내역 쿼리를 실제 PostgreSQL에서 확인한다: Hibernate 5.6 동작, 순번, SQL 한 번 (FR-07, NFR-02, D-04). */
@DataJpaTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class MyEnrollmentRepositoryTest {

  private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 12, 10, 0);

  private static final AtomicLong NEXT_EMPLOYEE_ID = new AtomicLong(System.nanoTime());

  @Autowired private EnrollmentRepository enrollmentRepository;

  @Autowired private TestEntityManager em;

  @Autowired private EntityManagerFactory entityManagerFactory;

  @Test
  void returnsOnlyMyEnrollmentsNewestFirst() {
    Course courseA = em.persistAndFlush(Course.create("과정 가 " + System.nanoTime(), "개발", "설명"));
    Course courseB = em.persistAndFlush(Course.create("과정 나 " + System.nanoTime(), "개발", "설명"));
    CourseSession a = em.persistAndFlush(CourseSession.create(courseA, NOW.plusDays(1), "A실", 1));
    CourseSession b = em.persistAndFlush(CourseSession.create(courseB, NOW.plusDays(2), "B실", 10));
    Long kim = uniqueEmployeeId();
    Long park = uniqueEmployeeId();
    enrollmentRepository.saveAndFlush(Enrollment.confirm(a, kim, NOW.plusMinutes(1)));
    Enrollment parkA =
        enrollmentRepository.saveAndFlush(Enrollment.waiting(a, park, NOW.plusMinutes(2)));
    Enrollment parkB =
        enrollmentRepository.saveAndFlush(Enrollment.confirm(b, park, NOW.plusMinutes(3)));
    em.clear();

    List<MyEnrollmentResponse> result = enrollmentRepository.findMyEnrollments(park, null);

    assertThat(result).hasSize(2);
    MyEnrollmentResponse first = result.get(0);
    assertThat(first.getEnrollmentId()).isEqualTo(parkB.getId());
    assertThat(first.getSessionId()).isEqualTo(b.getId());
    assertThat(first.getCourseId()).isEqualTo(courseB.getId());
    assertThat(first.getCourseTitle()).isEqualTo(courseB.getTitle());
    assertThat(first.getSessionStartAt()).isEqualTo(NOW.plusDays(2));
    assertThat(first.getPlace()).isEqualTo("B실");
    assertThat(first.getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
    assertThat(first.getConfirmedAt()).isNotNull();
    assertThat(first.isPromoted()).isFalse();
    assertThat(result.get(1).getEnrollmentId()).isEqualTo(parkA.getId());
    assertThat(result.get(1).getCourseTitle()).isEqualTo(courseA.getTitle());
  }

  @Test
  void waitingNumberMatchesCountAhead() {
    CourseSession session = newSession();
    enrollmentRepository.saveAndFlush(Enrollment.confirm(session, uniqueEmployeeId(), NOW));
    enrollmentRepository.saveAndFlush(
        Enrollment.waiting(session, uniqueEmployeeId(), NOW.plusMinutes(1)));
    Long second = uniqueEmployeeId();
    Enrollment target =
        enrollmentRepository.saveAndFlush(Enrollment.waiting(session, second, NOW.plusMinutes(2)));
    em.clear();

    MyEnrollmentResponse result = enrollmentRepository.findMyEnrollments(second, null).get(0);

    long ahead =
        enrollmentRepository.countAhead(
            session.getId(), EnrollmentStatus.WAITING, target.getAppliedAt(), target.getId());
    assertThat(result.getWaitingNumber()).isEqualTo(2);
    assertThat(result.getWaitingNumber()).isEqualTo((int) ahead + 1);
  }

  @Test
  void tiedAppliedAtOrdersById() {
    CourseSession session = newSession();
    Long empA = uniqueEmployeeId();
    Long empB = uniqueEmployeeId();
    Enrollment a = enrollmentRepository.saveAndFlush(Enrollment.waiting(session, empA, NOW));
    Enrollment b = enrollmentRepository.saveAndFlush(Enrollment.waiting(session, empB, NOW));
    Enrollment small = a.getId() < b.getId() ? a : b;
    Enrollment large = small == a ? b : a;
    em.clear();

    MyEnrollmentResponse smallResult =
        enrollmentRepository.findMyEnrollments(small.getEmployeeId(), null).get(0);
    MyEnrollmentResponse largeResult =
        enrollmentRepository.findMyEnrollments(large.getEmployeeId(), null).get(0);

    assertThat(smallResult.getWaitingNumber()).isEqualTo(1);
    assertThat(largeResult.getWaitingNumber()).isEqualTo(2);
    assertThat(smallResult.getWaitingNumber())
        .isEqualTo(
            (int)
                    enrollmentRepository.countAhead(
                        session.getId(), EnrollmentStatus.WAITING, NOW, small.getId())
                + 1);
    assertThat(largeResult.getWaitingNumber())
        .isEqualTo(
            (int)
                    enrollmentRepository.countAhead(
                        session.getId(), EnrollmentStatus.WAITING, NOW, large.getId())
                + 1);
  }

  @Test
  void otherSessionWaitingDoesNotAffectNumber() {
    CourseSession x = newSession();
    CourseSession y = newSession();
    enrollmentRepository.saveAndFlush(
        Enrollment.waiting(x, uniqueEmployeeId(), NOW.minusMinutes(10)));
    enrollmentRepository.saveAndFlush(
        Enrollment.waiting(x, uniqueEmployeeId(), NOW.minusMinutes(9)));
    Long me = uniqueEmployeeId();
    enrollmentRepository.saveAndFlush(Enrollment.waiting(y, me, NOW));
    em.clear();

    List<MyEnrollmentResponse> result = enrollmentRepository.findMyEnrollments(me, null);

    assertThat(result).hasSize(1);
    assertThat(result.get(0).getWaitingNumber()).isEqualTo(1);
  }

  @Test
  void filtersByStatus() {
    Long employeeId = uniqueEmployeeId();
    enrollmentRepository.saveAndFlush(Enrollment.confirm(newSession(), employeeId, NOW));
    enrollmentRepository.saveAndFlush(
        Enrollment.waiting(newSession(), employeeId, NOW.plusMinutes(1)));
    em.clear();

    List<MyEnrollmentResponse> waiting =
        enrollmentRepository.findMyEnrollments(employeeId, EnrollmentStatus.WAITING);
    List<MyEnrollmentResponse> cancelled =
        enrollmentRepository.findMyEnrollments(employeeId, EnrollmentStatus.CANCELLED);

    assertThat(waiting).hasSize(1);
    assertThat(waiting.get(0).getStatus()).isEqualTo(EnrollmentStatus.WAITING);
    assertThat(cancelled).isEmpty();
  }

  @Test
  void nonWaitingHasNullWaitingNumber() {
    Long employeeId = uniqueEmployeeId();
    enrollmentRepository.saveAndFlush(Enrollment.confirm(newSession(), employeeId, NOW));
    em.clear();

    List<MyEnrollmentResponse> result = enrollmentRepository.findMyEnrollments(employeeId, null);

    assertThat(result).hasSize(1);
    assertThat(result.get(0).getWaitingNumber()).isNull();
  }

  @Test
  void runsSingleQuery() {
    Long employeeId = uniqueEmployeeId();
    CourseSession full = newSession();
    enrollmentRepository.saveAndFlush(Enrollment.confirm(full, uniqueEmployeeId(), NOW));
    enrollmentRepository.saveAndFlush(Enrollment.waiting(full, employeeId, NOW.plusMinutes(1)));
    enrollmentRepository.saveAndFlush(
        Enrollment.confirm(newSession(), employeeId, NOW.plusMinutes(2)));
    enrollmentRepository.saveAndFlush(
        Enrollment.confirm(newSession(), employeeId, NOW.plusMinutes(3)));
    em.flush();
    em.clear();
    Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    statistics.clear();

    List<MyEnrollmentResponse> result = enrollmentRepository.findMyEnrollments(employeeId, null);

    assertThat(result).hasSize(3);
    assertThat(statistics.getPrepareStatementCount()).isEqualTo(1);
  }

  private CourseSession newSession() {
    Course course = em.persistAndFlush(Course.create("테스트 과정 " + System.nanoTime(), "개발", "설명"));
    return em.persistAndFlush(CourseSession.create(course, NOW.plusDays(1), "교육장", 10));
  }

  private Long uniqueEmployeeId() {
    return NEXT_EMPLOYEE_ID.incrementAndGet();
  }
}
