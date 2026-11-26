package com.example.eduhub.enrollment;

import static com.example.eduhub.TestAuth.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import java.util.Arrays;
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
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
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

  // ---------- 회차 완료 C1~C3, 수료 처리 P1~P5, D-03 연동 (FR-08, D-05) ----------

  /**
   * 신청은 시작 전 회차에만 되므로, 신청을 받은 뒤 회차의 시작 시각을 과거로 바꿔 "시작이 지난 회차"를 만든다. 엔티티에 setter가 없어
   * ReflectionTestUtils를 쓰고, flush해서 DB에 반영한다.
   */
  private void passStartTime() {
    ReflectionTestUtils.setField(session, "startAt", LocalDateTime.now().minusHours(1));
    em.flush();
  }

  private ResultActions complete(Long sessionId) throws Exception {
    return mockMvc.perform(post("/api/v1/admin/sessions/" + sessionId + "/complete").with(admin()));
  }

  private ResultActions record(Long sessionId, String body) throws Exception {
    return mockMvc.perform(
        post("/api/v1/admin/sessions/" + sessionId + "/completions")
            .contentType(MediaType.APPLICATION_JSON)
            .content(body)
            .with(admin()));
  }

  private static String body(String result, Long... employeeIds) {
    return "{\"result\":\"" + result + "\",\"employeeIds\":" + Arrays.toString(employeeIds) + "}";
  }

  private String statusOf(Long enrollmentId) {
    em.flush();
    em.clear();
    return em.find(Enrollment.class, enrollmentId).getStatus().name();
  }

  @Test
  void c1_completeBeforeStartIsConflict() throws Exception {
    complete(session.getId())
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("SESSION_NOT_STARTED"));
  }

  @Test
  void c2_completeAfterStartCancelsWaitingAndKeepsConfirmed() throws Exception {
    passStartTime();

    complete(session.getId())
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(session.getId()))
        .andExpect(jsonPath("$.status").value("COMPLETED"));

    assertThat(statusOf(leeEnrollment.getId())).isEqualTo("CANCELLED");
    assertThat(statusOf(parkEnrollment.getId())).isEqualTo("CANCELLED");
    assertThat(statusOf(kimEnrollment.getId())).isEqualTo("CONFIRMED");
    mockMvc
        .perform(get("/api/v1/admin/sessions/" + session.getId() + "/roster").with(admin()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sessionStatus").value("COMPLETED"))
        .andExpect(jsonPath("$.confirmed", hasSize(1)))
        .andExpect(jsonPath("$.waiting", hasSize(0)));
  }

  @Test
  void c3_completeTwiceIsConflict() throws Exception {
    passStartTime();
    complete(session.getId()).andExpect(status().isOk());

    complete(session.getId())
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("SESSION_ALREADY_COMPLETED"));
  }

  @Test
  void completeUnknownSessionIsNotFound() throws Exception {
    complete(-1L)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("SESSION_NOT_FOUND"));
  }

  @Test
  void p1_recordBeforeSessionCompletedIsConflictAndChangesNothing() throws Exception {
    passStartTime();

    record(session.getId(), body("COMPLETED", kim.getId()))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("SESSION_NOT_COMPLETED"));

    assertThat(statusOf(kimEnrollment.getId())).isEqualTo("CONFIRMED");
  }

  @Test
  void p2_recordProcessesConfirmedOnlyAndReportsFailuresIgnoringDuplicates() throws Exception {
    passStartTime();
    complete(session.getId()).andExpect(status().isOk());
    long ghostId = NEXT_ID.incrementAndGet();

    record(session.getId(), body("COMPLETED", kim.getId(), choi.getId(), ghostId, kim.getId()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.processed", hasSize(1)))
        .andExpect(jsonPath("$.processed[0]").value(kim.getId()))
        .andExpect(jsonPath("$.failed", hasSize(2)))
        .andExpect(jsonPath("$.failed[0].employeeId").value(choi.getId()))
        .andExpect(jsonPath("$.failed[0].code").value("CANCELLED"))
        .andExpect(jsonPath("$.failed[0].reason").isNotEmpty())
        .andExpect(jsonPath("$.failed[1].employeeId").value(ghostId))
        .andExpect(jsonPath("$.failed[1].code").value("NOT_ENROLLED"));

    assertThat(statusOf(kimEnrollment.getId())).isEqualTo("COMPLETED");
    mockMvc
        .perform(get("/api/v1/admin/sessions/" + session.getId() + "/roster").with(admin()))
        .andExpect(jsonPath("$.confirmed", hasSize(1)))
        .andExpect(jsonPath("$.confirmed[0].status").value("COMPLETED"));
  }

  @Test
  void p3_recordSameEmployeeAgainIsAlreadyRecorded() throws Exception {
    passStartTime();
    complete(session.getId()).andExpect(status().isOk());
    record(session.getId(), body("COMPLETED", kim.getId())).andExpect(status().isOk());

    record(session.getId(), body("NOT_COMPLETED", kim.getId()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.processed", hasSize(0)))
        .andExpect(jsonPath("$.failed[0].employeeId").value(kim.getId()))
        .andExpect(jsonPath("$.failed[0].code").value("ALREADY_RECORDED"));

    assertThat(statusOf(kimEnrollment.getId())).isEqualTo("COMPLETED");
  }

  @Test
  void p4_notCompletedShowsInRosterAndMyEnrollments() throws Exception {
    passStartTime();
    complete(session.getId()).andExpect(status().isOk());

    record(session.getId(), body("NOT_COMPLETED", kim.getId()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.processed[0]").value(kim.getId()));

    mockMvc
        .perform(get("/api/v1/admin/sessions/" + session.getId() + "/roster").with(admin()))
        .andExpect(jsonPath("$.confirmed[0].status").value("NOT_COMPLETED"));
    mockMvc
        .perform(get("/api/v1/me/enrollments").with(as(kim.getId(), "EMPLOYEE")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(1)))
        .andExpect(jsonPath("$[0].status").value("NOT_COMPLETED"));
  }

  @Test
  void p5_invalidRequestIsBadRequest() throws Exception {
    record(session.getId(), "{\"result\":\"COMPLETED\",\"employeeIds\":[]}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    record(session.getId(), "{\"employeeIds\":[1]}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    record(session.getId(), "{\"result\":\"COMPLETED\",\"employeeIds\":[1,null]}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    record(session.getId(), "{\"result\":\"PASSED\",\"employeeIds\":[1]}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  void p5_tooManyEmployeeIdsIsBadRequest() throws Exception {
    Long[] ids = new Long[201];
    for (int i = 0; i < ids.length; i++) {
      ids[i] = (long) i + 1;
    }
    record(session.getId(), body("COMPLETED", ids))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  void employeeTokenCannotCompleteOrRecord() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/admin/sessions/" + session.getId() + "/complete")
                .with(as(kim.getId(), "EMPLOYEE")))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    mockMvc
        .perform(
            post("/api/v1/admin/sessions/" + session.getId() + "/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("COMPLETED", kim.getId()))
                .with(as(kim.getId(), "EMPLOYEE")))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  /** D-03 통합: 수료한 사원은 같은 과정의 다른 회차에 다시 신청할 수 없다. */
  @Test
  void completedEmployeeCannotReapplyToOtherSessionOfSameCourse() throws Exception {
    CourseSession other = otherFutureSession();
    passStartTime();
    complete(session.getId()).andExpect(status().isOk());
    record(session.getId(), body("COMPLETED", kim.getId())).andExpect(status().isOk());

    applyAs(kim, other)
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("ALREADY_COMPLETED_COURSE"));
  }

  /** D-03 통합: 미수료 사원은 다시 신청할 수 있다. */
  @Test
  void notCompletedEmployeeCanReapplyToOtherSessionOfSameCourse() throws Exception {
    CourseSession other = otherFutureSession();
    passStartTime();
    complete(session.getId()).andExpect(status().isOk());
    record(session.getId(), body("NOT_COMPLETED", kim.getId())).andExpect(status().isOk());

    applyAs(kim, other).andExpect(status().isCreated());
  }

  /** 같은 회차에서 취소 후 재신청한 사원은 CANCELLED 행이 있어도 확정 행이 처리된다 (CONFIRMED 우선). */
  @Test
  void recordPrefersConfirmedOverCancelledForReappliedEmployee() throws Exception {
    CourseSession roomy =
        courseSessionRepository.save(
            CourseSession.create(course, LocalDateTime.now().plusDays(10), "D실", 5));
    Employee han = employee("한", 20);
    EnrollmentResponse first = enrollmentService.apply(han.getId(), roomy.getId());
    enrollmentService.cancel(han.getId(), first.getId());
    EnrollmentResponse second = enrollmentService.apply(han.getId(), roomy.getId());
    assertThat(second.getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);

    ReflectionTestUtils.setField(roomy, "startAt", LocalDateTime.now().minusHours(1));
    em.flush();
    complete(roomy.getId()).andExpect(status().isOk());

    record(roomy.getId(), body("COMPLETED", han.getId()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.processed", hasSize(1)))
        .andExpect(jsonPath("$.processed[0]").value(han.getId()))
        .andExpect(jsonPath("$.failed", hasSize(0)));

    assertThat(statusOf(second.getId())).isEqualTo("COMPLETED");
    assertThat(statusOf(first.getId())).isEqualTo("CANCELLED");
  }

  private CourseSession otherFutureSession() {
    return courseSessionRepository.save(
        CourseSession.create(course, LocalDateTime.now().plusDays(9), "C실", 5));
  }

  private ResultActions applyAs(Employee employee, CourseSession target) throws Exception {
    return mockMvc.perform(
        post("/api/v1/enrollments")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"sessionId\":" + target.getId() + "}")
            .with(as(employee.getId(), "EMPLOYEE")));
  }

  private static org.springframework.test.web.servlet.request.RequestPostProcessor admin() {
    return as(1L, "ADMIN");
  }
}
