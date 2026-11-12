package com.example.eduhub.course;

import java.util.List;
import java.util.Optional;
import javax.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CourseSessionRepository extends JpaRepository<CourseSession, Long> {

  /** 과정 상세의 회차 목록 (FR-02). 시작 시각 순. */
  List<CourseSession> findByCourseIdOrderByStartAtAsc(Long courseId);

  /** NFR-01. 회차 행을 잠가 같은 회차의 신청을 한 줄로 세운다. */
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select s from CourseSession s where s.id = :id")
  Optional<CourseSession> findByIdForUpdate(@Param("id") Long id);
}
