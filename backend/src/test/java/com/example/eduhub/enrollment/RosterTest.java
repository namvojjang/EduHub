package com.example.eduhub.enrollment;

import static com.example.eduhub.TestAuth.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.eduhub.auth.Employee;
import com.example.eduhub.auth.EmployeeRepository;
import com.example.eduhub.auth.EmployeeRole;
import com.example.eduhub.course.Course;
import com.example.eduhub.course.CourseRepository;
import com.example.eduhub.course.CourseSession;
import com.example.eduhub.course.CourseSessionRepository;
import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicLong;
import javax.persistence.EntityManager;
import javax.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * 회차 명단 통합 테스트 R1~R3 (FR-08, NFR-02, NFR-03). 신청·취소는 실제 서비스 경로로 만든다.
 *
 * <p>준비: 정원 1 회차. 김→확정, 이→대기 1, 박→대기 2, 최→대기 후 취소.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class RosterTest {

  private static final AtomicLong NEXT_ID = new AtomicLong(System.nanoTime());

  @Autowired private MockMvc mockMvc;
  @Autowired private EnrollmentService enrollmentService;
  @Autowired private CourseRepository courseRepository;
  @Autowired private CourseSessionRepository courseSessionRepository;
  @Autowired private EmployeeRepository employeeRepository;
  @Autowired private EntityManager em;
  @Autowired private EntityManagerFactory entityManagerFactory;

  private Course course;
  private CourseSession session;
  private String tag;
  private Employee kim;
  private Employee lee;
  private Employee park;
  private Employee choi;
  private EnrollmentResponse kimEnrollment;
  private EnrollmentResponse leeEnrollment;
  private EnrollmentResponse parkEnrollment;

  @BeforeEach
  void setUp() {
    tag = String.valueOf(System.nanoTime());
    course = courseRepository.save(Course.create("명단 과정 " + tag, "개발", "설명"));
    session =
        courseSessionRepository.save(
            CourseSession.create(course, LocalDateTime.now().plusDays(7), "A실", 1));
    kim = employee("김", 1);
    lee = employee("이", 2);
    park = employee("박", 3);
    choi = employee("최", 4);
    kimEnrollment = enrollmentService.apply(kim.getId(), session.getId());
    leeEnrollment = enrollmentService.apply(lee.getId(), session.getId());
    parkEnrollment = enrollmentService.apply(park.getId(), session.getId());
    EnrollmentResponse choiEnrollment = enrollmentService.apply(choi.getId(), session.getId());
    enrollmentService.cancel(choi.getId(), choiEnrollment.getId());
  }

  private Employee employee(String name, int index) {
    // 사번은 20자 이내 고유값. 해시는 아무 문자열이다(로그인하지 않는다).
    String employeeNo = "R" + (NEXT_ID.incrementAndGet() % 1_000_000_000L) + index;
    return employeeRepository.saveAndFlush(
        Employee.create(employeeNo, name, "not-a-real-hash", EmployeeRole.EMPLOYEE));
  }

  @Test
  void r1_listsConfirmedAndWaitingWithoutCancelled() throws Exception {
    mockMvc
        .perform(get("/api/v1/admin/sessions/" + session.getId() + "/roster").with(admin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sessionId").value(session.getId()))
        .andExpect(jsonPath("$.courseId").value(course.getId()))
        .andExpect(jsonPath("$.courseTitle").value(course.getTitle()))
        .andExpect(jsonPath("$.sessionStatus").value("RECRUITING"))
        .andExpect(jsonPath("$.capacity").value(1))
        .andExpect(jsonPath("$.sessionStartAt").exists())
        .andExpect(jsonPath("$.confirmed", hasSize(1)))
        .andExpect(jsonPath("$.confirmed[0].enrollmentId").value(kimEnrollment.getId()))
        .andExpect(jsonPath("$.confirmed[0].employeeId").value(kim.getId()))
        .andExpect(jsonPath("$.confirmed[0].employeeNo").value(kim.getEmployeeNo()))
        .andExpect(jsonPath("$.confirmed[0].name").value("김"))
        .andExpect(jsonPath("$.confirmed[0].status").value("CONFIRMED"))
        .andExpect(jsonPath("$.confirmed[0].waitingNumber").value(nullValue()))
        .andExpect(jsonPath("$.confirmed[0].confirmedAt").exists())
        .andExpect(jsonPath("$.confirmed[0].promoted").value(false))
        .andExpect(jsonPath("$.waiting", hasSize(2)))
        .andExpect(jsonPath("$.waiting[0].enrollmentId").value(leeEnrollment.getId()))
        .andExpect(jsonPath("$.waiting[0].name").value("이"))
        .andExpect(jsonPath("$.waiting[0].employeeNo").value(lee.getEmployeeNo()))
        .andExpect(jsonPath("$.waiting[0].status").value("WAITING"))
        .andExpect(jsonPath("$.waiting[0].waitingNumber").value(1))
        .andExpect(jsonPath("$.waiting[1].enrollmentId").value(parkEnrollment.getId()))
        .andExpect(jsonPath("$.waiting[1].name").value("박"))
        .andExpect(jsonPath("$.waiting[1].waitingNumber").value(2));
  }

  @Test
  void r2_enrollmentWithoutEmployeeRowIsListedWithNullNameAndNo() throws Exception {
    long ghostId = NEXT_ID.incrementAndGet();
    CourseSession other =
        courseSessionRepository.save(
            CourseSession.create(course, LocalDateTime.now().plusDays(8), "B실", 5));
    EnrollmentResponse ghost = enrollmentService.apply(ghostId, other.getId());

    mockMvc
        .perform(get("/api/v1/admin/sessions/" + other.getId() + "/roster").with(admin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.confirmed", hasSize(1)))
        .andExpect(jsonPath("$.confirmed[0].enrollmentId").value(ghost.getId()))
        .andExpect(jsonPath("$.confirmed[0].employeeId").value(ghostId))
        .andExpect(jsonPath("$.confirmed[0].employeeNo").value(nullValue()))
        .andExpect(jsonPath("$.confirmed[0].name").value(nullValue()))
        .andExpect(jsonPath("$.waiting", hasSize(0)));
  }

  @Test
  void r3_employeeTokenIsForbidden() throws Exception {
    mockMvc
        .perform(
            get("/api/v1/admin/sessions/" + session.getId() + "/roster")
                .with(as(kim.getId(), "EMPLOYEE")))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  void unknownSessionIsNotFound() throws Exception {
    mockMvc
        .perform(get("/api/v1/admin/sessions/-1/roster").with(admin()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("SESSION_NOT_FOUND"));
  }

  @Test
  void rosterSqlCountDoesNotDependOnHeadcount() throws Exception {
    long small = countStatementsForRoster();

    for (int i = 0; i < 6; i++) {
      enrollmentService.apply(employee("추가" + i, 10 + i).getId(), session.getId());
    }
    long large = countStatementsForRoster();

    System.out.println("ROSTER SQL COUNT small(4 people)=" + small + " large(10 people)=" + large);
    assertThat(large).isEqualTo(small);
    assertThat(small).isEqualTo(4);
  }

  private long countStatementsForRoster() throws Exception {
    em.flush();
    em.clear();
    Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    statistics.clear();

    mockMvc
        .perform(get("/api/v1/admin/sessions/" + session.getId() + "/roster").with(admin()))
        .andExpect(status().isOk());

    return statistics.getPrepareStatementCount();
  }

  private static org.springframework.test.web.servlet.request.RequestPostProcessor admin() {
    return as(1L, "ADMIN");
  }
}
