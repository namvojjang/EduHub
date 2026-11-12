package com.example.eduhub.course;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.example.eduhub.common.error.ConflictException;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** 관리자 서비스 단위 테스트 (FR-03, NFR-05). 리포지토리는 mock, 상태 규칙은 실제 엔티티로 확인한다. */
@ExtendWith(MockitoExtension.class)
class CourseAdminServiceTest {

  private static final LocalDateTime START = LocalDateTime.of(2030, 1, 6, 9, 0);

  @Mock private CourseRepository courseRepository;

  @Mock private CourseSessionRepository courseSessionRepository;

  @InjectMocks private CourseAdminService service;

  @Test
  void createCourseSavesOpenCourse() {
    given(courseRepository.save(any(Course.class))).willAnswer(inv -> inv.getArgument(0));

    CourseDetailResponse response = service.createCourse(new CourseRequest("Java 기초", "개발", "입문"));

    assertThat(response.getTitle()).isEqualTo("Java 기초");
    assertThat(response.getStatus()).isEqualTo(CourseStatus.OPEN);
    assertThat(response.getSessions()).isEmpty();
  }

  @Test
  void updateCourseChangesFields() {
    Course course = Course.create("옛 제목", "개발", null);
    given(courseRepository.findById(1L)).willReturn(Optional.of(course));
    given(courseSessionRepository.findByCourseIdOrderByStartAtAsc(any()))
        .willReturn(Collections.emptyList());

    CourseDetailResponse response =
        service.updateCourse(1L, new CourseRequest("새 제목", "데이터", "설명"));

    assertThat(response.getTitle()).isEqualTo("새 제목");
    assertThat(response.getCategory()).isEqualTo("데이터");
    assertThat(response.getDescription()).isEqualTo("설명");
  }

  @Test
  void updateMissingCourseThrowsNotFound() {
    given(courseRepository.findById(9L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> service.updateCourse(9L, new CourseRequest("t", "c", null)))
        .isInstanceOf(CourseNotFoundException.class);
  }

  @Test
  void closeCourseTwiceIsConflict() {
    Course course = Course.create("Java 기초", "개발", null);
    given(courseRepository.findById(1L)).willReturn(Optional.of(course));

    service.closeCourse(1L);

    assertThat(course.getStatus()).isEqualTo(CourseStatus.CLOSED);
    assertThatThrownBy(() -> service.closeCourse(1L))
        .isInstanceOf(ConflictException.class)
        .extracting("code")
        .isEqualTo("COURSE_ALREADY_CLOSED");
  }

  @Test
  void createSessionOnOpenCourse() {
    Course course = Course.create("Java 기초", "개발", null);
    given(courseRepository.findById(1L)).willReturn(Optional.of(course));
    given(courseSessionRepository.save(any(CourseSession.class)))
        .willAnswer(inv -> inv.getArgument(0));

    SessionResponse response = service.createSession(1L, new SessionRequest(START, "본사 3층", 20));

    assertThat(response.getStartAt()).isEqualTo(START);
    assertThat(response.getCapacity()).isEqualTo(20);
    assertThat(response.getStatus()).isEqualTo(CourseSessionStatus.RECRUITING);
  }

  @Test
  void createSessionOnClosedCourseIsConflict() {
    Course course = Course.create("Java 기초", "개발", null);
    course.close();
    given(courseRepository.findById(1L)).willReturn(Optional.of(course));

    assertThatThrownBy(() -> service.createSession(1L, new SessionRequest(START, "본사", 10)))
        .isInstanceOf(ConflictException.class)
        .extracting("code")
        .isEqualTo("COURSE_CLOSED");
    verify(courseSessionRepository, never()).save(any());
  }

  @Test
  void updateSessionChangesFields() {
    CourseSession session = CourseSession.create(Course.create("A", "개발", null), START, "본사", 10);
    given(courseSessionRepository.findById(5L)).willReturn(Optional.of(session));

    SessionResponse response =
        service.updateSession(5L, new SessionRequest(START.plusDays(1), "별관", 30));

    assertThat(response.getStartAt()).isEqualTo(START.plusDays(1));
    assertThat(response.getPlace()).isEqualTo("별관");
    assertThat(response.getCapacity()).isEqualTo(30);
  }

  @Test
  void closedSessionCannotBeUpdatedOrClosedAgain() {
    CourseSession session = CourseSession.create(Course.create("A", "개발", null), START, "본사", 10);
    given(courseSessionRepository.findById(5L)).willReturn(Optional.of(session));

    SessionResponse closed = service.closeSession(5L);

    assertThat(closed.getStatus()).isEqualTo(CourseSessionStatus.CLOSED);
    assertThatThrownBy(() -> service.updateSession(5L, new SessionRequest(START, "본사", 10)))
        .isInstanceOf(ConflictException.class);
    assertThatThrownBy(() -> service.closeSession(5L)).isInstanceOf(ConflictException.class);
  }

  @Test
  void missingSessionThrowsNotFound() {
    given(courseSessionRepository.findById(5L)).willReturn(Optional.empty());

    assertThatThrownBy(() -> service.closeSession(5L))
        .isInstanceOf(CourseSessionNotFoundException.class);
  }
}
