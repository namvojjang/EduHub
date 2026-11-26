package com.example.eduhub.auth;

import static com.example.eduhub.TestAuth.as;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.eduhub.common.error.UnauthorizedException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, SecurityErrorHandlers.class})
@ActiveProfiles("test")
class AuthControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockBean private JwtDecoder jwtDecoder;

  @MockBean private AuthService authService;

  @Test
  void loginReturnsToken() throws Exception {
    given(authService.login("E1001", "pw"))
        .willReturn(
            new LoginResponse(
                "tok", "Bearer", 3600L, new MeResponse(1L, "E1001", "김사원", "EMPLOYEE")));

    mockMvc
        .perform(
            post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"employeeNo\":\"E1001\",\"password\":\"pw\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.accessToken").value("tok"))
        .andExpect(jsonPath("$.tokenType").value("Bearer"))
        .andExpect(jsonPath("$.expiresIn").value(3600))
        .andExpect(jsonPath("$.user.employeeNo").value("E1001"))
        .andExpect(jsonPath("$.user.passwordHash").doesNotExist());
  }

  @Test
  void loginWithBlankFieldsIsBadRequest() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"employeeNo\":\"\",\"password\":\"\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  void loginFailureIsUnauthorized() throws Exception {
    given(authService.login("E1001", "bad"))
        .willThrow(new UnauthorizedException("LOGIN_FAILED", "사번 또는 비밀번호가 올바르지 않습니다."));

    mockMvc
        .perform(
            post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"employeeNo\":\"E1001\",\"password\":\"bad\"}"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("LOGIN_FAILED"));
  }

  @Test
  void meReturnsTokenUser() throws Exception {
    mockMvc
        .perform(get("/api/v1/me").with(as(5L, "ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.employeeId").value(5))
        .andExpect(jsonPath("$.employeeNo").value("T5"))
        .andExpect(jsonPath("$.role").value("ADMIN"));
  }

  @Test
  void meWithoutTokenIsUnauthorized() throws Exception {
    mockMvc
        .perform(get("/api/v1/me"))
        .andExpect(status().isUnauthorized())
        .andExpect(header().string("WWW-Authenticate", "Bearer"))
        .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
  }
}
