package com.example.eduhub.enrollment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

import com.example.eduhub.course.Course;
import com.example.eduhub.course.CourseRepository;
import com.example.eduhub.course.CourseSession;
import com.example.eduhub.course.CourseSessionRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 수강 신청 동시성 테스트 (NFR-01, D-03).
 *
 * <p>각 스레드가 실제로 커밋해야 하므로 @Transactional을 달지 않는다. 데이터는 지우지 않고, 테스트마다 새 과정·회차와 겹치지 않는 직원 ID를 쓴다.
 */
@SpringBootTest
@ActiveProfiles("test")
class EnrollmentConcurrencyTest {

  /** 실행마다 겹치지 않는 직원 ID (이전 실행 데이터가 남아 있어도 충돌하지 않게). */
  private static final AtomicLong EMPLOYEE_IDS = new AtomicLong(System.nanoTime());

  @Autowired private EnrollmentService enrollmentService;
  @Autowired private EnrollmentRepository enrollmentRepository;
  @Autowired private CourseRepository courseRepository;
  @Autowired private CourseSessionRepository courseSessionRepository;
  @Autowired private PlatformTransactionManager transactionManager;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void hundredApplicantsForOneSeatConfirmExactlyOne() throws Exception {
    CourseSession session = newSession(newCourse(), 1);
    List<Callable<Object>> tasks = new ArrayList<Callable<Object>>();
    for (int i = 0; i < 100; i++) {
      tasks.add(applyTask(EMPLOYEE_IDS.incrementAndGet(), session.getId()));
    }

    Outcome outcome = runConcurrently(tasks);

    assertCounts(session, 1, 99, outcome);
    assertThat(outcome.success.get()).as(outcome.describe()).isEqualTo(100);
    assertThat(outcome.failures).as(outcome.describe()).isEmpty();
  }

  @Test
  void hundredApplicantsForFiveSeatsConfirmExactlyFive() throws Exception {
    CourseSession session = newSession(newCourse(), 5);
    List<Callable<Object>> tasks = new ArrayList<Callable<Object>>();
    for (int i = 0; i < 100; i++) {
      tasks.add(applyTask(EMPLOYEE_IDS.incrementAndGet(), session.getId()));
    }

    Outcome outcome = runConcurrently(tasks);

    assertCounts(session, 5, 95, outcome);
    assertThat(outcome.success.get()).as(outcome.describe()).isEqualTo(100);
    assertThat(outcome.failures).as(outcome.describe()).isEmpty();
  }

  /** 같은 회차 10건 동시 신청. 락 회귀 탐지가 아니라 중복 방지 결과 검증이다(락이 없어도 유일 인덱스 변환으로 통과한다). 락 회귀는 시나리오 1·2가 잡는다. */
  @Test
  void sameEmployeeTenTimesOnSameSessionLeavesOneActive() throws Exception {
    CourseSession session = newSession(newCourse(), 10);
    Long employeeId = EMPLOYEE_IDS.incrementAndGet();
    List<Callable<Object>> tasks = new ArrayList<Callable<Object>>();
    for (int i = 0; i < 10; i++) {
      tasks.add(applyTask(employeeId, session.getId()));
    }

    Outcome outcome = runConcurrently(tasks);

    assertThat(outcome.success.get()).as(outcome.describe()).isEqualTo(1);
    assertThat(outcome.failureCount(DuplicateEnrollmentException.class))
        .as(outcome.describe())
        .isEqualTo(9);
    assertThat(outcome.failures).as(outcome.describe()).hasSize(9);
    assertCounts(session, 1, 0, outcome);
  }

  /**
   * 같은 과정의 서로 다른 회차는 회차 락이 다르므로 사전 확인을 동시에 통과할 수 있다. 이때는 유일 인덱스가 막고, 그 위반이
   * DuplicateEnrollmentException으로 변환되어야 한다. 다른 예외(DataIntegrityViolationException 등)는 실패다.
   *
   * <p>주의: 사전 확인으로 막힌 건과 인덱스 위반 변환으로 막힌 건은 예외 종류가 같아 이 테스트로 구분하지 못한다.
   */
  @Test
  void sameEmployeeOnFiveSessionsOfSameCourseLeavesOneActive() throws Exception {
    Course course = newCourse();
    Long employeeId = EMPLOYEE_IDS.incrementAndGet();
    List<CourseSession> sessions = new ArrayList<CourseSession>();
    List<Callable<Object>> tasks = new ArrayList<Callable<Object>>();
    for (int i = 0; i < 5; i++) {
      CourseSession session = newSession(course, 10);
      sessions.add(session);
      tasks.add(applyTask(employeeId, session.getId()));
    }

    Outcome outcome = runConcurrently(tasks);

    long active = 0;
    StringBuilder perSession = new StringBuilder();
    for (CourseSession session : sessions) {
      long confirmed =
          enrollmentRepository.countBySessionIdAndStatus(
              session.getId(), EnrollmentStatus.CONFIRMED);
      long waiting =
          enrollmentRepository.countBySessionIdAndStatus(session.getId(), EnrollmentStatus.WAITING);
      active += confirmed + waiting;
      perSession.append(" [session ").append(session.getId());
      perSession.append(": 확정 ").append(confirmed).append(", 대기 ").append(waiting).append("]");
    }
    assertThat(outcome.success.get()).as(outcome.describe() + perSession).isEqualTo(1);
    assertThat(outcome.failureCount(DuplicateEnrollmentException.class))
        .as(outcome.describe() + perSession)
        .isEqualTo(4);
    assertThat(outcome.failures).as(outcome.describe() + perSession).hasSize(4);
    assertThat(active).as("유효 신청 수" + perSession).isEqualTo(1);
  }

  /**
   * 다른 세션의 미커밋 신청이 있으면 사전 확인은 통과하고, INSERT가 유일 인덱스에서 대기하다 커밋 후 위반으로 끝나야 한다. T1이 회차 B에 미커밋으로 넣고, T2가
   * 회차 A에 신청한다(같은 회차면 FK 잠금 경로라 의도가 사라진다). T2가 실제로 Lock 대기 중임을 확인한 뒤 T1을 커밋한다.
   */
  @Test
  void uncommittedEnrollmentInOtherSessionIsBlockedByUniqueIndex() throws Exception {
    Course course = newCourse();
    final CourseSession sessionA = newSession(course, 10);
    final CourseSession sessionB = newSession(course, 10);
    final Long employeeId = EMPLOYEE_IDS.incrementAndGet();
    final CountDownLatch inserted = new CountDownLatch(1);
    final CountDownLatch release = new CountDownLatch(1);
    ExecutorService executor = Executors.newFixedThreadPool(2);
    try {
      Future<Object> holder =
          executor.submit(
              new Callable<Object>() {
                @Override
                public Object call() {
                  return new TransactionTemplate(transactionManager)
                      .execute(
                          status -> {
                            enrollmentRepository.saveAndFlush(
                                Enrollment.confirm(sessionB, employeeId, LocalDateTime.now()));
                            inserted.countDown();
                            try {
                              release.await(30, TimeUnit.SECONDS);
                            } catch (InterruptedException e) {
                              Thread.currentThread().interrupt();
                            }
                            return null;
                          });
                }
              });
      assertThat(inserted.await(30, TimeUnit.SECONDS)).as("T1 INSERT 완료").isTrue();

      Future<Object> blocked = executor.submit(applyTask(employeeId, sessionA.getId()));

      boolean waiting = false;
      long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
      while (System.nanoTime() < deadline) {
        Integer count =
            jdbcTemplate.queryForObject(
                "select count(*) from pg_stat_activity where wait_event_type = 'Lock'"
                    + " and datname = current_database()"
                    + " and query ilike '%insert into enrollment%'",
                Integer.class);
        if (count != null && count > 0) {
          waiting = true;
          break;
        }
        if (blocked.isDone()) {
          break;
        }
        Thread.sleep(50);
      }
      assertThat(waiting).as("T2가 enrollment INSERT에서 Lock 대기").isTrue();
      assertThat(blocked.isDone()).as("T1 커밋 전에는 T2가 끝나지 않아야 한다").isFalse();

      release.countDown();
      holder.get(30, TimeUnit.SECONDS);
      try {
        blocked.get(30, TimeUnit.SECONDS);
        fail("T2는 DuplicateEnrollmentException으로 실패해야 한다");
      } catch (ExecutionException e) {
        assertThat(e.getCause()).isInstanceOf(DuplicateEnrollmentException.class);
      }
      assertThat(
              enrollmentRepository.countBySessionIdAndStatus(
                  sessionB.getId(), EnrollmentStatus.CONFIRMED))
          .as("회차 B 확정")
          .isEqualTo(1);
      long activeA =
          enrollmentRepository.countBySessionIdAndStatus(
                  sessionA.getId(), EnrollmentStatus.CONFIRMED)
              + enrollmentRepository.countBySessionIdAndStatus(
                  sessionA.getId(), EnrollmentStatus.WAITING);
      assertThat(activeA).as("회차 A 유효 신청").isEqualTo(0);
    } finally {
      release.countDown();
      executor.shutdownNow();
    }
  }

  /** 동시 신청 시 대기 순번 (FR-05, D-04). 응답 순번은 회차 락 안에서 계산하므로 중복·누락이 없어야 한다. 응답과 DB 기준 순번을 모두 확인한다. */
  @Test
  void hundredApplicantsGetDistinctWaitingNumbers() throws Exception {
    CourseSession session = newSession(newCourse(), 1);
    final ConcurrentLinkedQueue<EnrollmentResponse> responses =
        new ConcurrentLinkedQueue<EnrollmentResponse>();
    List<Callable<Object>> tasks = new ArrayList<Callable<Object>>();
    for (int i = 0; i < 100; i++) {
      final Long employeeId = EMPLOYEE_IDS.incrementAndGet();
      final Long sessionId = session.getId();
      tasks.add(
          new Callable<Object>() {
            @Override
            public Object call() {
              EnrollmentResponse response = enrollmentService.apply(employeeId, sessionId);
              responses.add(response);
              return response;
            }
          });
    }

    Outcome outcome = runConcurrently(tasks);

    long confirmed =
        enrollmentRepository.countBySessionIdAndStatus(session.getId(), EnrollmentStatus.CONFIRMED);
    long waiting =
        enrollmentRepository.countBySessionIdAndStatus(session.getId(), EnrollmentStatus.WAITING);
    String message = "확정=" + confirmed + ", 대기=" + waiting + ", " + outcome.describe();
    assertThat(outcome.failures).as(message).isEmpty();
    assertThat(responses).as(message).hasSize(100);

    int nullCount = 0;
    List<Integer> numbers = new ArrayList<Integer>();
    for (EnrollmentResponse response : responses) {
      if (response.getWaitingNumber() == null) {
        nullCount++;
      } else {
        numbers.add(response.getWaitingNumber());
      }
    }
    Set<Integer> expected = new HashSet<Integer>();
    for (int i = 1; i <= 99; i++) {
      expected.add(i);
    }
    assertThat(nullCount).as("순번 null(확정) 응답 수, " + message).isEqualTo(1);
    assertThat(numbers).as("대기 응답 수, " + message).hasSize(99);
    assertThat(new HashSet<Integer>(numbers)).as("응답 순번 집합, " + message).isEqualTo(expected);

    List<Long> waitingIds =
        jdbcTemplate.queryForList(
            "select id from enrollment where session_id = ? and status = 'WAITING'"
                + " order by applied_at, id",
            Long.class,
            session.getId());
    List<Integer> dbNumbers = new ArrayList<Integer>();
    List<Integer> expectedOrdered = new ArrayList<Integer>();
    for (int i = 0; i < waitingIds.size(); i++) {
      Long id = waitingIds.get(i);
      Long employeeId =
          jdbcTemplate.queryForObject(
              "select employee_id from enrollment where id = ?", Long.class, id);
      dbNumbers.add(enrollmentService.get(employeeId, id).getWaitingNumber());
      expectedOrdered.add(i + 1);
    }
    assertThat(waitingIds).as("DB 대기 행 수, " + message).hasSize(99);
    assertThat(dbNumbers).as("DB 기준 순번 1..99, " + message).isEqualTo(expectedOrdered);
  }

  // ---------- 도우미 ----------

  private Course newCourse() {
    return courseRepository.save(
        Course.create("동시성 테스트 과정 " + System.nanoTime(), "TEST", "동시성 테스트용"));
  }

  private CourseSession newSession(Course course, int capacity) {
    return courseSessionRepository.save(
        CourseSession.create(course, LocalDateTime.now().plusDays(1), "테스트실", capacity));
  }

  private Callable<Object> applyTask(final Long employeeId, final Long sessionId) {
    return new Callable<Object>() {
      @Override
      public Object call() {
        return enrollmentService.apply(employeeId, sessionId);
      }
    };
  }

  private void assertCounts(
      CourseSession session, long expectedConfirmed, long expectedWaiting, Outcome outcome) {
    long confirmed =
        enrollmentRepository.countBySessionIdAndStatus(session.getId(), EnrollmentStatus.CONFIRMED);
    long waiting =
        enrollmentRepository.countBySessionIdAndStatus(session.getId(), EnrollmentStatus.WAITING);
    String message = "확정=" + confirmed + ", 대기=" + waiting + ", " + outcome.describe();
    assertThat(confirmed).as(message).isEqualTo(expectedConfirmed);
    assertThat(waiting).as(message).isEqualTo(expectedWaiting);
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
    final AtomicInteger success = new AtomicInteger();
    final ConcurrentLinkedQueue<Throwable> failures = new ConcurrentLinkedQueue<Throwable>();

    long failureCount(Class<? extends Throwable> type) {
      long count = 0;
      for (Throwable t : failures) {
        if (t.getClass().equals(type)) {
          count++;
        }
      }
      return count;
    }

    String describe() {
      ConcurrentHashMap<String, Integer> byType = new ConcurrentHashMap<String, Integer>();
      StringBuilder detail = new StringBuilder();
      for (Throwable t : failures) {
        String name = t.getClass().getName();
        Integer old = byType.get(name);
        byType.put(name, old == null ? 1 : old + 1);
        if (detail.length() < 2000) {
          detail.append("\n  - ").append(t);
        }
      }
      return "성공=" + success.get() + ", 예외 종류별=" + byType + detail;
    }
  }
}
