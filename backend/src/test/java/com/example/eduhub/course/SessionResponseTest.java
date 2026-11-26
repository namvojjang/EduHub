package com.example.eduhub.course;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

/** SessionResponse 남은 자리 계산 단위 테스트 S8 (FR-02). */
class SessionResponseTest {

  private static CourseSession session(int capacity) {
    Course course = Course.create("과정", "개발", null);
    return CourseSession.create(course, LocalDateTime.now().plusDays(7), "A실", capacity);
  }

  @Test
  void remainingIsCapacityMinusOccupied() {
    assertThat(SessionResponse.from(session(3), 2).getRemainingSeats()).isEqualTo(1);
    assertThat(SessionResponse.from(session(3), 0).getRemainingSeats()).isEqualTo(3);
  }

  @Test
  void remainingIsZeroWhenOccupiedExceedsCapacity() {
    assertThat(SessionResponse.from(session(2), 5).getRemainingSeats()).isEqualTo(0);
    assertThat(SessionResponse.from(session(2), 2).getRemainingSeats()).isEqualTo(0);
  }
}
