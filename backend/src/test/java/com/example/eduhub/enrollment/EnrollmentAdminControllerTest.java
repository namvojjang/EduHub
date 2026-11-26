package com.example.eduhub.enrollment;

import static com.example.eduhub.TestAuth.as;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.eduhub.auth.SecurityConfig;
import com.example.eduhub.auth.SecurityErrorHandlers;
import com.example.eduhub.course.CourseSessionNotFoundException;
import com.example.eduhub.course.CourseSessionStatus;
import java.time.LocalDateTime;
import java.util.Collections;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
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
  void unknownSessionIsNotFound() throws Exception {
    when(enrollmentAdminService.roster(99L)).thenThrow(new CourseSessionNotFoundException(99L));

    mockMvc
        .perform(get("/api/v1/admin/sessions/99/roster").with(as(1L, "ADMIN")))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("SESSION_NOT_FOUND"));
  }
}
