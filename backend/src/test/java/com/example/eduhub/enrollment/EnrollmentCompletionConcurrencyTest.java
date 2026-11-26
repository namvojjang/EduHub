package com.example.eduhub.enrollment;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.eduhub.common.error.ConflictException;
import com.example.eduhub.course.Course;
import com.example.eduhub.course.CourseRepository;
import com.example.eduhub.course.CourseSession;
import com.example.eduhub.course.CourseSessionRepository;
import com.example.eduhub.course.SessionResponse;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.mockito.AdditionalAnswers;
import org.mockito.Mockito;
import org.mockito.invocation.InvocationOnMock;
import org.mockito.stubbing.Answer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.AopTestUtils;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * 회차 완료·수료 처리 동시성 테스트 K1 (FR-08, D-05, CLAUDE.md 6).
 *
 * <p>각 스레드가 실제로 커밋해야 하므로 @Transactional을 달지 않는다. 테스트가 만든 과정·회차·신청은 끝에 지운다.
 */
@SpringBootTest
@ActiveProfiles("test")
class EnrollmentCompletionConcurrencyTest {

  private static final AtomicLong EMPLOYEE_IDS = new AtomicLong(System.nanoTime());

  @Autowired private EnrollmentRepository enrollmentRepository;

  @Autowired private EnrollmentService enrollmentService;
  @Autowired private EnrollmentAdminService enrollmentAdminService;
  @Autowired private CourseRepository courseRepository;
  @Autowired private CourseSessionRepository courseSessionRepository;
  @Autowired private JdbcTemplate jdbcTemplate;

  /** 두 관리자가 같은 사원을 동시에 수료 처리해도 한 번만 처리되고 다른 쪽은 ALREADY_RECORDED다. */
  @Test
  void sameEmployeeRecordedConcurrentlyIsProcessedOnce() throws Exception {
    Course course = newCourse();
    try {
      StartedSession started = startedSession(course, 1);
      CourseSession session = started.session;
      final Long employeeId = started.confirmedEmployeeId;
      enrollmentAdminService.completeSession(session.getId());
      slowDownEnrollmentLookup();
      final Long sessionId = session.getId();

      List<Callable<CompletionResponse>> tasks = new ArrayList<Callable<CompletionResponse>>();
      for (int i = 0; i < 2; i++) {
        tasks.add(
            new Callable<CompletionResponse>() {
              @Override
              public CompletionResponse call() {
                return enrollmentAdminService.recordCompletions(
                    sessionId,
                    CompletionOutcome.COMPLETED,
                    java.util.Collections.singletonList(employeeId));
              }
            });
      }
      List<Future<CompletionResponse>> results = runConcurrently(tasks);

      int processedCount = 0;
      int alreadyRecorded = 0;
      for (Future<CompletionResponse> f : results) {
        CompletionResponse response = f.get();
        processedCount += response.getProcessed().size();
        for (CompletionFailure failure : response.getFailed()) {
          if ("ALREADY_RECORDED".equals(failure.getCode())) {
            alreadyRecorded++;
          }
        }
      }
      assertThat(processedCount).as("처리된 사원 수 합계").isEqualTo(1);
      assertThat(alreadyRecorded).as("ALREADY_RECORDED 수").isEqualTo(1);
      assertThat(
              jdbcTemplate.queryForObject(
                  "select status from enrollment where session_id = ? and employee_id = ?",
                  String.class,
                  sessionId,
                  employeeId))
          .isEqualTo("COMPLETED");
    } finally {
      restoreEnrollmentLookup();
      cleanUp(course);
    }
  }

  /** 회차 완료를 동시에 두 번 요청하면 하나만 성공하고 다른 쪽은 409다. */
  @Test
  void completeSessionConcurrentlySucceedsOnce() throws Exception {
    Course course = newCourse();
    try {
      StartedSession started = startedSession(course, 3);
      CourseSession session = started.session;
      final Long sessionId = session.getId();

      List<Callable<SessionResponse>> tasks = new ArrayList<Callable<SessionResponse>>();
      for (int i = 0; i < 2; i++) {
        tasks.add(
            new Callable<SessionResponse>() {
              @Override
              public SessionResponse call() {
                return enrollmentAdminService.completeSession(sessionId);
              }
            });
      }
      List<Future<SessionResponse>> results = runConcurrently(tasks);

      int success = 0;
      int conflict = 0;
      for (Future<SessionResponse> f : results) {
        try {
          f.get();
          success++;
        } catch (ExecutionException e) {
          assertThat(e.getCause()).isInstanceOf(ConflictException.class);
          assertThat(((ConflictException) e.getCause()).getCode())
              .isEqualTo("SESSION_ALREADY_COMPLETED");
          conflict++;
        }
      }
      assertThat(success).as("성공").isEqualTo(1);
      assertThat(conflict).as("409").isEqualTo(1);
      assertThat(
              jdbcTemplate.queryForObject(
                  "select status from course_session where id = ?", String.class, sessionId))
          .isEqualTo("COMPLETED");
      // D-01: 대기 2건은 취소되고, 확정 1건은 그대로이며, 승급은 일어나지 않는다.
      assertThat(countRows("session_id = ? and status = 'CANCELLED'", sessionId))
          .as("취소된 대기")
          .isEqualTo(2);
      assertThat(countRows("session_id = ? and status = 'CONFIRMED'", sessionId))
          .as("그대로인 확정")
          .isEqualTo(1);
      assertThat(
              countRows(
                  "session_id = ? and employee_id = ? and status = 'CONFIRMED'",
                  sessionId,
                  started.confirmedEmployeeId))
          .as("원래 확정자가 그대로")
          .isEqualTo(1);
      assertThat(countRows("session_id = ? and promoted = true", sessionId))
          .as("승급된 행")
          .isEqualTo(0);
    } finally {
      cleanUp(course);
    }
  }

  // ---------- 도우미 ----------

  /**
   * 락이 없을 때 두 요청이 확실히 겹치도록, 테스트에서만 서비스의 신청 조회(findBySessionIdAndEmployeeIdIn) 직후 300ms 멈춘다. 운영 코드에는
   * 훅이 없다. 서비스 대상 객체의 리포지토리 필드를 진짜 리포지토리에 위임하는 mock으로 잠시 바꾸고, 끝나면 restoreEnrollmentLookup()으로 되돌린다.
   * 락이 있으면 한 요청은 락에서 기다리므로 결과가 달라지지 않는다.
   */
  private void slowDownEnrollmentLookup() {
    final Answer<Object> real = AdditionalAnswers.delegatesTo(enrollmentRepository);
    EnrollmentRepository slow =
        Mockito.mock(
            EnrollmentRepository.class,
            new Answer<Object>() {
              @Override
              public Object answer(InvocationOnMock invocation) throws Throwable {
                Object result = real.answer(invocation);
                if ("findBySessionIdAndEmployeeIdIn".equals(invocation.getMethod().getName())) {
                  Thread.sleep(300);
                }
                return result;
              }
            });
    ReflectionTestUtils.setField(
        AopTestUtils.<Object>getUltimateTargetObject(enrollmentAdminService),
        "enrollmentRepository",
        slow);
  }

  private void restoreEnrollmentLookup() {
    ReflectionTestUtils.setField(
        AopTestUtils.<Object>getUltimateTargetObject(enrollmentAdminService),
        "enrollmentRepository",
        enrollmentRepository);
  }

  private Course newCourse() {
    return courseRepository.save(
        Course.create("수료 동시성 테스트 과정 " + System.nanoTime(), "TEST", "동시성 테스트용"));
  }

  private static class StartedSession {
    final CourseSession session;
    final Long confirmedEmployeeId;

    StartedSession(CourseSession session, Long confirmedEmployeeId) {
      this.session = session;
      this.confirmedEmployeeId = confirmedEmployeeId;
    }
  }

  /**
   * 정원 1 회차에 첫 신청자 1명이 확정, 나머지 count-1명이 대기. 신청은 시작 전 회차에만 되므로 신청을 마친 뒤 DB에서 시작 시각을 과거로 바꾼다. 확정된 사원
   * ID를 함께 돌려준다.
   */
  private StartedSession startedSession(Course course, int count) {
    CourseSession session =
        courseSessionRepository.save(
            CourseSession.create(course, LocalDateTime.now().plusDays(1), "테스트실", 1));
    Long confirmedEmployeeId = null;
    for (int i = 0; i < count; i++) {
      Long employeeId = EMPLOYEE_IDS.incrementAndGet();
      if (i == 0) {
        confirmedEmployeeId = employeeId;
      }
      enrollmentService.apply(employeeId, session.getId());
    }
    jdbcTemplate.update(
        "update course_session set start_at = ? where id = ?",
        java.sql.Timestamp.valueOf(LocalDateTime.now().minusHours(1)),
        session.getId());
    return new StartedSession(session, confirmedEmployeeId);
  }

  private long countRows(String where, Object... args) {
    Long count =
        jdbcTemplate.queryForObject(
            "select count(*) from enrollment where " + where, Long.class, args);
    return count == null ? 0 : count;
  }

  private void cleanUp(Course course) {
    jdbcTemplate.update(
        "delete from enrollment where session_id in"
            + " (select id from course_session where course_id = ?)",
        course.getId());
    jdbcTemplate.update("delete from course_session where course_id = ?", course.getId());
    jdbcTemplate.update("delete from course where id = ?", course.getId());
  }

  /** 모든 작업을 같은 순간에 출발시킨다. */
  private <T> List<Future<T>> runConcurrently(List<Callable<T>> tasks) throws Exception {
    int n = tasks.size();
    final CountDownLatch ready = new CountDownLatch(n);
    final CountDownLatch start = new CountDownLatch(1);
    ExecutorService executor = Executors.newFixedThreadPool(n);
    try {
      List<Future<T>> futures = new ArrayList<Future<T>>();
      for (final Callable<T> task : tasks) {
        futures.add(
            executor.submit(
                new Callable<T>() {
                  @Override
                  public T call() throws Exception {
                    ready.countDown();
                    start.await();
                    return task.call();
                  }
                }));
      }
      assertThat(ready.await(60, TimeUnit.SECONDS)).as("모든 스레드 준비").isTrue();
      start.countDown();
      for (Future<T> f : futures) {
        try {
          f.get(60, TimeUnit.SECONDS);
        } catch (ExecutionException ignored) {
          // 예외는 호출한 테스트가 각 Future에서 다시 확인한다.
        }
      }
      return futures;
    } finally {
      start.countDown();
      executor.shutdownNow();
    }
  }
}
