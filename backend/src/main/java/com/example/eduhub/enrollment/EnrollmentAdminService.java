package com.example.eduhub.enrollment;

import com.example.eduhub.course.CourseSession;
import com.example.eduhub.course.CourseSessionNotFoundException;
import com.example.eduhub.course.CourseSessionRepository;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 관리자용 회차 명단·수료 처리 (FR-08, D-05). 이 작업에서는 명단 조회만 있다. */
@Service
@Transactional
@RequiredArgsConstructor
public class EnrollmentAdminService {

  private static final List<EnrollmentStatus> CONFIRMED_GROUP =
      Collections.unmodifiableList(
          Arrays.asList(
              EnrollmentStatus.CONFIRMED,
              EnrollmentStatus.COMPLETED,
              EnrollmentStatus.NOT_COMPLETED));
  private static final List<EnrollmentStatus> WAITING_GROUP =
      Collections.singletonList(EnrollmentStatus.WAITING);

  private final CourseSessionRepository courseSessionRepository;
  private final EnrollmentRepository enrollmentRepository;

  /**
   * 회차 명단. 확정 목록 1번, 대기 목록 1번(신청 인원과 무관한 고정 쿼리 수, NFR-02). 대기 순번은 (appliedAt, id) 순서대로 1부터 매긴다
   * (FR-05, FR-07과 같은 기준). 취소는 제외한다.
   */
  @Transactional(readOnly = true)
  public RosterResponse roster(Long sessionId) {
    CourseSession session =
        courseSessionRepository
            .findById(sessionId)
            .orElseThrow(() -> new CourseSessionNotFoundException(sessionId));
    List<RosterEntry> confirmed = enrollmentRepository.findRoster(sessionId, CONFIRMED_GROUP);
    List<RosterEntry> queue = enrollmentRepository.findRoster(sessionId, WAITING_GROUP);
    List<RosterEntry> waiting = new ArrayList<>(queue.size());
    int number = 1;
    for (RosterEntry entry : queue) {
      waiting.add(entry.withWaitingNumber(number++));
    }
    return new RosterResponse(
        session.getId(),
        session.getCourse().getId(),
        session.getCourse().getTitle(),
        session.getStartAt(),
        session.getStatus(),
        session.getCapacity(),
        confirmed,
        waiting);
  }
}
