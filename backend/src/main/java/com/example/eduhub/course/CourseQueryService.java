package com.example.eduhub.course;

import com.example.eduhub.common.web.PageResponse;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 과정 조회 (FR-01, FR-02). 등록·수정은 별도 서비스가 맡는다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CourseQueryService {

  private final CourseRepository courseRepository;
  private final CourseSessionRepository courseSessionRepository;
  private final SeatCounter seatCounter;

  public PageResponse<CourseSummaryResponse> search(
      String keyword, String category, Pageable pageable) {
    return PageResponse.from(
        courseRepository
            .findAll(CourseSpecifications.listed(keyword, category), pageable)
            .map(CourseSummaryResponse::from));
  }

  /** 종료된 과정도 상세는 보여 준다. 이미 신청한 사람이 내역(FR-07)에서 열어 볼 수 있어야 한다. */
  public CourseDetailResponse getDetail(Long courseId) {
    Course course =
        courseRepository
            .findById(courseId)
            .orElseThrow(() -> new CourseNotFoundException(courseId));
    List<CourseSession> sessions =
        courseSessionRepository.findByCourseIdOrderByStartAtAsc(courseId);
    // 회차가 없으면 조회하지 않고, 있으면 회차 전체를 쿼리 1번으로 센다 (NFR-02).
    Map<Long, Long> occupied =
        sessions.isEmpty()
            ? Collections.<Long, Long>emptyMap()
            : seatCounter.occupiedSeats(
                sessions.stream().map(CourseSession::getId).collect(Collectors.toList()));
    return CourseDetailResponse.of(course, sessions, occupied);
  }
}
