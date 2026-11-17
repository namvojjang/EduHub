package com.example.eduhub.course;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.eduhub.common.error.ConflictException;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

class CourseSessionTest {

  private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 12, 10, 0);

  @Test
  void recruitingSessionBeforeStartIsOpenForEnrollment() {
    CourseSession session = newSession(NOW.plusDays(1));

    assertThatCode(() -> session.requireOpenForEnrollment(NOW)).doesNotThrowAnyException();
  }

  @Test
  void closedSessionIsNotOpenForEnrollment() {
    CourseSession session = newSession(NOW.plusDays(1));
    session.close();

    assertThatThrownBy(() -> session.requireOpenForEnrollment(NOW))
        .isInstanceOf(ConflictException.class)
        .hasMessage("모집 중인 회차가 아닙니다.")
        .satisfies(
            e -> assertThat(((ConflictException) e).getCode()).isEqualTo("SESSION_NOT_RECRUITING"));
  }

  @Test
  void startedSessionIsNotOpenForEnrollment() {
    CourseSession session = newSession(NOW);

    assertThatThrownBy(() -> session.requireOpenForEnrollment(NOW))
        .isInstanceOf(ConflictException.class)
        .hasMessage("이미 시작된 회차입니다.")
        .satisfies(
            e -> assertThat(((ConflictException) e).getCode()).isEqualTo("SESSION_NOT_RECRUITING"));
  }

  @Test
  void sessionBeforeStartIsNotStarted() {
    CourseSession session = newSession(NOW.plusDays(1));

    assertThatCode(() -> session.requireNotStarted(NOW)).doesNotThrowAnyException();
  }

  @Test
  void closedSessionBeforeStartIsNotStarted() {
    CourseSession session = newSession(NOW.plusDays(1));
    session.close();

    assertThatCode(() -> session.requireNotStarted(NOW)).doesNotThrowAnyException();
  }

  @Test
  void sessionAtStartTimeIsAlreadyStarted() {
    CourseSession session = newSession(NOW);

    assertThatThrownBy(() -> session.requireNotStarted(NOW))
        .isInstanceOf(ConflictException.class)
        .satisfies(
            e ->
                assertThat(((ConflictException) e).getCode()).isEqualTo("SESSION_ALREADY_STARTED"));
  }

  @Test
  void sessionAfterStartIsAlreadyStarted() {
    CourseSession session = newSession(NOW);

    assertThatThrownBy(() -> session.requireNotStarted(NOW.plusMinutes(1)))
        .isInstanceOf(ConflictException.class)
        .satisfies(
            e ->
                assertThat(((ConflictException) e).getCode()).isEqualTo("SESSION_ALREADY_STARTED"));
  }

  private CourseSession newSession(LocalDateTime startAt) {
    Course course = Course.create("테스트 과정", "개발", "설명");
    return CourseSession.create(course, startAt, "강의실", 10);
  }
}
