package com.example.eduhub.course;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.eduhub.common.web.PageResponse;
import java.time.LocalDateTime;
import java.util.Collections;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(CourseController.class)
@ActiveProfiles("test")
class CourseControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockBean private CourseQueryService courseQueryService;

  @Test
  void listReturnsPageResponse() throws Exception {
    given(courseQueryService.search(any(), any(), any(Pageable.class)))
        .willReturn(
            new PageResponse<>(
                Collections.singletonList(new CourseSummaryResponse(1L, "Java 기초", "개발")),
                0,
                20,
                1L));

    mockMvc
        .perform(get("/api/v1/courses"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].id").value(1))
        .andExpect(jsonPath("$.content[0].title").value("Java 기초"))
        .andExpect(jsonPath("$.content[0].category").value("개발"))
        .andExpect(jsonPath("$.page").value(0))
        .andExpect(jsonPath("$.size").value(20))
        .andExpect(jsonPath("$.totalElements").value(1));
  }

  @Test
  void listPassesSearchConditionsAndPage() throws Exception {
    given(courseQueryService.search(any(), any(), any(Pageable.class)))
        .willReturn(new PageResponse<>(Collections.emptyList(), 1, 5, 0L));

    mockMvc
        .perform(
            get("/api/v1/courses")
                .param("keyword", "java")
                .param("category", "개발")
                .param("page", "1")
                .param("size", "5"))
        .andExpect(status().isOk());

    ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
    verify(courseQueryService).search(eq("java"), eq("개발"), pageable.capture());
    assertThat(pageable.getValue().getPageNumber()).isEqualTo(1);
    assertThat(pageable.getValue().getPageSize()).isEqualTo(5);
  }

  @Test
  void listUsesDefaultPageAndSort() throws Exception {
    given(courseQueryService.search(any(), any(), any(Pageable.class)))
        .willReturn(new PageResponse<>(Collections.emptyList(), 0, 20, 0L));

    mockMvc.perform(get("/api/v1/courses")).andExpect(status().isOk());

    ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
    verify(courseQueryService).search(isNull(), isNull(), pageable.capture());
    assertThat(pageable.getValue().getPageNumber()).isEqualTo(0);
    assertThat(pageable.getValue().getPageSize()).isEqualTo(20);
    assertThat(pageable.getValue().getSort().getOrderFor("id").getDirection())
        .isEqualTo(Sort.Direction.DESC);
  }

  @Test
  void detailReturnsCourseWithSessions() throws Exception {
    SessionResponse session =
        new SessionResponse(
            10L,
            LocalDateTime.of(2026, 12, 1, 9, 0),
            "본사 3층",
            30,
            30,
            CourseSessionStatus.RECRUITING);
    given(courseQueryService.getDetail(1L))
        .willReturn(
            new CourseDetailResponse(
                1L,
                "Java 기초",
                "개발",
                "입문 과정",
                CourseStatus.OPEN,
                Collections.singletonList(session)));

    mockMvc
        .perform(get("/api/v1/courses/1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(1))
        .andExpect(jsonPath("$.description").value("입문 과정"))
        .andExpect(jsonPath("$.status").value("OPEN"))
        .andExpect(jsonPath("$.sessions[0].id").value(10))
        .andExpect(jsonPath("$.sessions[0].startAt").value("2026-12-01T09:00:00"))
        .andExpect(jsonPath("$.sessions[0].place").value("본사 3층"))
        .andExpect(jsonPath("$.sessions[0].capacity").value(30))
        .andExpect(jsonPath("$.sessions[0].remainingSeats").value(30))
        .andExpect(jsonPath("$.sessions[0].status").value("RECRUITING"));
  }

  @Test
  void detailReturns404WhenCourseMissing() throws Exception {
    given(courseQueryService.getDetail(999L)).willThrow(new CourseNotFoundException(999L));

    mockMvc
        .perform(get("/api/v1/courses/999"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("COURSE_NOT_FOUND"))
        .andExpect(jsonPath("$.message").value("과정을 찾을 수 없습니다: 999"));
  }
}
