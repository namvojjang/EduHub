package com.example.eduhub.devdata;

import com.example.eduhub.auth.Employee;
import com.example.eduhub.auth.EmployeeRepository;
import com.example.eduhub.course.Course;
import com.example.eduhub.course.CourseRepository;
import com.example.eduhub.course.CourseSession;
import com.example.eduhub.course.CourseSessionRepository;
import com.example.eduhub.enrollment.Enrollment;
import com.example.eduhub.enrollment.EnrollmentRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * dev 프로필 전용 기본 과정·회차·신청 데이터. 운영·테스트 프로필에서는 만들어지지 않는다.
 *
 * <p>과정이 하나도 없을 때만 만든다. 첫 과정의 첫 회차는 어제 시작한 지난 회차이고 E1001·E1002가 확정돼 있어, 교육 완료·수료 처리 흐름(D-05)을 바로
 * 확인할 수 있다. 회차 등록 API는 지난 시각을 받지 않으므로 엔티티로 직접 만든다.
 */
@Slf4j
@Component
@Profile("dev")
@Order(2)
public class DevCourseLoader implements ApplicationRunner {

  private final CourseRepository courseRepository;
  private final CourseSessionRepository courseSessionRepository;
  private final EnrollmentRepository enrollmentRepository;
  private final EmployeeRepository employeeRepository;
  private final Clock clock;

  @Autowired
  public DevCourseLoader(
      CourseRepository courseRepository,
      CourseSessionRepository courseSessionRepository,
      EnrollmentRepository enrollmentRepository,
      EmployeeRepository employeeRepository) {
    this(
        courseRepository,
        courseSessionRepository,
        enrollmentRepository,
        employeeRepository,
        Clock.systemDefaultZone());
  }

  DevCourseLoader(
      CourseRepository courseRepository,
      CourseSessionRepository courseSessionRepository,
      EnrollmentRepository enrollmentRepository,
      EmployeeRepository employeeRepository,
      Clock clock) {
    this.courseRepository = courseRepository;
    this.courseSessionRepository = courseSessionRepository;
    this.enrollmentRepository = enrollmentRepository;
    this.employeeRepository = employeeRepository;
    this.clock = clock;
  }

  // 전부 만들거나 전부 안 만든다(일부만 생기면 count()!=0이라 다시 채워지지 않는다).
  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    if (courseRepository.count() != 0) {
      return;
    }
    LocalDateTime now = LocalDateTime.now(clock);

    Course sql = saveCourse("데이터 분석 with SQL", "데이터", "SELECT부터 집계·조인까지 업무 데이터를 SQL로 분석하는 실습 과정");
    // 어제 10:00. 항상 과거다.
    CourseSession session11 =
        saveSession(sql, now.toLocalDate().minusDays(1).atTime(10, 0), "본사 3층 교육장", 10);
    saveSession(sql, now.toLocalDate().plusDays(14).atTime(10, 0), "본사 3층 교육장", 20);

    Course java = saveCourse("Java 백엔드 기초", "개발", "Spring Boot로 REST API를 만들고 테스트하는 입문 과정");
    CourseSession session21 =
        saveSession(java, now.toLocalDate().plusDays(7).atTime(14, 0), "온라인(Zoom)", 2);

    Course communication = saveCourse("업무 커뮤니케이션", "직무", "보고·회의·메일 작성 등 일상 업무 소통 방법을 익히는 과정");
    saveSession(communication, now.toLocalDate().plusDays(10).atTime(9, 0), "본사 5층 세미나실", 30);

    Optional<Employee> e1001 = employeeRepository.findByEmployeeNo("E1001");
    Optional<Employee> e1002 = employeeRepository.findByEmployeeNo("E1002");
    if (!e1001.isPresent() || !e1002.isPresent()) {
      log.warn("개발 계정(E1001, E1002)이 없어 신청 데이터는 만들지 않습니다");
      return;
    }
    Long id1 = e1001.get().getId();
    Long id2 = e1002.get().getId();
    enrollmentRepository.save(Enrollment.confirm(session11, id1, now.minusDays(7)));
    enrollmentRepository.save(Enrollment.confirm(session11, id2, now.minusDays(7)));
    enrollmentRepository.save(Enrollment.confirm(session21, id1, now.minusDays(1)));
  }

  private Course saveCourse(String title, String category, String description) {
    Course course = Course.create(title, category, description);
    courseRepository.save(course);
    log.info("개발 과정 생성: {}", title);
    return course;
  }

  private CourseSession saveSession(
      Course course, LocalDateTime startAt, String place, int capacity) {
    CourseSession session = course.openSession(startAt, place, capacity);
    courseSessionRepository.save(session);
    return session;
  }
}
