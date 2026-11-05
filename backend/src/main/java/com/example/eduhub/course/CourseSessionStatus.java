package com.example.eduhub.course;

/**
 * 회차 상태 (D-01): 모집 중 → 모집 마감 → 교육 완료.
 *
 * <p>"정원 마감"은 상태가 아니라 남은 자리 0으로 계산한다.
 */
public enum CourseSessionStatus {
  RECRUITING,
  CLOSED,
  COMPLETED
}
