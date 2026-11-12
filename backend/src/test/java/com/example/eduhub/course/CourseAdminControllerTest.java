package com.example.eduhub.course;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.eduhub.common.error.ConflictException;
import com.example.eduhub.common.web.PageResponse;
import java.time.LocalDateTime;
import java.util.Collections;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(CourseAdminController.class)
@ActiveProfiles("test")
class CourseAdminControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockBean private CourseAdminService courseAdminService;

  @Test
  void listIncludesStatus() throws Exception {
    given(courseAdminService.search(any(), any(), any(Pageable.class)))
        .willReturn(
            new PageResponse<>(
                Collections.singletonList(
                    new AdminCourseSummaryResponse(1L, "Java 기초", "개발", CourseStatus.CLOSED)),
                0,
                20,
                1L));

    mockMvc
        .perform(get("/api/v1/admin/courses"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].status").value("CLOSED"));
  }

  @Test
  void createCourseReturns201() throws Exception {
    given(courseAdminService.createCourse(any()))
        .willReturn(
            new CourseDetailResponse(
                1L, "Java 기초", "개발", null, CourseStatus.OPEN, Collections.emptyList()));

    mockMvc
        .perform(
            post("/api/v1/admin/courses")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Java 기초\",\"category\":\"개발\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(1))
        .andExpect(jsonPath("$.status").value("OPEN"));
  }

  @Test
  void createCourseWithBlankTitleReturns400() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/admin/courses")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\" \",\"category\":\"개발\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
        .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("title")));
    verifyNoInteractions(courseAdminService);
  }

  @Test
  void updateMissingCourseReturns404() throws Exception {
    given(courseAdminService.updateCourse(eq(9L), any()))
        .willThrow(new CourseNotFoundException(9L));

    mockMvc
        .perform(
            put("/api/v1/admin/courses/9")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"t\",\"category\":\"c\"}"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("COURSE_NOT_FOUND"));
  }

  @Test
  void createSessionReturns201() throws Exception {
    given(courseAdminService.createSession(eq(1L), any()))
        .willReturn(
            new SessionResponse(
                10L,
                LocalDateTime.of(2030, 1, 6, 9, 0),
                "본사 3층",
                20,
                20,
                CourseSessionStatus.RECRUITING));

    mockMvc
        .perform(
            post("/api/v1/admin/courses/1/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"startAt\":\"2030-01-06T09:00:00\",\"place\":\"본사 3층\",\"capacity\":20}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(10))
        .andExpect(jsonPath("$.startAt").value("2030-01-06T09:00:00"));
  }

  @Test
  void createSessionWithPastStartAndZeroCapacityReturns400() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/admin/courses/1/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"startAt\":\"2000-01-01T09:00:00\",\"place\":\"본사\",\"capacity\":0}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("capacity")))
        .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("startAt")));
  }

  @Test
  void createSessionOnClosedCourseReturns409() throws Exception {
    given(courseAdminService.createSession(eq(1L), any()))
        .willThrow(new ConflictException("COURSE_CLOSED", "종료된 과정에는 회차를 추가할 수 없습니다."));

    mockMvc
        .perform(
            post("/api/v1/admin/courses/1/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"startAt\":\"2030-01-06T09:00:00\",\"place\":\"본사\",\"capacity\":10}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("COURSE_CLOSED"));
  }

  @Test
  void closeSessionReturnsClosedSession() throws Exception {
    given(courseAdminService.closeSession(10L))
        .willReturn(
            new SessionResponse(
                10L, LocalDateTime.of(2030, 1, 6, 9, 0), "본사", 20, 20, CourseSessionStatus.CLOSED));

    mockMvc
        .perform(post("/api/v1/admin/sessions/10/close"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("CLOSED"));
  }
}
