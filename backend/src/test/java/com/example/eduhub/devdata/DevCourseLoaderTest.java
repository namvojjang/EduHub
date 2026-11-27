package com.example.eduhub.devdata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.example.eduhub.auth.DevAccountLoader;
import com.example.eduhub.auth.Employee;
import com.example.eduhub.auth.EmployeeRepository;
import com.example.eduhub.auth.EmployeeRole;
import com.example.eduhub.course.Course;
import com.example.eduhub.course.CourseRepository;
import com.example.eduhub.course.CourseSession;
import com.example.eduhub.course.CourseSessionRepository;
import com.example.eduhub.enrollment.Enrollment;
import com.example.eduhub.enrollment.EnrollmentRepository;
import com.example.eduhub.enrollment.EnrollmentStatus;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

class DevCourseLoaderTest {

  private static final Clock CLOCK =
      Clock.fixed(Instant.parse("2026-11-27T05:30:00Z"), ZoneId.of("Asia/Seoul"));
  private static final LocalDateTime NOW = LocalDateTime.now(CLOCK);

  private final CourseRepository courseRepository = mock(CourseRepository.class);
  private final CourseSessionRepository sessionRepository = mock(CourseSessionRepository.class);
  private final EnrollmentRepository enrollmentRepository = mock(EnrollmentRepository.class);
  private final EmployeeRepository employeeRepository = mock(EmployeeRepository.class);
  private final DevCourseLoader loader =
      new DevCourseLoader(
          courseRepository, sessionRepository, enrollmentRepository, employeeRepository, CLOCK);
  private final ApplicationArguments args = mock(ApplicationArguments.class);

  private void stubEmptyDb(boolean withEmployees) {
    when(courseRepository.count()).thenReturn(0L);
    when(courseRepository.save(any(Course.class))).thenAnswer(inv -> inv.getArgument(0));
    when(sessionRepository.save(any(CourseSession.class))).thenAnswer(inv -> inv.getArgument(0));
    when(enrollmentRepository.save(any(Enrollment.class))).thenAnswer(inv -> inv.getArgument(0));
    if (withEmployees) {
      when(employeeRepository.findByEmployeeNo("E1001")).thenReturn(Optional.of(employee(1L)));
      when(employeeRepository.findByEmployeeNo("E1002")).thenReturn(Optional.of(employee(2L)));
    } else {
      when(employeeRepository.findByEmployeeNo(any())).thenReturn(Optional.empty());
    }
  }

  private Employee employee(long id) {
    Employee e = Employee.create("E100" + id, "사원" + id, "hash", EmployeeRole.EMPLOYEE);
    ReflectionTestUtils.setField(e, "id", id);
    return e;
  }

  private List<CourseSession> savedSessions() {
    ArgumentCaptor<CourseSession> captor = ArgumentCaptor.forClass(CourseSession.class);
    verify(sessionRepository, times(4)).save(captor.capture());
    return captor.getAllValues();
  }

  private List<Enrollment> savedEnrollments() {
    ArgumentCaptor<Enrollment> captor = ArgumentCaptor.forClass(Enrollment.class);
    verify(enrollmentRepository, times(3)).save(captor.capture());
    return captor.getAllValues();
  }

  @Test
  void skipsWhenCoursesExist() {
    when(courseRepository.count()).thenReturn(1L);

    loader.run(args);

    verify(courseRepository, never()).save(any(Course.class));
    verify(sessionRepository, never()).save(any(CourseSession.class));
    verify(enrollmentRepository, never()).save(any(Enrollment.class));
    verifyNoInteractions(employeeRepository);
  }

  @Test
  void createsThreeCoursesFourSessionsThreeEnrollments() {
    stubEmptyDb(true);

    loader.run(args);

    ArgumentCaptor<Course> captor = ArgumentCaptor.forClass(Course.class);
    verify(courseRepository, times(3)).save(captor.capture());
    assertThat(captor.getAllValues())
        .extracting(Course::getTitle)
        .containsExactly("데이터 분석 with SQL", "Java 백엔드 기초", "업무 커뮤니케이션");
    assertThat(savedSessions()).hasSize(4);
    assertThat(savedEnrollments()).hasSize(3);
  }

  @Test
  void pastSessionHasTwoConfirmedEnrollments() {
    stubEmptyDb(true);

    loader.run(args);

    CourseSession past = savedSessions().get(0);
    assertThat(past.getStartAt()).isEqualTo(LocalDateTime.of(2026, 11, 26, 10, 0));
    List<Enrollment> onPast =
        savedEnrollments().stream()
            .filter(e -> e.getSession() == past)
            .collect(Collectors.toList());
    assertThat(onPast).extracting(Enrollment::getEmployeeId).containsExactlyInAnyOrder(1L, 2L);
    assertThat(onPast).extracting(Enrollment::getStatus).containsOnly(EnrollmentStatus.CONFIRMED);
  }

  @Test
  void otherSessionsStartInFuture() {
    stubEmptyDb(true);

    loader.run(args);

    List<CourseSession> others = savedSessions().subList(1, 4);
    assertThat(others).hasSize(3);
    for (CourseSession s : others) {
      assertThat(s.getStartAt().isAfter(NOW)).isTrue();
    }
  }

  @Test
  void thirdEnrollmentIsOnJavaCourseSession() {
    stubEmptyDb(true);

    loader.run(args);

    List<CourseSession> sessions = savedSessions();
    Enrollment third = savedEnrollments().get(2);
    assertThat(third.getEmployeeId()).isEqualTo(1L);
    assertThat(third.getSession()).isSameAs(sessions.get(2));
    assertThat(third.getSession()).isNotSameAs(sessions.get(1));
    assertThat(third.getSession().getCourse().getTitle()).isEqualTo("Java 백엔드 기초");
  }

  @Test
  void sessionCapacitiesAndCoursesAreInOrder() {
    stubEmptyDb(true);

    loader.run(args);

    List<CourseSession> sessions = savedSessions();
    assertThat(sessions).extracting(CourseSession::getCapacity).containsExactly(10, 20, 2, 30);
    assertThat(sessions)
        .extracting(s -> s.getCourse().getTitle())
        .containsExactly("데이터 분석 with SQL", "데이터 분석 with SQL", "Java 백엔드 기초", "업무 커뮤니케이션");
  }

  @Test
  void appliedAtIsTruncatedToHourAndBeforeSessionStart() {
    stubEmptyDb(true);

    loader.run(args);

    LocalDateTime base = NOW.truncatedTo(ChronoUnit.HOURS);
    List<Enrollment> enrollments = savedEnrollments();
    assertThat(enrollments)
        .extracting(Enrollment::getAppliedAt)
        .containsExactly(base.minusDays(7), base.minusDays(7), base.minusDays(1));
    for (Enrollment e : enrollments) {
      assertThat(e.getAppliedAt().isBefore(e.getSession().getStartAt())).isTrue();
    }
  }

  @Test
  void loaderIsDevOnlyAndRunsAfterAccountLoaderInTransaction() throws Exception {
    Profile profile = DevCourseLoader.class.getAnnotation(Profile.class);
    assertThat(profile).isNotNull();
    assertThat(profile.value()).containsExactly("dev");
    int courseOrder = DevCourseLoader.class.getAnnotation(Order.class).value();
    int accountOrder = DevAccountLoader.class.getAnnotation(Order.class).value();
    assertThat(courseOrder).isGreaterThan(accountOrder);
    assertThat(
            DevCourseLoader.class
                .getMethod("run", ApplicationArguments.class)
                .isAnnotationPresent(Transactional.class))
        .isTrue();
  }

  @Test
  void skipsEnrollmentsWhenDevAccountsMissing() {
    stubEmptyDb(false);

    loader.run(args);

    verify(courseRepository, times(3)).save(any(Course.class));
    verify(sessionRepository, times(4)).save(any(CourseSession.class));
    verify(enrollmentRepository, never()).save(any(Enrollment.class));
  }
}
