package com.example.eduhub.enrollment;

import static com.example.eduhub.TestAuth.as;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.eduhub.auth.SecurityConfig;
import com.example.eduhub.auth.SecurityErrorHandlers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** 내 신청 내역 컨트롤러 (FR-07, NFR-03). */
@WebMvcTest(MyEnrollmentController.class)
@Import({SecurityConfig.class, SecurityErrorHandlers.class})
@ActiveProfiles("test")
class MyEnrollmentControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockBean private JwtDecoder jwtDecoder;

  @MockBean private MyEnrollmentQueryService myEnrollmentQueryService;

  @Test
  void listUsesEmployeeIdFromToken() throws Exception {
    mockMvc
        .perform(get("/api/v1/me/enrollments").with(as(42L, "EMPLOYEE")))
        .andExpect(status().isOk());

    verify(myEnrollmentQueryService).list(42L, null);
  }

  @Test
  void employeeIdQueryParamIsIgnored() throws Exception {
    mockMvc
        .perform(get("/api/v1/me/enrollments").param("employeeId", "7").with(as(42L, "EMPLOYEE")))
        .andExpect(status().isOk());

    verify(myEnrollmentQueryService).list(42L, null);
    verify(myEnrollmentQueryService, never()).list(eq(7L), any());
  }

  @Test
  void invalidStatusIsBadRequest() throws Exception {
    mockMvc
        .perform(get("/api/v1/me/enrollments").param("status", "NOPE").with(as(42L, "EMPLOYEE")))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

    verifyNoInteractions(myEnrollmentQueryService);
  }

  @Test
  void withoutTokenIsUnauthorized() throws Exception {
    mockMvc
        .perform(get("/api/v1/me/enrollments"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

    verifyNoInteractions(myEnrollmentQueryService);
    verify(myEnrollmentQueryService, never()).list(anyLong(), any());
  }
}
