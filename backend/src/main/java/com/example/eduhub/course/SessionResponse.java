package com.example.eduhub.course;

import java.time.LocalDateTime;
import lombok.Value;

/** 과정 상세의 회차 (FR-02). */
@Value
public class SessionResponse {
  Long id;
  LocalDateTime startAt;
  String place;
  int capacity;
  int remainingSeats;
  CourseSessionStatus status;

  /**
   * 회차 자신의 필드만 읽는다. 지연 로딩되는 course는 건드리지 않는다 (NFR-02). 남은 자리는 정원에서 차지한 자리를 뺀 값이고, 정원을 확정 인원보다 작게 줄인
   * 경우(D-02 검사 전)에도 음수가 되지 않게 0으로 막는다.
   */
  public static SessionResponse from(CourseSession session, long occupied) {
    return new SessionResponse(
        session.getId(),
        session.getStartAt(),
        session.getPlace(),
        session.getCapacity(),
        (int) Math.max(0, session.getCapacity() - occupied),
        session.getStatus());
  }
}
