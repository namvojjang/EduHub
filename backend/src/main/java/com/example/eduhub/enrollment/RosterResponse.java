package com.example.eduhub.enrollment;

import com.example.eduhub.course.CourseSessionStatus;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Value;

/** 회차 명단 (FR-08). confirmed는 확정·수료·미수료, waiting은 대기 순번 순. */
@Value
public class RosterResponse {

  Long sessionId;
  Long courseId;
  String courseTitle;
  LocalDateTime sessionStartAt;
  CourseSessionStatus sessionStatus;
  int capacity;
  List<RosterEntry> confirmed;
  List<RosterEntry> waiting;
}
