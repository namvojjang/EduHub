package com.example.eduhub.course;

import com.example.eduhub.common.error.NotFoundException;

public class CourseNotFoundException extends NotFoundException {

  public CourseNotFoundException(Long courseId) {
    super("COURSE_NOT_FOUND", "과정을 찾을 수 없습니다: " + courseId);
  }
}
