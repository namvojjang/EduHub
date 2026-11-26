package com.example.eduhub.course;

import static com.example.eduhub.TestAuth.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.eduhub.enrollment.Enrollment;
import com.example.eduhub.enrollment.EnrollmentRepository;
import com.example.eduhub.enrollment.EnrollmentResponse;
import com.example.eduhub.enrollment.EnrollmentService;
import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicLong;
import javax.persistence.EntityManager;
import javax.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/**
 * 회차 남은 자리 통합 테스트 S1~S7 (FR-02, NFR-02, NFR-07). 신청·취소는 실제 서비스 경로로 만든다. 테스트 DB를 다른 테스트와 같이 쓰므로
 * 테스트마다 새 과정·회차를 만들고 그 id로만 검증한다.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class RemainingSeatsTest {

  private static final AtomicLong NEXT_EMPLOYEE_ID = new AtomicLong(System.nanoTime());

  @Autowired private MockMvc mockMvc;
  @Autowired private EnrollmentService enrollmentService;
  @Autowired private EnrollmentRepository enrollmentRepository;
  @Autowired private CourseRepository courseRepository;
  @Autowired private CourseSessionRepository courseSessionRepository;
  @Autowired private EntityManager em;
  @Autowired private EntityManagerFactory entityManagerFactory;

  private Course newCourse() {
    return courseRepository.save(Course.create("남은 자리 " + System.nanoTime(), "개발", "설명"));
  }

  private CourseSession newSession(Course course, int capacity) {
    return courseSessionRepository.save(
        CourseSession.create(course, LocalDateTime.now().plusDays(7), "A실", capacity));
  }

  private EnrollmentResponse apply(CourseSession session) {
    return enrollmentService.apply(NEXT_EMPLOYEE_ID.incrementAndGet(), session.getId());
  }

  private void expectRemaining(Course course, int... remaining) throws Exception {
    ResultActions result =
        mockMvc
            .perform(get("/api/v1/courses/" + course.getId()).with(as(1L, "EMPLOYEE")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sessions", hasSize(remaining.length)));
    for (int i = 0; i < remaining.length; i++) {
      result.andExpect(jsonPath("$.sessions[" + i + "].remainingSeats").value(remaining[i]));
    }
  }

  @Test
  void s1_confirmedReducesRemaining() throws Exception {
    Course course = newCourse();
    CourseSession session = newSession(course, 3);
    apply(session);
    apply(session);

    expectRemaining(course, 1);
  }

  @Test
  void s2_waitingIsNotCounted() throws Exception {
    Course course = newCourse();
    CourseSession session = newSession(course, 1);
    apply(session);
    apply(session);
    apply(session);

    expectRemaining(course, 0);
  }

  @Test
  void s3_cancelledIsNotCounted() throws Exception {
    Course course = newCourse();
    CourseSession session = newSession(course, 3);
    apply(session);
    EnrollmentResponse cancelled = apply(session);
    Enrollment e = enrollmentRepository.findById(cancelled.getId()).get();
    enrollmentService.cancel(e.getEmployeeId(), e.getId());

    expectRemaining(course, 2);
  }

  @Test
  void s4_completedAndNotCompletedOccupySeats() throws Exception {
    Course course = newCourse();
    CourseSession session = newSession(course, 5);
    enrollmentRepository.findById(apply(session).getId()).get().recordCompletion(true);
    enrollmentRepository.findById(apply(session).getId()).get().recordCompletion(false);
    em.flush();

    expectRemaining(course, 3);
  }

  @Test
  void s5_noEnrollmentsKeepsCapacityAndCourseWithoutSessionsIsEmpty() throws Exception {
    Course course = newCourse();
    newSession(course, 4);
    newSession(course, 7);
    expectRemaining(course, 4, 7);

    Course empty = newCourse();
    em.flush();
    em.clear();
    Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    statistics.clear();
    expectRemaining(empty);
    // 과정 조회 + 회차 조회뿐이다. 회차가 없으면 집계 쿼리를 부르지 않는다.
    assertThat(statistics.getPrepareStatementCount()).isEqualTo(2);
  }

  @Test
  void s6_sqlCountDoesNotGrowWithSessionCount() throws Exception {
    Course single = newCourse();
    apply(newSession(single, 2));
    Course five = newCourse();
    for (int i = 0; i < 5; i++) {
      apply(newSession(five, 2));
    }

    long singleCount = detailSqlCount(single);
    long fiveCount = detailSqlCount(five);

    // 과정 조회 + 회차 조회 + 집계 1번. 집계가 빠지거나 두 번 나가면 실패한다.
    assertThat(singleCount).isEqualTo(3);
    assertThat(fiveCount).isEqualTo(3);
  }

  private long detailSqlCount(Course course) throws Exception {
    em.flush();
    em.clear();
    Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    statistics.clear();
    mockMvc
        .perform(get("/api/v1/courses/" + course.getId()).with(as(1L, "EMPLOYEE")))
        .andExpect(status().isOk());
    return statistics.getPrepareStatementCount();
  }

  @Test
  void completeSessionResponseReflectsConfirmed() throws Exception {
    Course course = newCourse();
    CourseSession session = newSession(course, 2);
    apply(session);
    apply(session);
    apply(session); // 대기
    // 정원 증가 시 자동 승급(D-02)은 아직 없으므로, 정원만 3으로 올리고 시작 시각을 지나게 한다.
    ReflectionTestUtils.setField(session, "capacity", 3);
    ReflectionTestUtils.setField(session, "startAt", LocalDateTime.now().minusHours(1));
    em.flush();

    mockMvc
        .perform(
            post("/api/v1/admin/sessions/" + session.getId() + "/complete").with(as(1L, "ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("COMPLETED"))
        .andExpect(jsonPath("$.capacity").value(3))
        .andExpect(jsonPath("$.remainingSeats").value(1));
  }

  @Test
  void s7_adminUpdateAndCloseSessionReflectConfirmed() throws Exception {
    Course course = newCourse();
    CourseSession session = newSession(course, 5);
    apply(session);
    apply(session);
    em.flush();

    mockMvc
        .perform(
            put("/api/v1/admin/sessions/" + session.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"startAt\":\""
                        + LocalDateTime.now().plusDays(30)
                        + "\",\"place\":\"Z실\",\"capacity\":6}")
                .with(as(1L, "ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.capacity").value(6))
        .andExpect(jsonPath("$.remainingSeats").value(4));

    mockMvc
        .perform(post("/api/v1/admin/sessions/" + session.getId() + "/close").with(as(1L, "ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.remainingSeats").value(4));

    mockMvc
        .perform(post("/api/v1/admin/courses/" + course.getId() + "/close").with(as(1L, "ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sessions[0].remainingSeats").value(4));
  }
}
