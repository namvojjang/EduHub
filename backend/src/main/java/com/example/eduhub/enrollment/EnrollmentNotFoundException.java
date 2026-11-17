package com.example.eduhub.enrollment;

import com.example.eduhub.common.error.NotFoundException;

/** 신청이 없거나 다른 직원의 신청 (FR-05, FR-06, NFR-03). 존재 여부를 드러내지 않으려고 둘을 구별하지 않는다. */
public class EnrollmentNotFoundException extends NotFoundException {

  public EnrollmentNotFoundException(Long enrollmentId) {
    super("ENROLLMENT_NOT_FOUND", "신청을 찾을 수 없습니다: " + enrollmentId);
  }
}
