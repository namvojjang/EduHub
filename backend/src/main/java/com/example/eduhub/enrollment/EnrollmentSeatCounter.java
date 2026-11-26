package com.example.eduhub.enrollment;

import com.example.eduhub.course.SeatCounter;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * course의 {@link SeatCounter} 구현 (FR-02, NFR-07). 확정·수료·미수료를 자리를 차지한 것으로 센다. 대기·취소는 세지 않는다. 교육이 끝난
 * 회차가 "남은 자리 = 정원"으로 보이지 않게 수료·미수료도 센다.
 */
@Component
@RequiredArgsConstructor
public class EnrollmentSeatCounter implements SeatCounter {

  private static final List<EnrollmentStatus> OCCUPYING_STATUSES =
      Collections.unmodifiableList(
          Arrays.asList(
              EnrollmentStatus.CONFIRMED,
              EnrollmentStatus.COMPLETED,
              EnrollmentStatus.NOT_COMPLETED));

  private final EnrollmentRepository enrollmentRepository;

  @Override
  public Map<Long, Long> occupiedSeats(Collection<Long> sessionIds) {
    if (sessionIds.isEmpty()) {
      return Collections.emptyMap();
    }
    Map<Long, Long> result = new HashMap<>();
    for (Object[] row : enrollmentRepository.countBySessionIds(sessionIds, OCCUPYING_STATUSES)) {
      result.put((Long) row[0], (Long) row[1]);
    }
    return result;
  }
}
