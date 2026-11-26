package com.example.eduhub.enrollment;

import static com.example.eduhub.TestAuth.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

/**
 * 내 신청 내역 통합 테스트 S1~S10 (FR-07, NFR-02, NFR-03, D-04). 신청·취소는 실제 서비스 경로로 만든다.
 *
 * <p>준비: 정원 1 회차 A(과정 "가"), 정원 10 회차 B(과정 "나"). 김→A(확정), 이→A(대기 1), 박→A(대기 2), 박→B(확정).
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class MyEnrollmentsTest {

  private static final AtomicLong NEXT_EMPLOYEE_ID = new AtomicLong(System.nanoTime());

  @Autowired private MockMvc mockMvc;
  @Autowired private EnrollmentService enrollmentService;
  @Autowired private CourseRepository courseRepository;
  @Autowired private CourseSessionRepository courseSessionRepository;
  @Autowired private EntityManager em;
  @Autowired private EntityManagerFactory entityManagerFactory;

  private Course courseA;
  private Course courseB;
  private CourseSession sessionA;
  private CourseSession sessionB;
  private Long kim;
  private Long lee;
  private Long park;
  private EnrollmentResponse kimA;
  private EnrollmentResponse leeA;
  private EnrollmentResponse parkA;
  private EnrollmentResponse parkB;

  @BeforeEach
  void setUp() {
    long tag = System.nanoTime();
    courseA = courseRepository.save(Course.create("과정 가 " + tag, "개발", "설명"));
    courseB = courseRepository.save(Course.create("과정 나 " + tag, "개발", "설명"));
    LocalDateTime start = LocalDateTime.now().plusDays(7);
    sessionA = courseSessionRepository.save(CourseSession.create(courseA, start, "A실", 1));
    sessionB = courseSessionRepository.save(CourseSession.create(courseB, start, "B실", 10));
    kim = NEXT_EMPLOYEE_ID.incrementAndGet();
    lee = NEXT_EMPLOYEE_ID.incrementAndGet();
    park = NEXT_EMPLOYEE_ID.incrementAndGet();
    kimA = enrollmentService.apply(kim, sessionA.getId());
    leeA = enrollmentService.apply(lee, sessionA.getId());
    parkA = enrollmentService.apply(park, sessionA.getId());
    parkB = enrollmentService.apply(park, sessionB.getId());
  }

  @Test
  void s1_returnsMyEnrollmentsNewestFirstWithWaitingNumber() throws Exception {
    mockMvc
        .perform(get("/api/v1/me/enrollments").with(as(park, "EMPLOYEE")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(2)))
        .andExpect(jsonPath("$[0].enrollmentId").value(parkB.getId()))
        .andExpect(jsonPath("$[0].status").value("CONFIRMED"))
        .andExpect(jsonPath("$[0].waitingNumber").value(nullValue()))
        .andExpect(jsonPath("$[0].courseId").value(courseB.getId()))
        .andExpect(jsonPath("$[0].courseTitle").value(courseB.getTitle()))
        .andExpect(jsonPath("$[0].sessionId").value(sessionB.getId()))
        .andExpect(jsonPath("$[0].sessionStartAt").value(notNullValue()))
        .andExpect(jsonPath("$[0].place").value("B실"))
        .andExpect(jsonPath("$[1].enrollmentId").value(parkA.getId()))
        .andExpect(jsonPath("$[1].status").value("WAITING"))
        .andExpect(jsonPath("$[1].waitingNumber").value(2))
        .andExpect(jsonPath("$[1].courseTitle").value(courseA.getTitle()))
        .andExpect(jsonPath("$[1].place").value("A실"));
  }

  @Test
  void s2_employeeIdQueryParamIsIgnored() throws Exception {
    mockMvc
        .perform(
            get("/api/v1/me/enrollments")
                .param("employeeId", String.valueOf(kim))
                .with(as(park, "EMPLOYEE")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(2)))
        .andExpect(jsonPath("$[0].enrollmentId").value(parkB.getId()))
        .andExpect(jsonPath("$[1].enrollmentId").value(parkA.getId()));
  }

  @Test
  void s3_confirmedEnrollmentHasConfirmedAtAndNotPromoted() throws Exception {
    mockMvc
        .perform(get("/api/v1/me/enrollments").with(as(kim, "EMPLOYEE")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(1)))
        .andExpect(jsonPath("$[0].enrollmentId").value(kimA.getId()))
        .andExpect(jsonPath("$[0].status").value("CONFIRMED"))
        .andExpect(jsonPath("$[0].confirmedAt").value(notNullValue()))
        .andExpect(jsonPath("$[0].promoted").value(false));
  }

  @Test
  void s4_filtersByStatus() throws Exception {
    mockMvc
        .perform(
            get("/api/v1/me/enrollments").param("status", "WAITING").with(as(park, "EMPLOYEE")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(1)))
        .andExpect(jsonPath("$[0].enrollmentId").value(parkA.getId()))
        .andExpect(jsonPath("$[0].status").value("WAITING"));
  }

  @Test
  void s5_promotedAfterCancelShowsConfirmedAndPromoted() throws Exception {
    enrollmentService.cancel(kim, kimA.getId());

    mockMvc
        .perform(get("/api/v1/me/enrollments").with(as(lee, "EMPLOYEE")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(1)))
        .andExpect(jsonPath("$[0].enrollmentId").value(leeA.getId()))
        .andExpect(jsonPath("$[0].status").value("CONFIRMED"))
        .andExpect(jsonPath("$[0].promoted").value(true))
        .andExpect(jsonPath("$[0].confirmedAt").value(notNullValue()))
        .andExpect(jsonPath("$[0].waitingNumber").value(nullValue()));
  }

  @Test
  void s6_noEnrollmentsReturnsEmptyArray() throws Exception {
    mockMvc
        .perform(
            get("/api/v1/me/enrollments").with(as(NEXT_EMPLOYEE_ID.incrementAndGet(), "EMPLOYEE")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(0)));
  }

  @Test
  void s7_invalidStatusIsBadRequest() throws Exception {
    mockMvc
        .perform(get("/api/v1/me/enrollments").param("status", "NOPE").with(as(park, "EMPLOYEE")))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  void s8_withoutTokenIsUnauthorized() throws Exception {
    mockMvc
        .perform(get("/api/v1/me/enrollments"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
  }

  @Test
  void s9_runsSingleSqlForList() throws Exception {
    em.flush();
    em.clear();
    Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    statistics.clear();

    mockMvc
        .perform(get("/api/v1/me/enrollments").with(as(park, "EMPLOYEE")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(2)));

    assertThat(statistics.getPrepareStatementCount()).isEqualTo(1);
  }

  @Test
  void s10_waitingNumberMatchesSingleLookup() throws Exception {
    MvcResult single =
        mockMvc
            .perform(get("/api/v1/enrollments/" + parkA.getId()).with(as(park, "EMPLOYEE")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.waitingNumber").value(2))
            .andReturn();
    assertThat(single.getResponse().getContentAsString()).contains("\"waitingNumber\":2");

    mockMvc
        .perform(
            get("/api/v1/me/enrollments").param("status", "WAITING").with(as(park, "EMPLOYEE")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].waitingNumber").value(2));
  }
}
