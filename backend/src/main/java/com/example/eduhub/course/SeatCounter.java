package com.example.eduhub.course;

import java.util.Collection;
import java.util.Map;

/**
 * 회차별로 자리를 차지한 인원 수를 알려 준다 (FR-02).
 *
 * <p>enrollment가 구현한다(의존 역전, NFR-07). course는 enrollment를 import하지 않고 이 인터페이스만 안다.
 */
public interface SeatCounter {

  /** 회차 ID별 차지한 자리 수. 반환 Map에 없는 회차는 0으로 본다. 빈 목록이면 빈 Map. */
  Map<Long, Long> occupiedSeats(Collection<Long> sessionIds);
}
