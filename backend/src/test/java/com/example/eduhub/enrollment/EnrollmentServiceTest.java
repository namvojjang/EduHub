package com.example.eduhub.enrollment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.eduhub.common.error.ConflictException;
import com.example.eduhub.common.error.NotFoundException;
import com.example.eduhub.course.Course;
import com.example.eduhub.course.CourseSession;
import com.example.eduhub.course.CourseSessionNotFoundException;
import com.example.eduhub.course.CourseSessionRepository;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Optional;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class EnrollmentServiceTest {

  private static final Long EMPLOYEE_ID = 7L;
  private static final Long SESSION_ID = 10L;
  private static final Long COURSE_ID = 3L;

  @Mock private CourseSessionRepository courseSessionRepository;
  @Mock private EnrollmentRepository enrollmentRepository;
  @InjectMocks private EnrollmentService service;

  private CourseSession session;

  @BeforeEach
  void setUp() {
    Course course = Course.create("테스트 과정", "개발", "설명");
    ReflectionTestUtils.setField(course, "id", COURSE_ID);
    session = CourseSession.create(course, LocalDateTime.now().plusDays(1), "강의실", 2);
    ReflectionTestUtils.setField(session, "id", SESSION_ID);
  }

  @Test
  void applyWithSeatLeftIsConfirmed() {
    givenSessionLocked();
    when(enrollmentRepository.countBySessionIdAndStatus(SESSION_ID, EnrollmentStatus.CONFIRMED))
        .thenReturn(1L);
    when(enrollmentRepository.countBySessionIdAndStatus(SESSION_ID, EnrollmentStatus.WAITING))
        .thenReturn(0L);
    givenSaveReturnsArgument();

    EnrollmentResponse response = service.apply(EMPLOYEE_ID, SESSION_ID);

    assertThat(response.getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
    assertThat(response.getSessionId()).isEqualTo(SESSION_ID);
    assertThat(response.getConfirmedAt()).isNotNull();
    assertSavedFor(EnrollmentStatus.CONFIRMED);
  }

  @Test
  void applyWhenFullIsWaiting() {
    givenSessionLocked();
    when(enrollmentRepository.countBySessionIdAndStatus(SESSION_ID, EnrollmentStatus.CONFIRMED))
        .thenReturn(2L);
    when(enrollmentRepository.countBySessionIdAndStatus(SESSION_ID, EnrollmentStatus.WAITING))
        .thenReturn(0L);
    givenSaveReturnsArgument();

    EnrollmentResponse response = service.apply(EMPLOYEE_ID, SESSION_ID);

    assertThat(response.getStatus()).isEqualTo(EnrollmentStatus.WAITING);
    assertThat(response.getConfirmedAt()).isNull();
    assertSavedFor(EnrollmentStatus.WAITING);
  }

  @Test
  void applyWhenSeatLeftButWaitingExistsIsWaiting() {
    givenSessionLocked();
    when(enrollmentRepository.countBySessionIdAndStatus(SESSION_ID, EnrollmentStatus.CONFIRMED))
        .thenReturn(1L);
    when(enrollmentRepository.countBySessionIdAndStatus(SESSION_ID, EnrollmentStatus.WAITING))
        .thenReturn(3L);
    givenSaveReturnsArgument();

    EnrollmentResponse response = service.apply(EMPLOYEE_ID, SESSION_ID);

    assertThat(response.getStatus()).isEqualTo(EnrollmentStatus.WAITING);
    assertThat(response.getConfirmedAt()).isNull();
    assertSavedFor(EnrollmentStatus.WAITING);
  }

  @Test
  void applyToMissingSessionIsNotFound() {
    when(courseSessionRepository.findByIdForUpdate(SESSION_ID)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.apply(EMPLOYEE_ID, SESSION_ID))
        .isInstanceOf(CourseSessionNotFoundException.class);
    verify(enrollmentRepository, never()).saveAndFlush(any());
  }

  @Test
  void applyToClosedSessionIsConflict() {
    session.close();
    givenSessionLocked();

    assertThatThrownBy(() -> service.apply(EMPLOYEE_ID, SESSION_ID))
        .isInstanceOf(ConflictException.class)
        .satisfies(
            e -> assertThat(((ConflictException) e).getCode()).isEqualTo("SESSION_NOT_RECRUITING"));
    verify(enrollmentRepository, never())
        .existsByCourseIdAndEmployeeIdAndStatusIn(any(), any(), any());
    verify(enrollmentRepository, never()).countBySessionIdAndStatus(any(), any());
    verify(enrollmentRepository, never()).saveAndFlush(any());
  }

  @Test
  void applyWithActiveEnrollmentInSameCourseIsDuplicate() {
    givenSessionLocked();
    when(enrollmentRepository.existsByCourseIdAndEmployeeIdAndStatusIn(
            eq(COURSE_ID),
            eq(EMPLOYEE_ID),
            eq(Arrays.asList(EnrollmentStatus.CONFIRMED, EnrollmentStatus.WAITING))))
        .thenReturn(true);

    assertThatThrownBy(() -> service.apply(EMPLOYEE_ID, SESSION_ID))
        .isInstanceOf(DuplicateEnrollmentException.class)
        .satisfies(
            e -> assertThat(((ConflictException) e).getCode()).isEqualTo("DUPLICATE_ENROLLMENT"));
    verify(enrollmentRepository, never()).saveAndFlush(any());
  }

  @Test
  void translatesConstraintNameIgnoringCaseToDuplicate() {
    givenSessionLocked();
    when(enrollmentRepository.countBySessionIdAndStatus(anyLong(), any())).thenReturn(0L);
    ConstraintViolationException cause =
        new ConstraintViolationException(
            "violation", new SQLException("x"), "UX_ENROLLMENT_COURSE_EMPLOYEE_ACTIVE");
    when(enrollmentRepository.saveAndFlush(any(Enrollment.class)))
        .thenThrow(new DataIntegrityViolationException("could not execute", cause));

    assertThatThrownBy(() -> service.apply(EMPLOYEE_ID, SESSION_ID))
        .isInstanceOf(DuplicateEnrollmentException.class)
        .satisfies(
            e -> assertThat(((ConflictException) e).getCode()).isEqualTo("DUPLICATE_ENROLLMENT"));
  }

  @Test
  void translatesIndexNameInSqlMessageToDuplicateWhenConstraintNameIsNull() {
    givenSessionLocked();
    when(enrollmentRepository.countBySessionIdAndStatus(anyLong(), any())).thenReturn(0L);
    SQLException root =
        new SQLException(
            "ERROR: duplicate key value violates unique constraint"
                + " \"ux_enrollment_course_employee_active\"");
    ConstraintViolationException cause = new ConstraintViolationException("violation", root, null);
    when(enrollmentRepository.saveAndFlush(any(Enrollment.class)))
        .thenThrow(new DataIntegrityViolationException("could not execute", cause));

    assertThatThrownBy(() -> service.apply(EMPLOYEE_ID, SESSION_ID))
        .isInstanceOf(DuplicateEnrollmentException.class)
        .satisfies(
            e -> assertThat(((ConflictException) e).getCode()).isEqualTo("DUPLICATE_ENROLLMENT"));
  }

  @Test
  void rethrowsSameExceptionWhenOtherConstraintIsViolated() {
    givenSessionLocked();
    when(enrollmentRepository.countBySessionIdAndStatus(anyLong(), any())).thenReturn(0L);
    ConstraintViolationException cause =
        new ConstraintViolationException(
            "violation", new SQLException("fk violation"), "fk_enrollment_session");
    DataIntegrityViolationException thrown =
        new DataIntegrityViolationException("could not execute", cause);
    when(enrollmentRepository.saveAndFlush(any(Enrollment.class))).thenThrow(thrown);

    assertThatThrownBy(() -> service.apply(EMPLOYEE_ID, SESSION_ID)).isSameAs(thrown);
  }

  @Test
  void waitingApplyReturnsWaitingNumber() {
    givenSessionLocked();
    when(enrollmentRepository.countBySessionIdAndStatus(SESSION_ID, EnrollmentStatus.CONFIRMED))
        .thenReturn(2L);
    when(enrollmentRepository.countBySessionIdAndStatus(SESSION_ID, EnrollmentStatus.WAITING))
        .thenReturn(2L);
    when(enrollmentRepository.saveAndFlush(any(Enrollment.class)))
        .thenAnswer(
            inv -> {
              Enrollment e = inv.getArgument(0);
              ReflectionTestUtils.setField(e, "id", 100L);
              return e;
            });
    when(enrollmentRepository.countAhead(
            eq(SESSION_ID), eq(EnrollmentStatus.WAITING), any(LocalDateTime.class), eq(100L)))
        .thenReturn(2L);

    EnrollmentResponse response = service.apply(EMPLOYEE_ID, SESSION_ID);

    assertThat(response.getStatus()).isEqualTo(EnrollmentStatus.WAITING);
    assertThat(response.getWaitingNumber()).isEqualTo(3);
    assertThat(response.isPromoted()).isFalse();
  }

  @Test
  void confirmedApplyHasNoWaitingNumber() {
    givenSessionLocked();
    when(enrollmentRepository.countBySessionIdAndStatus(anyLong(), any())).thenReturn(0L);
    givenSaveReturnsArgument();

    EnrollmentResponse response = service.apply(EMPLOYEE_ID, SESSION_ID);

    assertThat(response.getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
    assertThat(response.getWaitingNumber()).isNull();
    verify(enrollmentRepository, never()).countAhead(any(), any(), any(), any());
  }

  @Test
  void getOwnWaitingEnrollmentReturnsWaitingNumber() {
    Enrollment waiting = enrollment(100L, EMPLOYEE_ID, EnrollmentStatus.WAITING);
    when(enrollmentRepository.findById(100L)).thenReturn(Optional.of(waiting));
    when(enrollmentRepository.countAhead(
            eq(SESSION_ID), eq(EnrollmentStatus.WAITING), eq(waiting.getAppliedAt()), eq(100L)))
        .thenReturn(4L);

    EnrollmentResponse response = service.get(EMPLOYEE_ID, 100L);

    assertThat(response.getWaitingNumber()).isEqualTo(5);
  }

  @Test
  void getOthersEnrollmentIsNotFound() {
    Enrollment others = enrollment(100L, 99L, EnrollmentStatus.WAITING);
    when(enrollmentRepository.findById(100L)).thenReturn(Optional.of(others));

    assertThatThrownBy(() -> service.get(EMPLOYEE_ID, 100L))
        .isInstanceOf(EnrollmentNotFoundException.class);
    verify(enrollmentRepository, never()).countAhead(any(), any(), any(), any());
  }

  @Test
  void getMissingEnrollmentIsNotFound() {
    when(enrollmentRepository.findById(100L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.get(EMPLOYEE_ID, 100L))
        .isInstanceOf(EnrollmentNotFoundException.class)
        .satisfies(
            e -> assertThat(((NotFoundException) e).getCode()).isEqualTo("ENROLLMENT_NOT_FOUND"));
  }

  @Test
  void cancelConfirmedPromotesFirstWaiting() {
    Enrollment confirmed = enrollment(100L, EMPLOYEE_ID, EnrollmentStatus.CONFIRMED);
    Enrollment first = enrollment(101L, 8L, EnrollmentStatus.WAITING);
    givenCancelTarget(confirmed);
    givenFirstWaiting(first);
    givenConfirmedCounts(1L, 2L);

    EnrollmentResponse response = service.cancel(EMPLOYEE_ID, 100L);

    assertThat(response.getStatus()).isEqualTo(EnrollmentStatus.CANCELLED);
    assertThat(response.getWaitingNumber()).isNull();
    assertThat(confirmed.getStatus()).isEqualTo(EnrollmentStatus.CANCELLED);
    assertThat(first.getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
    assertThat(first.isPromoted()).isTrue();
    assertThat(first.getConfirmedAt()).isNotNull();
  }

  @Test
  void cancelConfirmedWithoutWaitingPromotesNobody() {
    Enrollment confirmed = enrollment(100L, EMPLOYEE_ID, EnrollmentStatus.CONFIRMED);
    givenCancelTarget(confirmed);
    when(enrollmentRepository.findFirstBySessionIdAndStatusOrderByAppliedAtAscIdAsc(
            SESSION_ID, EnrollmentStatus.WAITING))
        .thenReturn(Optional.empty());

    EnrollmentResponse response = service.cancel(EMPLOYEE_ID, 100L);

    assertThat(response.getStatus()).isEqualTo(EnrollmentStatus.CANCELLED);
    verify(enrollmentRepository)
        .findFirstBySessionIdAndStatusOrderByAppliedAtAscIdAsc(
            SESSION_ID, EnrollmentStatus.WAITING);
  }

  @Test
  void cancelWaitingDoesNotLookUpPromotion() {
    Enrollment waiting = enrollment(100L, EMPLOYEE_ID, EnrollmentStatus.WAITING);
    givenCancelTarget(waiting);

    EnrollmentResponse response = service.cancel(EMPLOYEE_ID, 100L);

    assertThat(response.getStatus()).isEqualTo(EnrollmentStatus.CANCELLED);
    verify(enrollmentRepository, never())
        .findFirstBySessionIdAndStatusOrderByAppliedAtAscIdAsc(any(), any());
  }

  @Test
  void cancelMissingEnrollmentIsNotFound() {
    when(enrollmentRepository.findSessionIdByIdAndEmployeeId(100L, EMPLOYEE_ID))
        .thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.cancel(EMPLOYEE_ID, 100L))
        .isInstanceOf(EnrollmentNotFoundException.class);
    verify(courseSessionRepository, never()).findByIdForUpdate(any());
  }

  @Test
  void cancelOthersEnrollmentIsNotFoundWithoutLockingSession() {
    // 남의 신청이면 1단계 쿼리가 비어 있다. 회차 락도, 신청 엔티티 조회도 하지 않는다.
    when(enrollmentRepository.findSessionIdByIdAndEmployeeId(100L, EMPLOYEE_ID))
        .thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.cancel(EMPLOYEE_ID, 100L))
        .isInstanceOf(EnrollmentNotFoundException.class)
        .satisfies(
            e -> assertThat(((NotFoundException) e).getCode()).isEqualTo("ENROLLMENT_NOT_FOUND"));
    verify(courseSessionRepository, never()).findByIdForUpdate(any());
    verify(enrollmentRepository, never()).findById(any());
  }

  @Test
  void cancelRechecksOwnerAfterLockAsDefense() {
    // 1단계는 통과했지만 락 뒤에 읽은 신청이 남의 것인 경우(일어나지 않아야 하는 방어 경로).
    Enrollment others = enrollment(100L, 99L, EnrollmentStatus.CONFIRMED);
    givenCancelTarget(others);

    assertThatThrownBy(() -> service.cancel(EMPLOYEE_ID, 100L))
        .isInstanceOf(EnrollmentNotFoundException.class);
    assertThat(others.getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
    verify(enrollmentRepository, never())
        .findFirstBySessionIdAndStatusOrderByAppliedAtAscIdAsc(any(), any());
  }

  @Test
  void cancelAfterSessionStartIsConflict() {
    Enrollment confirmed = enrollment(100L, EMPLOYEE_ID, EnrollmentStatus.CONFIRMED);
    ReflectionTestUtils.setField(session, "startAt", LocalDateTime.now().minusMinutes(1));
    givenCancelTarget(confirmed);

    assertThatThrownBy(() -> service.cancel(EMPLOYEE_ID, 100L))
        .isInstanceOf(ConflictException.class)
        .satisfies(
            e ->
                assertThat(((ConflictException) e).getCode()).isEqualTo("SESSION_ALREADY_STARTED"));
    assertThat(confirmed.getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
  }

  @Test
  void cancelCancelledEnrollmentIsConflict() {
    Enrollment cancelled = enrollment(100L, EMPLOYEE_ID, EnrollmentStatus.CANCELLED);
    givenCancelTarget(cancelled);

    assertThatThrownBy(() -> service.cancel(EMPLOYEE_ID, 100L))
        .isInstanceOf(ConflictException.class)
        .satisfies(
            e ->
                assertThat(((ConflictException) e).getCode())
                    .isEqualTo("ENROLLMENT_NOT_CANCELLABLE"));
    verify(enrollmentRepository, never())
        .findFirstBySessionIdAndStatusOrderByAppliedAtAscIdAsc(any(), any());
  }

  @Test
  void cancelLocksSessionBeforeReadingEnrollment() {
    Enrollment confirmed = enrollment(100L, EMPLOYEE_ID, EnrollmentStatus.CONFIRMED);
    givenCancelTarget(confirmed);
    givenFirstWaiting(enrollment(101L, 8L, EnrollmentStatus.WAITING));
    givenConfirmedCounts(1L, 2L);

    service.cancel(EMPLOYEE_ID, 100L);

    InOrder inOrder = inOrder(enrollmentRepository, courseSessionRepository);
    inOrder.verify(enrollmentRepository).findSessionIdByIdAndEmployeeId(100L, EMPLOYEE_ID);
    inOrder.verify(courseSessionRepository).findByIdForUpdate(SESSION_ID);
    inOrder.verify(enrollmentRepository).findById(100L);
  }

  @Test
  void cancelWhenOverCapacityDoesNotPromote() {
    ReflectionTestUtils.setField(session, "capacity", 3);
    Enrollment confirmed = enrollment(100L, EMPLOYEE_ID, EnrollmentStatus.CONFIRMED);
    Enrollment first = enrollment(101L, 8L, EnrollmentStatus.WAITING);
    givenCancelTarget(confirmed);
    givenLenientFirstWaiting(first);
    when(enrollmentRepository.countBySessionIdAndStatus(SESSION_ID, EnrollmentStatus.CONFIRMED))
        .thenReturn(4L);

    service.cancel(EMPLOYEE_ID, 100L);

    assertThat(confirmed.getStatus()).isEqualTo(EnrollmentStatus.CANCELLED);
    assertThat(first.getStatus()).isEqualTo(EnrollmentStatus.WAITING);
    verify(enrollmentRepository, never())
        .findFirstBySessionIdAndStatusOrderByAppliedAtAscIdAsc(any(), any());
  }

  @Test
  void cancelWhenConfirmedEqualsCapacityAfterCancelDoesNotPromote() {
    ReflectionTestUtils.setField(session, "capacity", 4);
    Enrollment confirmed = enrollment(100L, EMPLOYEE_ID, EnrollmentStatus.CONFIRMED);
    Enrollment first = enrollment(101L, 8L, EnrollmentStatus.WAITING);
    givenCancelTarget(confirmed);
    givenLenientFirstWaiting(first);
    when(enrollmentRepository.countBySessionIdAndStatus(SESSION_ID, EnrollmentStatus.CONFIRMED))
        .thenReturn(4L);

    service.cancel(EMPLOYEE_ID, 100L);

    assertThat(first.getStatus()).isEqualTo(EnrollmentStatus.WAITING);
    verify(enrollmentRepository, never())
        .findFirstBySessionIdAndStatusOrderByAppliedAtAscIdAsc(any(), any());
  }

  @Test
  void cancelAtFullCapacityPromotesOne() {
    ReflectionTestUtils.setField(session, "capacity", 5);
    Enrollment confirmed = enrollment(100L, EMPLOYEE_ID, EnrollmentStatus.CONFIRMED);
    Enrollment first = enrollment(101L, 8L, EnrollmentStatus.WAITING);
    givenCancelTarget(confirmed);
    givenFirstWaiting(first);
    givenConfirmedCounts(4L, 5L);

    service.cancel(EMPLOYEE_ID, 100L);

    assertThat(first.getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
    assertThat(first.isPromoted()).isTrue();
  }

  @Test
  void cancelPromotesAllWaitingWhileSeatsRemain() {
    ReflectionTestUtils.setField(session, "capacity", 4);
    Enrollment confirmed = enrollment(100L, EMPLOYEE_ID, EnrollmentStatus.CONFIRMED);
    Enrollment first = enrollment(101L, 8L, EnrollmentStatus.WAITING);
    Enrollment second = enrollment(102L, 9L, EnrollmentStatus.WAITING);
    Enrollment third = enrollment(103L, 10L, EnrollmentStatus.WAITING);
    givenCancelTarget(confirmed);
    // 취소 후 확정 2명: 승급할 때마다 확정 수가 2, 3, 4로 늘어난다.
    givenConfirmedCounts(2L, 3L, 4L);
    when(enrollmentRepository.findFirstBySessionIdAndStatusOrderByAppliedAtAscIdAsc(
            SESSION_ID, EnrollmentStatus.WAITING))
        .thenReturn(Optional.of(first), Optional.of(second), Optional.of(third));

    service.cancel(EMPLOYEE_ID, 100L);

    assertThat(first.getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
    assertThat(second.getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
    assertThat(third.getStatus()).isEqualTo(EnrollmentStatus.WAITING);
    // 루프마다 flush: 승급 2회 + 종료 확인 1회
    verify(enrollmentRepository, times(3)).flush();
  }

  @Test
  void promoteWaitingWhileSeatsAvailableReturnsPromotedCount() {
    ReflectionTestUtils.setField(session, "capacity", 4);
    Enrollment first = enrollment(101L, 8L, EnrollmentStatus.WAITING);
    Enrollment second = enrollment(102L, 9L, EnrollmentStatus.WAITING);
    Enrollment third = enrollment(103L, 10L, EnrollmentStatus.WAITING);
    givenConfirmedCounts(2L, 3L, 4L);
    when(enrollmentRepository.findFirstBySessionIdAndStatusOrderByAppliedAtAscIdAsc(
            SESSION_ID, EnrollmentStatus.WAITING))
        .thenReturn(Optional.of(first), Optional.of(second), Optional.of(third));

    int promoted = service.promoteWaitingWhileSeatsAvailable(session, LocalDateTime.now());

    assertThat(promoted).isEqualTo(2);
    assertThat(third.getStatus()).isEqualTo(EnrollmentStatus.WAITING);
  }

  @Test
  void promoteWaitingWhileSeatsAvailableFlushesBeforeCounting() {
    when(enrollmentRepository.countBySessionIdAndStatus(SESSION_ID, EnrollmentStatus.CONFIRMED))
        .thenReturn(2L);

    int promoted = service.promoteWaitingWhileSeatsAvailable(session, LocalDateTime.now());

    assertThat(promoted).isZero();
    InOrder inOrder = inOrder(enrollmentRepository);
    inOrder.verify(enrollmentRepository).flush();
    inOrder
        .verify(enrollmentRepository)
        .countBySessionIdAndStatus(SESSION_ID, EnrollmentStatus.CONFIRMED);
  }

  @Test
  void cancelOthersEnrollmentOnStartedSessionIsNotFound() {
    Enrollment others = enrollment(100L, 99L, EnrollmentStatus.CONFIRMED);
    ReflectionTestUtils.setField(session, "startAt", LocalDateTime.now().minusMinutes(1));
    givenCancelTarget(others);

    assertThatThrownBy(() -> service.cancel(EMPLOYEE_ID, 100L))
        .isInstanceOf(EnrollmentNotFoundException.class);
    assertThat(others.getStatus()).isEqualTo(EnrollmentStatus.CONFIRMED);
  }

  /** 대기 상태는 팩터리로, 그 밖의 상태는 팩터리와 상태 메서드로 만든다. id는 리플렉션으로 넣는다. */
  private Enrollment enrollment(Long id, Long employeeId, EnrollmentStatus status) {
    LocalDateTime now = LocalDateTime.now();
    Enrollment e;
    if (status == EnrollmentStatus.WAITING) {
      e = Enrollment.waiting(session, employeeId, now);
    } else {
      e = Enrollment.confirm(session, employeeId, now);
      if (status == EnrollmentStatus.CANCELLED) {
        e.cancel();
      }
    }
    ReflectionTestUtils.setField(e, "id", id);
    return e;
  }

  private void givenCancelTarget(Enrollment target) {
    when(enrollmentRepository.findSessionIdByIdAndEmployeeId(target.getId(), EMPLOYEE_ID))
        .thenReturn(Optional.of(SESSION_ID));
    givenSessionLocked();
    when(enrollmentRepository.findById(target.getId())).thenReturn(Optional.of(target));
  }

  /** 확정 수 조회가 호출마다 차례로 이 값들을 반환한다. 마지막 값은 이후 호출에도 반복된다. */
  private void givenConfirmedCounts(Long first, Long... rest) {
    when(enrollmentRepository.countBySessionIdAndStatus(SESSION_ID, EnrollmentStatus.CONFIRMED))
        .thenReturn(first, rest);
  }

  private void givenFirstWaiting(Enrollment first) {
    when(enrollmentRepository.findFirstBySessionIdAndStatusOrderByAppliedAtAscIdAsc(
            SESSION_ID, EnrollmentStatus.WAITING))
        .thenReturn(Optional.of(first));
  }

  /** 호출되지 않아야 하는 조회를 스텁한다. 호출되면 승급이 일어나 단언이 실패한다. */
  private void givenLenientFirstWaiting(Enrollment first) {
    lenient()
        .when(
            enrollmentRepository.findFirstBySessionIdAndStatusOrderByAppliedAtAscIdAsc(
                SESSION_ID, EnrollmentStatus.WAITING))
        .thenReturn(Optional.of(first));
  }

  private void assertSavedFor(EnrollmentStatus expectedStatus) {
    ArgumentCaptor<Enrollment> captor = ArgumentCaptor.forClass(Enrollment.class);
    verify(enrollmentRepository, times(1)).saveAndFlush(captor.capture());
    Enrollment saved = captor.getValue();
    assertThat(saved.getCourseId()).isEqualTo(COURSE_ID);
    assertThat(saved.getEmployeeId()).isEqualTo(EMPLOYEE_ID);
    assertThat(saved.getStatus()).isEqualTo(expectedStatus);
  }

  private void givenSessionLocked() {
    when(courseSessionRepository.findByIdForUpdate(SESSION_ID)).thenReturn(Optional.of(session));
  }

  private void givenSaveReturnsArgument() {
    when(enrollmentRepository.saveAndFlush(any(Enrollment.class)))
        .thenAnswer(inv -> inv.getArgument(0));
  }
}
