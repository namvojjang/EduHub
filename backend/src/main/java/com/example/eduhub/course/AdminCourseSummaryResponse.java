package com.example.eduhub.course;

import lombok.Value;

/** 관리자 과정 목록의 한 줄 (FR-03). 종료된 과정도 보이므로 상태를 함께 준다. */
@Value
public class AdminCourseSummaryResponse {
  Long id;
  String title;
  String category;
  CourseStatus status;

  public static AdminCourseSummaryResponse from(Course course) {
    return new AdminCourseSummaryResponse(
        course.getId(), course.getTitle(), course.getCategory(), course.getStatus());
  }
}
