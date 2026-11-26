package com.example.eduhub.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

/** 실제 서명·검증 경로를 지나는 통합 테스트 (설계 S1~S3). 디코더를 mock하지 않는다. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AuthIntegrationTest {

  private static final String PASSWORD = "it-password";

  @Autowired private MockMvc mockMvc;
  @Autowired private EmployeeRepository employeeRepository;
  @Autowired private PasswordEncoder passwordEncoder;
  @Autowired private JwtEncoder jwtEncoder;
  @Autowired private ObjectMapper objectMapper;

  private Employee employee;

  @BeforeEach
  void setUp() {
    String no = UUID.randomUUID().toString().substring(0, 12);
    employee =
        employeeRepository.saveAndFlush(
            Employee.create(no, "통합테스트", passwordEncoder.encode(PASSWORD), EmployeeRole.EMPLOYEE));
  }

  private String loginBody(String employeeNo, String password) {
    return "{\"employeeNo\":\"" + employeeNo + "\",\"password\":\"" + password + "\"}";
  }

  private String loginAndGetToken() throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(loginBody(employee.getEmployeeNo(), PASSWORD)))
            .andExpect(status().isOk())
            .andReturn();
    JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
    return body.get("accessToken").asText();
  }

  private void expectUnauthenticated(String token) throws Exception {
    mockMvc
        .perform(get("/api/v1/me").header("Authorization", "Bearer " + token))
        .andExpect(status().isUnauthorized())
        .andExpect(header().string("WWW-Authenticate", "Bearer"))
        .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
  }

  @Test
  void loginThenMeWithIssuedToken() throws Exception {
    String token = loginAndGetToken();

    mockMvc
        .perform(get("/api/v1/me").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.employeeId").value(employee.getId()))
        .andExpect(jsonPath("$.employeeNo").value(employee.getEmployeeNo()))
        .andExpect(jsonPath("$.name").value("통합테스트"))
        .andExpect(jsonPath("$.role").value("EMPLOYEE"));
  }

  @Test
  void forgedTokenIsUnauthorized() throws Exception {
    String token = loginAndGetToken();
    String[] parts = token.split("\\.");
    // 서명 부분을 통째로 다른 값으로 바꾼다 (길이는 HS256 서명과 같은 43자)
    StringBuilder fakeSignature = new StringBuilder();
    for (int i = 0; i < 43; i++) {
      fakeSignature.append('x');
    }
    assertThat(parts).hasSize(3);

    expectUnauthenticated(parts[0] + "." + parts[1] + "." + fakeSignature);
  }

  @Test
  void expiredTokenIsUnauthorized() throws Exception {
    Clock twoHoursAgo = Clock.fixed(Instant.now().minusSeconds(2 * 60 * 60), ZoneOffset.UTC);
    String expired = new TokenService(jwtEncoder, 60, twoHoursAgo).issue(employee);

    expectUnauthenticated(expired);
  }

  @Test
  void tokenWithNonNumericSubjectIsUnauthorized() throws Exception {
    Instant now = Instant.now();
    JwtClaimsSet claims =
        JwtClaimsSet.builder()
            .subject("abc")
            .issuedAt(now)
            .expiresAt(now.plusSeconds(600))
            .claim("role", "EMPLOYEE")
            .build();
    JwsHeader jwsHeader = JwsHeader.with(MacAlgorithm.HS256).build();
    String token = jwtEncoder.encode(JwtEncoderParameters.from(jwsHeader, claims)).getTokenValue();

    expectUnauthenticated(token);
  }

  @Test
  void wrongPasswordAndUnknownNoReturnSameBody() throws Exception {
    String wrongPassword =
        mockMvc
            .perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(loginBody(employee.getEmployeeNo(), "wrong")))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("LOGIN_FAILED"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    String unknownNo =
        mockMvc
            .perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        loginBody(
                            "no-such-" + UUID.randomUUID().toString().substring(0, 8), PASSWORD)))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("LOGIN_FAILED"))
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(wrongPassword).isEqualTo(unknownNo);
  }
}
