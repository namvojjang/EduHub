package com.example.eduhub.enrollment;

import com.example.eduhub.common.error.ConflictException;

/** 같은 과정에 이미 유효 신청(확정·대기)이 있음 (D-03). */
public class DuplicateEnrollmentException extends ConflictException {

  public DuplicateEnrollmentException(String message) {
    super("DUPLICATE_ENROLLMENT", message);
  }
}
