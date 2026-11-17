package com.example.eduhub.enrollment;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.eduhub.common.error.ConflictException;
import com.example.eduhub.course.CourseSessionNotFoundException;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(EnrollmentController.class)
@ActiveProfiles("test")
class EnrollmentControllerTest {

  private static final String BODY = "{\"sessionId\":10}";

  @Autowired private MockMvc mockMvc;

  @MockBean private EnrollmentService enrollmentService;

  @Test
  void applyReturnsCreated() throws Exception {
    LocalDateTime now = LocalDateTime.of(2030, 1, 1, 9, 0);
    given(enrollmentService.apply(1L, 10L))
        .willReturn(
            new EnrollmentResponse(100L, 10L, EnrollmentStatus.CONFIRMED, now, now, null, false));

    mockMvc
        .perform(
            post("/api/v1/enrollments")
                .header("X-Employee-Id", "1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(BODY))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(100))
        .andExpect(jsonPath("$.status").value("CONFIRMED"));
  }

  @Test
  void applyWithoutSessionIdIsBadRequest() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/enrollments")
                .header("X-Employee-Id", "1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
        .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("sessionId")));
    verifyNoInteractions(enrollmentService);
  }

  @Test
  void applyWithoutEmployeeHeaderIsBadRequest() throws Exception {
    mockMvc
        .perform(post("/api/v1/enrollments").contentType(MediaType.APPLICATION_JSON).content(BODY))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
        .andExpect(
            jsonPath("$.message").value(org.hamcrest.Matchers.containsString("X-Employee-Id")));
    verifyNoInteractions(enrollmentService);
  }

  @Test
  void applyWithNonNumericEmployeeHeaderIsBadRequest() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/enrollments")
                .header("X-Employee-Id", "abc")
                .contentType(MediaType.APPLICATION_JSON)
                .content(BODY))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    verifyNoInteractions(enrollmentService);
  }

  @Test
  void applyToMissingSessionIsNotFound() throws Exception {
    given(enrollmentService.apply(anyLong(), anyLong()))
        .willThrow(new CourseSessionNotFoundException(10L));

    mockMvc
        .perform(
            post("/api/v1/enrollments")
                .header("X-Employee-Id", "1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(BODY))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("SESSION_NOT_FOUND"));
  }

  @Test
  void applyToClosedSessionIsConflict() throws Exception {
    given(enrollmentService.apply(anyLong(), anyLong()))
        .willThrow(new ConflictException("SESSION_NOT_RECRUITING", "모집 중인 회차가 아닙니다."));

    mockMvc
        .perform(
            post("/api/v1/enrollments")
                .header("X-Employee-Id", "1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(BODY))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("SESSION_NOT_RECRUITING"));
  }

  @Test
  void duplicateApplyIsConflict() throws Exception {
    given(enrollmentService.apply(anyLong(), anyLong()))
        .willThrow(new DuplicateEnrollmentException("이미 신청한 과정입니다."));

    mockMvc
        .perform(
            post("/api/v1/enrollments")
                .header("X-Employee-Id", "1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(BODY))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("DUPLICATE_ENROLLMENT"));
  }
}
