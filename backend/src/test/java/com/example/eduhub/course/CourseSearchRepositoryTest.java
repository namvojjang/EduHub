package com.example.eduhub.course;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.test.context.ActiveProfiles;

/**
 * 과정 목록 검색 조건(FR-01)과 회차 조회(FR-02).
 *
 * <p>개발 DB와 같은 DB를 쓸 수 있으므로, 테스트마다 고유한 분류·제목 토큰으로 데이터를 넣고 그 값으로 검색한다.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class CourseSearchRepositoryTest {

  private static final PageRequest FIRST_PAGE =
      PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "id"));

  @Autowired private CourseRepository courseRepository;

  @Autowired private CourseSessionRepository courseSessionRepository;

  @Autowired private TestEntityManager em;

  private final String token = UUID.randomUUID().toString().substring(0, 8);

  @Test
  void keywordMatchesTitlePartiallyIgnoringCase() {
    String category = uniqueCategory();
    Course lower = save(Course.create("Spring " + token + " 입문", category, null));
    Course upper = save(Course.create("SPRING " + token.toUpperCase() + " 심화", category, null));
    save(Course.create("Java 기초", category, null));

    Page<Course> result = search(token.toUpperCase(), null);

    assertThat(result.getContent())
        .extracting(Course::getId)
        .containsExactlyInAnyOrder(lower.getId(), upper.getId());
  }

  @Test
  void categoryFiltersExactly() {
    String category = uniqueCategory();
    Course a = save(Course.create("A", category, null));
    Course b = save(Course.create("B", category, null));
    save(Course.create("C", uniqueCategory(), null));

    Page<Course> result = search(null, category);

    assertThat(result.getContent())
        .extracting(Course::getId)
        .containsExactlyInAnyOrder(a.getId(), b.getId());
  }

  @Test
  void keywordAndCategoryAreCombined() {
    String category = uniqueCategory();
    Course match = save(Course.create("Spring " + token, category, null));
    save(Course.create("Java 기초", category, null));
    save(Course.create("Spring " + token, uniqueCategory(), null));

    Page<Course> result = search(token, category);

    assertThat(result.getContent()).extracting(Course::getId).containsExactly(match.getId());
  }

  @Test
  void closedCoursesAreExcluded() {
    String category = uniqueCategory();
    Course open = save(Course.create("열린 과정", category, null));
    Course closed = Course.create("종료된 과정", category, null);
    closed.close();
    save(closed);

    Page<Course> result = search(null, category);

    assertThat(result.getContent()).extracting(Course::getId).containsExactly(open.getId());
  }

  @Test
  void pagingReturnsRequestedSizeAndTotal() {
    String category = uniqueCategory();
    save(Course.create("첫째", category, null));
    save(Course.create("둘째", category, null));
    Course newest = save(Course.create("셋째", category, null));

    Page<Course> result =
        courseRepository.findAll(
            CourseSpecifications.listed(null, category),
            PageRequest.of(0, 2, Sort.by(Sort.Direction.DESC, "id")));

    assertThat(result.getContent()).hasSize(2);
    assertThat(result.getTotalElements()).isEqualTo(3);
    assertThat(result.getContent().get(0).getId()).isEqualTo(newest.getId());
  }

  @Test
  void sessionsAreFoundByCourseInStartOrder() {
    Course course = save(Course.create("회차 있는 과정", uniqueCategory(), null));
    Course other = save(Course.create("다른 과정", uniqueCategory(), null));
    LocalDateTime base = LocalDateTime.of(2026, 12, 1, 9, 0);
    CourseSession later = persist(CourseSession.create(course, base.plusDays(7), "본사 3층", 20));
    CourseSession earlier = persist(CourseSession.create(course, base, "본사 3층", 20));
    persist(CourseSession.create(other, base, "본사 5층", 10));
    em.flush();
    em.clear();

    List<CourseSession> sessions =
        courseSessionRepository.findByCourseIdOrderByStartAtAsc(course.getId());

    assertThat(sessions)
        .extracting(CourseSession::getId)
        .containsExactly(earlier.getId(), later.getId());
  }

  @Test
  void adminListIncludesClosedCourses() {
    String category = uniqueCategory();
    Course open = save(Course.create("열린 과정", category, null));
    Course closed = Course.create("종료된 과정", category, null);
    closed.close();
    save(closed);
    em.flush();
    em.clear();

    Page<Course> result =
        courseRepository.findAll(CourseSpecifications.managed(null, category), FIRST_PAGE);

    assertThat(result.getContent())
        .extracting(Course::getId)
        .containsExactlyInAnyOrder(open.getId(), closed.getId());
  }

  private Page<Course> search(String keyword, String category) {
    em.flush();
    em.clear();
    return courseRepository.findAll(CourseSpecifications.listed(keyword, category), FIRST_PAGE);
  }

  private Course save(Course course) {
    return courseRepository.save(course);
  }

  private CourseSession persist(CourseSession session) {
    return em.persist(session);
  }

  private String uniqueCategory() {
    return "test-" + UUID.randomUUID().toString().substring(0, 8);
  }
}
