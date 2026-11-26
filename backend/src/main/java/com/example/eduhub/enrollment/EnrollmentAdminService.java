package com.example.eduhub.enrollment;

import com.example.eduhub.course.CourseSession;
import com.example.eduhub.course.CourseSessionNotFoundException;
import com.example.eduhub.course.CourseSessionRepository;
import com.example.eduhub.course.SessionResponse;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 관리자용 회차 명단·수료 처리 (FR-08, D-05). 명단 조회, 회차 완료, 수료 처리. */
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

  /**
   * 회차 교육 완료 (D-01, D-05). 회차 락 → 완료 → 남은 대기 전부 취소. 신청·취소와 같은 회차 락을 써서 순서가 정해진다. course는
   * enrollment에 의존하지 않으므로 대기 취소까지 하는 이 메서드는 enrollment 쪽에 둔다.
   */
  public SessionResponse completeSession(Long sessionId) {
    CourseSession session = lockSession(sessionId);
    session.complete(LocalDateTime.now());
    for (Enrollment waiting :
        enrollmentRepository.findBySessionIdAndStatus(sessionId, EnrollmentStatus.WAITING)) {
      waiting.cancel();
    }
    return SessionResponse.from(session);
  }

  /**
   * 수료·미수료 처리 (D-05). 완료된 회차의 확정 신청만 처리하고, 안 되는 사원은 사유와 함께 돌려준다. 같은 회차 락을 쥔 뒤 읽으므로 동시에 같은 사원을 처리해도
   * 한 번만 처리된다.
   */
  public CompletionResponse recordCompletions(
      Long sessionId, CompletionOutcome result, List<Long> employeeIds) {
    CourseSession session = lockSession(sessionId);
    session.requireCompleted();

    LinkedHashSet<Long> distinctIds = new LinkedHashSet<>(employeeIds);
    Map<Long, List<Enrollment>> byEmployee = new HashMap<>();
    for (Enrollment e :
        enrollmentRepository.findBySessionIdAndEmployeeIdIn(sessionId, distinctIds)) {
      List<Enrollment> list = byEmployee.get(e.getEmployeeId());
      if (list == null) {
        list = new ArrayList<>();
        byEmployee.put(e.getEmployeeId(), list);
      }
      list.add(e);
    }

    List<Long> processed = new ArrayList<>();
    List<CompletionFailure> failed = new ArrayList<>();
    for (Long employeeId : distinctIds) {
      List<Enrollment> list = byEmployee.get(employeeId);
      if (list == null) {
        failed.add(new CompletionFailure(employeeId, "NOT_ENROLLED", "이 회차에 신청하지 않았습니다."));
        continue;
      }
      // 취소 후 재신청으로 한 사원에 같은 회차 신청이 여러 개일 수 있다. 확정을 우선한다.
      Enrollment confirmed = find(list, EnrollmentStatus.CONFIRMED);
      if (confirmed != null) {
        confirmed.recordCompletion(result == CompletionOutcome.COMPLETED);
        processed.add(employeeId);
      } else if (find(list, EnrollmentStatus.COMPLETED) != null
          || find(list, EnrollmentStatus.NOT_COMPLETED) != null) {
        failed.add(new CompletionFailure(employeeId, "ALREADY_RECORDED", "이미 수료 또는 미수료로 처리되었습니다."));
      } else if (find(list, EnrollmentStatus.WAITING) != null) {
        failed.add(new CompletionFailure(employeeId, "WAITING", "대기 중인 신청은 수료 처리할 수 없습니다."));
      } else {
        failed.add(new CompletionFailure(employeeId, "CANCELLED", "취소된 신청입니다."));
      }
    }
    return new CompletionResponse(processed, failed);
  }

  private CourseSession lockSession(Long sessionId) {
    return courseSessionRepository
        .findByIdForUpdate(sessionId)
        .orElseThrow(() -> new CourseSessionNotFoundException(sessionId));
  }

  private static Enrollment find(List<Enrollment> list, EnrollmentStatus status) {
    for (Enrollment e : list) {
      if (e.getStatus() == status) {
        return e;
      }
    }
    return null;
  }
}
