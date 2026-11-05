package com.example.eduhub.course;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

/** 로컬 PostgreSQL의 테스트 DB에 Flyway V1을 적용한 뒤 저장·조회를 확인한다. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class CourseRepositoryTest {

  @Autowired private CourseRepository courseRepository;

  @Autowired private TestEntityManager em;

  @Test
  void savesAndFindsCourse() {
    Course saved = courseRepository.save(Course.create("Java 기초", "개발", "입문 과정"));
    em.flush();
    em.clear();

    Course found = courseRepository.findById(saved.getId()).orElseThrow(IllegalStateException::new);

    assertThat(found.getTitle()).isEqualTo("Java 기초");
    assertThat(found.getCategory()).isEqualTo("개발");
    assertThat(found.getDescription()).isEqualTo("입문 과정");
    assertThat(found.getStatus()).isEqualTo(CourseStatus.OPEN);
  }
}
