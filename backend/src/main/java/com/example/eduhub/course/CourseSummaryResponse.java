package com.example.eduhub.course;

import lombok.Value;

/** 과정 목록의 한 줄 (FR-01). */
@Value
public class CourseSummaryResponse {
  Long id;
  String title;
  String category;

  public static CourseSummaryResponse from(Course course) {
    return new CourseSummaryResponse(course.getId(), course.getTitle(), course.getCategory());
  }
}
