package com.example.eduhub.course;

import java.time.LocalDateTime;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.EnumType;
import javax.persistence.Enumerated;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 과정의 회차 (FR-02, FR-03). 신청은 회차 단위로 한다. */
@Entity
@Table(name = "course_session")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CourseSession {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "course_id", nullable = false)
  private Course course;

  @Column(name = "start_at", nullable = false)
  private LocalDateTime startAt;

  @Column(nullable = false, length = 200)
  private String place;

  @Column(nullable = false)
  private int capacity;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private CourseSessionStatus status;

  private CourseSession(Course course, LocalDateTime startAt, String place, int capacity) {
    if (capacity <= 0) {
      throw new IllegalArgumentException("정원은 1 이상이어야 합니다: " + capacity);
    }
    this.course = course;
    this.startAt = startAt;
    this.place = place;
    this.capacity = capacity;
    this.status = CourseSessionStatus.RECRUITING;
  }

  public static CourseSession create(
      Course course, LocalDateTime startAt, String place, int capacity) {
    return new CourseSession(course, startAt, place, capacity);
  }

  /** 모집 마감 (D-01). 신규 신청·대기만 막고 기존 확정·대기는 유지한다. */
  public void close() {
    if (status != CourseSessionStatus.RECRUITING) {
      throw new IllegalStateException("모집 중인 회차만 마감할 수 있습니다: " + status);
    }
    this.status = CourseSessionStatus.CLOSED;
  }
}
