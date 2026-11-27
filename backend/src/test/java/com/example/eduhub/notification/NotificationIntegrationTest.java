package com.example.eduhub.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;

import com.example.eduhub.course.Course;
import com.example.eduhub.course.CourseRepository;
import com.example.eduhub.course.CourseSession;
import com.example.eduhub.course.CourseSessionRepository;
import com.example.eduhub.enrollment.EnrollmentResponse;
import com.example.eduhub.enrollment.EnrollmentService;
import com.example.eduhub.enrollment.EnrollmentStatus;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 알림 기록 통합 테스트 N1~N5 (FR-09). 실제 커밋·롤백을 확인하려고 @Transactional을 달지 않는다. 로컬 DB를 공유하므로 매 테스트가 새 과정·회차와
 * 겹치지 않는 직원 ID를 만들고, 그 ID로만 조회한다. 데이터는 지우지 않는다.
 */
@SpringBootTest
@ActiveProfiles("test")
class NotificationIntegrationTest {

  private static final AtomicLong EMPLOYEE_IDS = new AtomicLong(System.nanoTime());

  @Autowired private EnrollmentService enrollmentService;
  @Autowired private CourseRepository courseRepository;
  @Autowired private CourseSessionRepository courseSessionRepository;
  @Autowired private PlatformTransactionManager transactionManager;
  @Autowired private JdbcTemplate jdbcTemplate;
  @SpyBean private NotificationRepository notificationRepository;

  @AfterEach
  void resetSpy() {
    reset(notificationRepository);
  }

  @Test
  void applyWithSeatMakesOneConfirmedNotification() {
    CourseSession session = newSession(2);
    Long employeeId = newEmployeeId();

    EnrollmentResponse response = enrollmentService.apply(employeeId, session.getId());

    List<Map<String, Object>> rows = notificationsOf(employeeId);
    assertThat(rows).hasSize(1);
    assertThat(rows.get(0).get("type")).isEqualTo("ENROLLMENT_CONFIRMED");
    assertThat(((Number) rows.get(0).get("enrollment_id")).longValue()).isEqualTo(response.getId());
    assertThat((String) rows.get(0).get("message")).endsWith("수강 신청이 확정되었습니다.");
  }

  @Test
  void applyWhenFullMakesNoNotification() {
    CourseSession session = newSession(1);
    enrollmentService.apply(newEmployeeId(), session.getId());
    Long waitingEmployee = newEmployeeId();

    EnrollmentResponse response = enrollmentService.apply(waitingEmployee, session.getId());

    assertThat(response.getStatus()).isEqualTo(EnrollmentStatus.WAITING);
    assertThat(notificationsOf(waitingEmployee)).isEmpty();
  }

  @Test
  void cancelPromotesFirstWaitingAndNotifiesOnlyPromoted() {
    CourseSession session = newSession(1);
    Long confirmedEmployee = newEmployeeId();
    Long firstWaiting = newEmployeeId();
    Long secondWaiting = newEmployeeId();
    EnrollmentResponse confirmed = enrollmentService.apply(confirmedEmployee, session.getId());
    EnrollmentResponse waiting = enrollmentService.apply(firstWaiting, session.getId());
    enrollmentService.apply(secondWaiting, session.getId());

    enrollmentService.cancel(confirmedEmployee, confirmed.getId());

    List<Map<String, Object>> promoted = notificationsOf(firstWaiting);
    assertThat(promoted).hasSize(1);
    assertThat(promoted.get(0).get("type")).isEqualTo("ENROLLMENT_PROMOTED");
    assertThat(((Number) promoted.get(0).get("enrollment_id")).longValue())
        .isEqualTo(waiting.getId());
    assertThat((String) promoted.get(0).get("message")).endsWith("대기에서 확정되었습니다.");
    // 취소한 사원은 신청 확정 알림 1건뿐이고 취소로 늘지 않는다. 다음 대기자는 0건.
    assertThat(notificationsOf(confirmedEmployee)).hasSize(1);
    assertThat(notificationsOf(secondWaiting)).isEmpty();
  }

  /** N4: 실제 롤백을 만든다. 커밋되지 않았으므로 신청도 알림도 없어야 한다. */
  @Test
  void rolledBackApplyLeavesNoEnrollmentAndNoNotification() {
    CourseSession session = newSession(2);
    Long employeeId = newEmployeeId();

    new TransactionTemplate(transactionManager)
        .execute(
            status -> {
              enrollmentService.apply(employeeId, session.getId());
              status.setRollbackOnly();
              return null;
            });

    Long enrollments =
        jdbcTemplate.queryForObject(
            "select count(*) from enrollment where employee_id = ?", Long.class, employeeId);
    assertThat(enrollments).isEqualTo(0L);
    assertThat(notificationsOf(employeeId)).isEmpty();
  }

  /** N5: 알림 저장이 실패하면 같은 트랜잭션이므로 신청도 함께 롤백된다. */
  @Test
  void notificationSaveFailureRollsBackApply() {
    doThrow(new DataAccessResourceFailureException("simulated"))
        .when(notificationRepository)
        .save(any(Notification.class));
    CourseSession session = newSession(2);
    Long employeeId = newEmployeeId();

    assertThatThrownBy(() -> enrollmentService.apply(employeeId, session.getId()))
        .isInstanceOf(DataAccessResourceFailureException.class);

    Long enrollments =
        jdbcTemplate.queryForObject(
            "select count(*) from enrollment where employee_id = ?", Long.class, employeeId);
    assertThat(enrollments).isEqualTo(0L);
    assertThat(notificationsOf(employeeId)).isEmpty();
  }

  // ---------- 도우미 ----------

  private Long newEmployeeId() {
    return EMPLOYEE_IDS.incrementAndGet();
  }

  private CourseSession newSession(int capacity) {
    Course course =
        courseRepository.save(
            Course.create("알림 테스트 과정 " + UUID.randomUUID(), "TEST", "알림 통합 테스트용"));
    return courseSessionRepository.save(
        CourseSession.create(course, LocalDateTime.now().plusDays(1), "테스트실", capacity));
  }

  private List<Map<String, Object>> notificationsOf(Long employeeId) {
    return jdbcTemplate.queryForList(
        "select type, enrollment_id, message from notification where employee_id = ?"
            + " order by id",
        employeeId);
  }
}
