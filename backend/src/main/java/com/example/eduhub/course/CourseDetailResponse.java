package com.example.eduhub.course;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.Value;

/** 과정 상세와 회차 목록 (FR-02). */
@Value
public class CourseDetailResponse {
  Long id;
  String title;
  String category;
  String description;
  CourseStatus status;
  List<SessionResponse> sessions;

  /** occupied: 회차 ID별 차지한 자리 수. Map에 없는 회차는 0. */
  public static CourseDetailResponse of(
      Course course, List<CourseSession> sessions, Map<Long, Long> occupied) {
    return new CourseDetailResponse(
        course.getId(),
        course.getTitle(),
        course.getCategory(),
        course.getDescription(),
        course.getStatus(),
        sessions.stream()
            .map(s -> SessionResponse.from(s, occupied.getOrDefault(s.getId(), 0L)))
            .collect(Collectors.toList()));
  }
}
