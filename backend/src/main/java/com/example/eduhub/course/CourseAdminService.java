package com.example.eduhub.course;

import com.example.eduhub.common.web.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 관리자의 과정·회차 등록·수정·종료 (FR-03).
 *
 * <p>상태 규칙(종료된 과정에 회차 추가 금지 등)은 엔티티 메서드가 확인한다. 서비스는 조회·저장과 응답 변환만 맡는다.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class CourseAdminService {

  private final CourseRepository courseRepository;
  private final CourseSessionRepository courseSessionRepository;

  @Transactional(readOnly = true)
  public PageResponse<AdminCourseSummaryResponse> search(
      String keyword, String category, Pageable pageable) {
    return PageResponse.from(
        courseRepository
            .findAll(CourseSpecifications.managed(keyword, category), pageable)
            .map(AdminCourseSummaryResponse::from));
  }

  public CourseDetailResponse createCourse(CourseRequest request) {
    Course course =
        courseRepository.save(
            Course.create(request.getTitle(), request.getCategory(), request.getDescription()));
    return toDetail(course);
  }

  public CourseDetailResponse updateCourse(Long courseId, CourseRequest request) {
    Course course = findCourse(courseId);
    course.update(request.getTitle(), request.getCategory(), request.getDescription());
    return toDetail(course);
  }

  public CourseDetailResponse closeCourse(Long courseId) {
    Course course = findCourse(courseId);
    course.close();
    return toDetail(course);
  }

  public SessionResponse createSession(Long courseId, SessionRequest request) {
    Course course = findCourse(courseId);
    CourseSession session =
        courseSessionRepository.save(
            course.openSession(request.getStartAt(), request.getPlace(), request.getCapacity()));
    return SessionResponse.from(session);
  }

  public SessionResponse updateSession(Long sessionId, SessionRequest request) {
    CourseSession session = findSession(sessionId);
    session.update(request.getStartAt(), request.getPlace(), request.getCapacity());
    return SessionResponse.from(session);
  }

  public SessionResponse closeSession(Long sessionId) {
    CourseSession session = findSession(sessionId);
    session.close();
    return SessionResponse.from(session);
  }

  private Course findCourse(Long courseId) {
    return courseRepository
        .findById(courseId)
        .orElseThrow(() -> new CourseNotFoundException(courseId));
  }

  private CourseSession findSession(Long sessionId) {
    return courseSessionRepository
        .findById(sessionId)
        .orElseThrow(() -> new CourseSessionNotFoundException(sessionId));
  }

  private CourseDetailResponse toDetail(Course course) {
    return CourseDetailResponse.of(
        course, courseSessionRepository.findByCourseIdOrderByStartAtAsc(course.getId()));
  }
}
