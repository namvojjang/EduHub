package com.example.eduhub.course;

import java.util.List;
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

  public static CourseDetailResponse of(Course course, List<CourseSession> sessions) {
    return new CourseDetailResponse(
        course.getId(),
        course.getTitle(),
        course.getCategory(),
        course.getDescription(),
        course.getStatus(),
        sessions.stream().map(SessionResponse::from).collect(Collectors.toList()));
  }
}
