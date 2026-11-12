package com.example.eduhub.enrollment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.eduhub.common.error.ConflictException;
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
