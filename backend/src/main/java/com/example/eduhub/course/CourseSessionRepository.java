package com.example.eduhub.course;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseSessionRepository extends JpaRepository<CourseSession, Long> {

  /** 과정 상세의 회차 목록 (FR-02). 시작 시각 순. */
  List<CourseSession> findByCourseIdOrderByStartAtAsc(Long courseId);
}
