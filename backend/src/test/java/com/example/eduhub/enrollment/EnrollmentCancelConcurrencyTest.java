package com.example.eduhub.enrollment;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.eduhub.common.error.ConflictException;
import com.example.eduhub.course.Course;
import com.example.eduhub.course.CourseAdminService;
import com.example.eduhub.course.CourseRepository;
import com.example.eduhub.course.CourseSession;
import com.example.eduhub.course.CourseSessionRepository;
import com.example.eduhub.course.SessionRequest;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * 취소·승급 동시성 테스트 (NFR-01, FR-05, FR-06, D-02, D-04).
 *
 * <p>각 스레드가 실제로 커밋해야 하므로 @Transactional을 달지 않는다. 데이터는 지우지 않고, 테스트마다 새 과정·회차와 겹치지 않는 직원 ID를 쓴다.
 */
@SpringBootTest
@ActiveProfiles("test")
class EnrollmentCancelConcurrencyTest {

  private static final AtomicLong EMPLOYEE_IDS = new AtomicLong(System.nanoTime());

  @Autowired private EnrollmentService enrollmentService;
  @Autowired private EnrollmentRepository enrollmentRepository;
  @Autowired private CourseRepository courseRepository;
  @Autowired private CourseSessionRepository courseSessionRepository;
  @Autowired private CourseAdminService courseAdminService;
  @Autowired private JdbcTemplate jdbcTemplate;

  /** 시나리오 1: 확정 취소 5건과 새 신청 20건이 겹친다. */
  @Test
  void confirmedCancelsAndNewAppliesKeepCapacityAndOrder() throws Exception {
    CourseSession session = newSession(newCourse(), 5);
    List<Applicant> confirmed = applySequentially(session, 5);
    List<Applicant> waiting = applySequentially(session, 20);

    List<Callable<Object>> tasks = new ArrayList<Callable<Object>>();
    for (Applicant a : confirmed) {
      tasks.add(cancelTask(a));
    }
    for (int i = 0; i < 20; i++) {
      tasks.add(applyTask(EMPLOYEE_IDS.incrementAndGet(), session.getId()));
    }

    Outcome outcome = runConcurrently(tasks);

    String message = state(session) + ", " + outcome.describe();
    assertThat(outcome.failures).as(message).isEmpty();
    assertThat(confirmedCount(session)).as(message).isEqualTo(5);
    assertThat(waitingCount(session)).as(message).isEqualTo(35);
    assertThat(promotedConfirmedIds(session))
        .as("승급된 확정자는 원래 대기 1~5순위, " + message)
        .isEqualTo(enrollmentIds(waiting.subList(0, 5)));
    assertWaitingNumbersAre1ToN(session, message);
    assertThat(notificationCount(session, "ENROLLMENT_PROMOTED"))
        .as("승급 알림 수 = 승급 수, " + message)
        .isEqualTo(promotedCount(session));
  }

  /** 시나리오 2: 같은 확정 신청을 10번 동시 취소해도 승급은 한 번이다. 락 전에 엔티티를 읽으면 이 테스트가 실패해야 한다. */
  @Test
  void sameEnrollmentCancelledTenTimesPromotesOnce() throws Exception {
    CourseSession session = newSession(newCourse(), 1);
    Applicant target = applySequentially(session, 1).get(0);
    List<Applicant> waiting = applySequentially(session, 3);

    List<Callable<Object>> tasks = new ArrayList<Callable<Object>>();
    for (int i = 0; i < 10; i++) {
      tasks.add(cancelTask(target));
    }

    Outcome outcome = runConcurrently(tasks);

    String message = state(session) + ", " + outcome.describe();
    assertThat(outcome.success.get()).as(message).isEqualTo(1);
    assertThat(outcome.conflictCount("ENROLLMENT_NOT_CANCELLABLE")).as(message).isEqualTo(9);
    assertThat(outcome.failures).as(message).hasSize(9);
    assertThat(confirmedCount(session)).as(message).isEqualTo(1);
    assertThat(waitingCount(session)).as(message).isEqualTo(2);
    assertThat(promotedConfirmedIds(session))
        .as("승급된 사람은 원래 대기 1순위, " + message)
        .isEqualTo(enrollmentIds(waiting.subList(0, 1)));
    assertWaitingNumbersAre1ToN(session, message);
    assertThat(notificationCount(session, "ENROLLMENT_PROMOTED"))
        .as("승급 알림 수 = 승급 수, " + message)
        .isEqualTo(promotedCount(session));
  }

  /** 시나리오 3: 확정자 10명이 동시에 취소하면 대기자 10명이 각각 한 번씩 승급한다. */
  @Test
  void manyConfirmedCancelsPromoteEachWaitingOnce() throws Exception {
    CourseSession session = newSession(newCourse(), 10);
    List<Applicant> confirmed = applySequentially(session, 10);
    List<Applicant> waiting = applySequentially(session, 15);

    List<Callable<Object>> tasks = new ArrayList<Callable<Object>>();
    for (Applicant a : confirmed) {
      tasks.add(cancelTask(a));
    }

    Outcome outcome = runConcurrently(tasks);

    String message = state(session) + ", " + outcome.describe();
    assertThat(outcome.success.get()).as(message).isEqualTo(10);
    assertThat(outcome.failures).as(message).isEmpty();
    assertThat(confirmedCount(session)).as(message).isEqualTo(10);
    assertThat(waitingCount(session)).as(message).isEqualTo(5);
    assertThat(promotedConfirmedIds(session))
        .as("승급된 10명은 원래 대기 앞 10명, " + message)
        .isEqualTo(enrollmentIds(waiting.subList(0, 10)));
    assertWaitingNumbersAre1ToN(session, message);
    assertThat(notificationCount(session, "ENROLLMENT_PROMOTED"))
        .as("승급 알림 수 = 승급 수, " + message)
        .isEqualTo(promotedCount(session));
  }

  /** 시나리오 6: 확정자 취소와 대기 1순위 본인 취소가 겹쳐도 어느 순서든 대기 2순위가 확정된다. 겹칠 확률을 높이려고 20개 회차를 한꺼번에 돌린다. */
  @Test
  void confirmedCancelAndFirstWaitingCancelPromoteSecond() throws Exception {
    Course course = newCourse();
    List<CourseSession> sessions = new ArrayList<CourseSession>();
    List<Applicant> confirmedOnes = new ArrayList<Applicant>();
    List<List<Applicant>> waitingLists = new ArrayList<List<Applicant>>();
    List<Callable<Object>> tasks = new ArrayList<Callable<Object>>();
    for (int i = 0; i < 20; i++) {
      CourseSession session = newSession(course, 1);
      Applicant confirmed = applySequentially(session, 1).get(0);
      List<Applicant> waiting = applySequentially(session, 3);
      sessions.add(session);
      confirmedOnes.add(confirmed);
      waitingLists.add(waiting);
      tasks.add(cancelTask(confirmed));
      tasks.add(cancelTask(waiting.get(0)));
    }

    Outcome outcome = runConcurrently(tasks);

    assertThat(outcome.failures).as(outcome.describe()).isEmpty();
    for (int i = 0; i < 20; i++) {
      CourseSession session = sessions.get(i);
      List<Applicant> waiting = waitingLists.get(i);
      String message = "회차 " + session.getId() + ": " + state(session) + ", " + outcome.describe();
      assertThat(statusOf(waiting.get(0))).as("대기 1순위, " + message).isEqualTo("CANCELLED");
      assertThat(confirmedCount(session)).as(message).isEqualTo(1);
      assertThat(promotedConfirmedIds(session))
          .as("확정자는 원래 대기 2순위, " + message)
          .isEqualTo(enrollmentIds(waiting.subList(1, 2)));
      assertThat(waitingCount(session)).as(message).isEqualTo(1);
      assertThat(statusOf(waiting.get(2))).as("원래 대기 3순위, " + message).isEqualTo("WAITING");
      assertThat(notificationCount(session, "ENROLLMENT_PROMOTED"))
          .as("승급 알림 수 = 승급 수, " + message)
          .isEqualTo(promotedCount(session));
    }
  }

  /** 시나리오 5 (W1): 정원을 확정 인원보다 줄인 뒤 확정을 하나 취소해도 승급하지 않는다. 동시 실행이 아니다. */
  @Test
  void cancelAfterCapacityShrinkDoesNotPromote() {
    CourseSession session = newSession(newCourse(), 5);
    List<Applicant> confirmed = applySequentially(session, 5);
    applySequentially(session, 2);

    courseAdminService.updateSession(
        session.getId(), new SessionRequest(LocalDateTime.now().plusDays(1), "테스트실", 3));
    enrollmentService.cancel(confirmed.get(0).employeeId, confirmed.get(0).enrollmentId);

    String message = state(session);
    assertThat(confirmedCount(session)).as(message).isEqualTo(4);
    assertThat(waitingCount(session)).as(message).isEqualTo(2);
    assertThat(promotedCount(session)).as("승급 수, " + message).isEqualTo(0);
  }

  /** 시나리오 7: 정원을 늘린 뒤 확정을 하나 취소하면 빈자리 3개만큼 대기 앞 3명이 모두 승급한다. 동시 실행이 아니다. */
  @Test
  void cancelAfterCapacityGrowthPromotesAllSeats() {
    CourseSession session = newSession(newCourse(), 2);
    List<Applicant> confirmed = applySequentially(session, 2);
    List<Applicant> waiting = applySequentially(session, 3);

    courseAdminService.updateSession(
        session.getId(), new SessionRequest(LocalDateTime.now().plusDays(1), "테스트실", 4));
    enrollmentService.cancel(confirmed.get(0).employeeId, confirmed.get(0).enrollmentId);

    String message = state(session);
    assertThat(confirmedCount(session)).as(message).isEqualTo(4);
    assertThat(waitingCount(session)).as(message).isEqualTo(0);
    assertThat(promotedConfirmedIds(session))
        .as("승급된 3명은 원래 대기 앞 3명, " + message)
        .isEqualTo(enrollmentIds(waiting.subList(0, 3)));
    assertThat(notificationCount(session, "ENROLLMENT_PROMOTED"))
        .as("승급 알림 수 = 승급 수, " + message)
        .isEqualTo(3);
  }

  // ---------- 도우미 ----------

  /** 회차 신청에 딸린 알림 수 (FR-09). type이 null이면 전체. */
  private long notificationCount(CourseSession session, String type) {
    Long count =
        jdbcTemplate.queryForObject(
            "select count(*) from notification n join enrollment e on e.id = n.enrollment_id"
                + " where e.session_id = ? and (?::text is null or n.type = ?)",
            Long.class,
            session.getId(),
            type,
            type);
    return count == null ? 0 : count;
  }

  private static class Applicant {
    final Long employeeId;
    final Long enrollmentId;

    Applicant(Long employeeId, Long enrollmentId) {
      this.employeeId = employeeId;
      this.enrollmentId = enrollmentId;
    }
  }

  private Course newCourse() {
    return courseRepository.save(
        Course.create("취소 동시성 테스트 과정 " + System.nanoTime(), "TEST", "동시성 테스트용"));
  }

  private CourseSession newSession(Course course, int capacity) {
    return courseSessionRepository.save(
        CourseSession.create(course, LocalDateTime.now().plusDays(1), "테스트실", capacity));
  }

  /** 순서대로 하나씩 신청한다. 반환 순서가 신청 순서(대기 순서)다. */
  private List<Applicant> applySequentially(CourseSession session, int count) {
    List<Applicant> result = new ArrayList<Applicant>();
    for (int i = 0; i < count; i++) {
      Long employeeId = EMPLOYEE_IDS.incrementAndGet();
      EnrollmentResponse response = enrollmentService.apply(employeeId, session.getId());
      result.add(new Applicant(employeeId, response.getId()));
    }
    return result;
  }

  private Set<Long> enrollmentIds(List<Applicant> applicants) {
    Set<Long> ids = new HashSet<Long>();
    for (Applicant a : applicants) {
      ids.add(a.enrollmentId);
    }
    return ids;
  }

  private Callable<Object> applyTask(final Long employeeId, final Long sessionId) {
    return new Callable<Object>() {
      @Override
      public Object call() {
        return enrollmentService.apply(employeeId, sessionId);
      }
    };
  }

  private Callable<Object> cancelTask(final Applicant applicant) {
    return new Callable<Object>() {
      @Override
      public Object call() {
        return enrollmentService.cancel(applicant.employeeId, applicant.enrollmentId);
      }
    };
  }

  private long confirmedCount(CourseSession session) {
    return enrollmentRepository.countBySessionIdAndStatus(
        session.getId(), EnrollmentStatus.CONFIRMED);
  }

  private long waitingCount(CourseSession session) {
    return enrollmentRepository.countBySessionIdAndStatus(
        session.getId(), EnrollmentStatus.WAITING);
  }

  private long promotedCount(CourseSession session) {
    Long count =
        jdbcTemplate.queryForObject(
            "select count(*) from enrollment where session_id = ? and promoted = true",
            Long.class,
            session.getId());
    return count == null ? 0 : count;
  }

  /** 확정이면서 promoted = true인 신청 ID 집합. */
  private Set<Long> promotedConfirmedIds(CourseSession session) {
    List<Long> ids =
        jdbcTemplate.queryForList(
            "select id from enrollment where session_id = ? and promoted = true"
                + " and status = 'CONFIRMED'",
            Long.class,
            session.getId());
    return new HashSet<Long>(ids);
  }

  private String statusOf(Applicant applicant) {
    return jdbcTemplate.queryForObject(
        "select status from enrollment where id = ?", String.class, applicant.enrollmentId);
  }

  private String state(CourseSession session) {
    return "확정="
        + confirmedCount(session)
        + ", 대기="
        + waitingCount(session)
        + ", 승급="
        + promotedCount(session);
  }

  /** 회차의 WAITING 행을 (appliedAt, id) 순으로 읽어, 서비스가 계산한 순번이 정확히 1..n인지 확인한다. */
  private void assertWaitingNumbersAre1ToN(CourseSession session, String message) {
    List<Long> waitingIds =
        jdbcTemplate.queryForList(
            "select id from enrollment where session_id = ? and status = 'WAITING'"
                + " order by applied_at, id",
            Long.class,
            session.getId());
    List<Integer> actual = new ArrayList<Integer>();
    List<Integer> expected = new ArrayList<Integer>();
    for (int i = 0; i < waitingIds.size(); i++) {
      Long id = waitingIds.get(i);
      Long employeeId =
          jdbcTemplate.queryForObject(
              "select employee_id from enrollment where id = ?", Long.class, id);
      actual.add(enrollmentService.get(employeeId, id).getWaitingNumber());
      expected.add(i + 1);
    }
    assertThat(actual).as("대기 순번 1..n, " + message).isEqualTo(expected);
  }

  /** 모든 작업을 같은 순간에 출발시키고 성공 수와 예외를 모은다. */
  private Outcome runConcurrently(List<Callable<Object>> tasks) throws InterruptedException {
    int n = tasks.size();
    final Outcome outcome = new Outcome();
    final CountDownLatch ready = new CountDownLatch(n);
    final CountDownLatch start = new CountDownLatch(1);
    ExecutorService executor = Executors.newFixedThreadPool(n);
    try {
      for (final Callable<Object> task : tasks) {
        executor.submit(
            new Runnable() {
              @Override
              public void run() {
                ready.countDown();
                try {
                  start.await();
                  task.call();
                  outcome.success.incrementAndGet();
                } catch (Throwable t) {
                  outcome.failures.add(t);
                }
              }
            });
      }
      boolean allReady = ready.await(60, TimeUnit.SECONDS);
      start.countDown();
      if (!allReady) {
        executor.shutdownNow();
      }
      assertThat(allReady).as("모든 스레드 준비").isTrue();
    } finally {
      start.countDown();
      executor.shutdown();
    }
    boolean finished = executor.awaitTermination(60, TimeUnit.SECONDS);
    if (!finished) {
      executor.shutdownNow();
    }
    assertThat(finished).as("60초 안에 모든 작업 종료").isTrue();
    return outcome;
  }

  private static class Outcome {
    final java.util.concurrent.atomic.AtomicInteger success =
        new java.util.concurrent.atomic.AtomicInteger();
    final ConcurrentLinkedQueue<Throwable> failures = new ConcurrentLinkedQueue<Throwable>();

    long conflictCount(String code) {
      long count = 0;
      for (Throwable t : failures) {
        if (t instanceof ConflictException && code.equals(((ConflictException) t).getCode())) {
          count++;
        }
      }
      return count;
    }

    String describe() {
      StringBuilder detail = new StringBuilder();
      for (Throwable t : failures) {
        if (detail.length() < 2000) {
          detail.append("\n  - ").append(t);
        }
      }
      return "성공=" + success.get() + ", 실패=" + failures.size() + detail;
    }
  }
}
