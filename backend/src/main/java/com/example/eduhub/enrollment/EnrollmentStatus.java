package com.example.eduhub.enrollment;

/** 신청 상태 (D-04, D-05). 확정·대기만 유효 신청이다. 대기 순번은 저장하지 않고 신청 시각 순으로 계산한다. */
public enum EnrollmentStatus {
  CONFIRMED,
  WAITING,
  CANCELLED,
  COMPLETED,
  NOT_COMPLETED
}
