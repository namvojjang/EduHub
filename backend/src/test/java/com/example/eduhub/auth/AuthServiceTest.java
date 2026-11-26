package com.example.eduhub.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.example.eduhub.common.error.UnauthorizedException;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthServiceTest {

  @Mock private EmployeeRepository employeeRepository;
  @Mock private TokenService tokenService;

  private PasswordEncoder passwordEncoder;
  private AuthService authService;
  private Employee employee;

  @BeforeEach
  void setUp() {
    passwordEncoder = spy(new BCryptPasswordEncoder());
    employee =
        Employee.create("E9999", "테스트", passwordEncoder.encode("right-pw"), EmployeeRole.EMPLOYEE);
    given(employeeRepository.findByEmployeeNo("E9999")).willReturn(Optional.of(employee));
    given(employeeRepository.findByEmployeeNo("NOPE")).willReturn(Optional.empty());
    given(tokenService.issue(employee)).willReturn("token-value");
    given(tokenService.ttlSeconds()).willReturn(3600L);
    authService = new AuthService(employeeRepository, passwordEncoder, tokenService);
  }

  @Test
  void loginWithCorrectPasswordIssuesToken() {
    LoginResponse response = authService.login("E9999", "right-pw");

    assertThat(response.getAccessToken()).isEqualTo("token-value");
    assertThat(response.getTokenType()).isEqualTo("Bearer");
    assertThat(response.getExpiresIn()).isEqualTo(3600L);
    assertThat(response.getUser().getEmployeeNo()).isEqualTo("E9999");
    assertThat(response.getUser().getRole()).isEqualTo("EMPLOYEE");
  }

  @Test
  void unknownEmployeeNoIsLoginFailed() {
    UnauthorizedException e =
        catchThrowableOfType(() -> authService.login("NOPE", "any"), UnauthorizedException.class);

    assertThat(e).isNotNull();
    assertThat(e.getCode()).isEqualTo("LOGIN_FAILED");
  }

  @Test
  void wrongPasswordIsLoginFailed() {
    UnauthorizedException e =
        catchThrowableOfType(
            () -> authService.login("E9999", "wrong-pw"), UnauthorizedException.class);

    assertThat(e).isNotNull();
    assertThat(e.getCode()).isEqualTo("LOGIN_FAILED");
  }

  @Test
  void failureMessagesAreIdentical() {
    UnauthorizedException unknown =
        catchThrowableOfType(() -> authService.login("NOPE", "x"), UnauthorizedException.class);
    UnauthorizedException wrong =
        catchThrowableOfType(() -> authService.login("E9999", "x"), UnauthorizedException.class);

    assertThat(unknown.getCode()).isEqualTo(wrong.getCode());
    assertThat(unknown.getMessage()).isEqualTo(wrong.getMessage());
  }

  @Test
  void unknownEmployeeNoStillChecksPassword() {
    org.mockito.Mockito.clearInvocations(passwordEncoder);

    catchThrowableOfType(() -> authService.login("NOPE", "any"), UnauthorizedException.class);

    verify(passwordEncoder, times(1)).matches(anyString(), anyString());
  }
}
