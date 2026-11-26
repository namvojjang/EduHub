package com.example.eduhub.enrollment;

import static com.example.eduhub.TestAuth.as;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.eduhub.auth.SecurityConfig;
import com.example.eduhub.auth.SecurityErrorHandlers;
import com.example.eduhub.common.error.ConflictException;
import com.example.eduhub.course.CourseSessionNotFoundException;
import com.example.eduhub.course.CourseSessionStatus;
import com.example.eduhub.course.SessionResponse;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** 관리자 명단 컨트롤러 (FR-08, NFR-03). */
@WebMvcTest(EnrollmentAdminController.class)
@Import({SecurityConfig.class, SecurityErrorHandlers.class})
@ActiveProfiles("test")
class EnrollmentAdminControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockBean private JwtDecoder jwtDecoder;

  @MockBean private EnrollmentAdminService enrollmentAdminService;

  @Test
  void adminGetsRoster() throws Exception {
    when(enrollmentAdminService.roster(5L))
        .thenReturn(
            new RosterResponse(
                5L,
                1L,
                "과정",
                LocalDateTime.of(2030, 1, 1, 9, 0),
                CourseSessionStatus.RECRUITING,
                10,
                Collections.<RosterEntry>emptyList(),
                Collections.<RosterEntry>emptyList()));

    mockMvc
        .perform(get("/api/v1/admin/sessions/5/roster").with(as(1L, "ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sessionId").value(5))
        .andExpect(jsonPath("$.capacity").value(10));

    verify(enrollmentAdminService).roster(5L);
  }

  @Test
  void employeeIsForbidden() throws Exception {
    mockMvc
        .perform(get("/api/v1/admin/sessions/5/roster").with(as(2L, "EMPLOYEE")))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));

    verifyNoInteractions(enrollmentAdminService);
  }

  @Test
  void withoutTokenIsUnauthorized() throws Exception {
    mockMvc
        .perform(get("/api/v1/admin/sessions/5/roster"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

    verifyNoInteractions(enrollmentAdminService);
  }

  @Test
  void adminCompletesSession() throws Exception {
    when(enrollmentAdminService.completeSession(5L))
        .thenReturn(
            new SessionResponse(
                5L,
                LocalDateTime.of(2020, 1, 1, 9, 0),
                "A실",
                10,
                10,
                CourseSessionStatus.COMPLETED));

    mockMvc
        .perform(post("/api/v1/admin/sessions/5/complete").with(as(1L, "ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("COMPLETED"));
  }

  @Test
  void completeNotStartedSessionIsConflict() throws Exception {
    when(enrollmentAdminService.completeSession(5L))
        .thenThrow(new ConflictException("SESSION_NOT_STARTED", "아직 시작되지 않은 회차입니다."));

    mockMvc
        .perform(post("/api/v1/admin/sessions/5/complete").with(as(1L, "ADMIN")))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("SESSION_NOT_STARTED"));
  }

  @Test
  void completeUnknownSessionIsNotFound() throws Exception {
    when(enrollmentAdminService.completeSession(99L))
        .thenThrow(new CourseSessionNotFoundException(99L));

    mockMvc
        .perform(post("/api/v1/admin/sessions/99/complete").with(as(1L, "ADMIN")))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("SESSION_NOT_FOUND"));
  }

  @Test
  void employeeCannotComplete() throws Exception {
    mockMvc
        .perform(post("/api/v1/admin/sessions/5/complete").with(as(2L, "EMPLOYEE")))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    mockMvc
        .perform(
            post("/api/v1/admin/sessions/5/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"result\":\"COMPLETED\",\"employeeIds\":[1]}")
                .with(as(2L, "EMPLOYEE")))
        .andExpect(status().isForbidden());

    verifyNoInteractions(enrollmentAdminService);
  }

  @Test
  void adminRecordsCompletions() throws Exception {
    when(enrollmentAdminService.recordCompletions(
            5L, CompletionOutcome.NOT_COMPLETED, Arrays.asList(1L, 2L)))
        .thenReturn(
            new CompletionResponse(
                Collections.singletonList(1L),
                Collections.singletonList(new CompletionFailure(2L, "NOT_ENROLLED", "없음"))));

    mockMvc
        .perform(
            post("/api/v1/admin/sessions/5/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"result\":\"NOT_COMPLETED\",\"employeeIds\":[1,2]}")
                .with(as(1L, "ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.processed[0]").value(1))
        .andExpect(jsonPath("$.failed[0].employeeId").value(2))
        .andExpect(jsonPath("$.failed[0].code").value("NOT_ENROLLED"));
  }

  @Test
  void recordCompletionsWithInvalidBodyIsBadRequest() throws Exception {
    String[] bodies = {
      "{\"result\":\"COMPLETED\",\"employeeIds\":[]}",
      "{\"employeeIds\":[1]}",
      "{\"result\":\"COMPLETED\"}",
      "{\"result\":\"COMPLETED\",\"employeeIds\":[1,null]}",
      "{\"result\":\"UNKNOWN\",\"employeeIds\":[1]}"
    };
    for (String body : bodies) {
      mockMvc
          .perform(
              post("/api/v1/admin/sessions/5/completions")
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(body)
                  .with(as(1L, "ADMIN")))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    verifyNoInteractions(enrollmentAdminService);
  }

  @Test
  void recordCompletionsOnUncompletedSessionIsConflict() throws Exception {
    when(enrollmentAdminService.recordCompletions(
            5L, CompletionOutcome.COMPLETED, Collections.singletonList(1L)))
        .thenThrow(new ConflictException("SESSION_NOT_COMPLETED", "교육이 완료된 회차가 아닙니다."));

    mockMvc
        .perform(
            post("/api/v1/admin/sessions/5/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"result\":\"COMPLETED\",\"employeeIds\":[1]}")
                .with(as(1L, "ADMIN")))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("SESSION_NOT_COMPLETED"));
  }

  @Test
  void unknownSessionIsNotFound() throws Exception {
    when(enrollmentAdminService.roster(99L)).thenThrow(new CourseSessionNotFoundException(99L));

    mockMvc
        .perform(get("/api/v1/admin/sessions/99/roster").with(as(1L, "ADMIN")))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("SESSION_NOT_FOUND"));
  }
}
