package com.example.eduhub.course;

import com.example.eduhub.common.error.ConflictException;
import java.time.LocalDateTime;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.EnumType;
import javax.persistence.Enumerated;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 교육과정 (FR-01~03). 상태는 setter가 아니라 의미 있는 메서드로만 바꾼다. */
@Entity
@Table(name = "course")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Course {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 200)
  private String title;

  @Column(nullable = false, length = 50)
  private String category;

  @Column(length = 2000)
  private String description;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private CourseStatus status;

  private Course(String title, String category, String description) {
    this.title = title;
    this.category = category;
    this.description = description;
    this.status = CourseStatus.OPEN;
  }

  public static Course create(String title, String category, String description) {
    return new Course(title, category, description);
  }

  /** 과정 정보 수정 (FR-03). 종료된 과정도 오탈자 정정은 할 수 있게 상태와 무관하게 허용한다. */
  public void update(String title, String category, String description) {
    this.title = title;
    this.category = category;
    this.description = description;
  }

  /** 과정 종료 (D-02). 기존 회차와 신청은 그대로 둔다. */
  public void close() {
    if (status == CourseStatus.CLOSED) {
      throw new ConflictException("COURSE_ALREADY_CLOSED", "이미 종료된 과정입니다.");
    }
    this.status = CourseStatus.CLOSED;
  }

  /** 회차 개설 (FR-03). 종료된 과정에는 새 회차를 열 수 없다 (D-02). */
  public CourseSession openSession(LocalDateTime startAt, String place, int capacity) {
    if (status == CourseStatus.CLOSED) {
      throw new ConflictException("COURSE_CLOSED", "종료된 과정에는 회차를 추가할 수 없습니다.");
    }
    return CourseSession.create(this, startAt, place, capacity);
  }
}
