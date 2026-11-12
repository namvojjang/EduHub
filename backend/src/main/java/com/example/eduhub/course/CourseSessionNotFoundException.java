package com.example.eduhub.course;

import com.example.eduhub.common.error.NotFoundException;

public class CourseSessionNotFoundException extends NotFoundException {

  public CourseSessionNotFoundException(Long sessionId) {
    super("SESSION_NOT_FOUND", "회차를 찾을 수 없습니다: " + sessionId);
  }
}
