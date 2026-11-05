package com.example.eduhub.course;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

/** 과정 목록 검색 조건 (FR-01). 키워드·분류는 값이 있을 때만 조건에 넣는다. */
public final class CourseSpecifications {

  private CourseSpecifications() {}

  /** 목록에 노출할 과정: 종료된 과정은 빠진다 (D-02). */
  public static Specification<Course> listed(String keyword, String category) {
    return isOpen().and(titleContains(keyword)).and(categoryEquals(category));
  }

  static Specification<Course> isOpen() {
    return (root, query, cb) -> cb.equal(root.get("status"), CourseStatus.OPEN);
  }

  /** 제목 부분 일치, 대소문자 무시. %와 _는 문자 그대로 찾는다. */
  static Specification<Course> titleContains(String keyword) {
    if (!StringUtils.hasText(keyword)) {
      return null;
    }
    String pattern = "%" + escapeLike(keyword.trim().toLowerCase()) + "%";
    return (root, query, cb) -> cb.like(cb.lower(root.get("title")), pattern, '\\');
  }

  static Specification<Course> categoryEquals(String category) {
    if (!StringUtils.hasText(category)) {
      return null;
    }
    return (root, query, cb) -> cb.equal(root.get("category"), category.trim());
  }

  private static String escapeLike(String value) {
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
  }
}
