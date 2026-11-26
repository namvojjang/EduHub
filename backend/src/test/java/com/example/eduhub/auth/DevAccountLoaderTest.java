package com.example.eduhub.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

class DevAccountLoaderTest {

  private final EmployeeRepository repository = mock(EmployeeRepository.class);
  private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);
  private final DevAccountLoader loader = new DevAccountLoader(repository, encoder);
  private final ApplicationArguments args = mock(ApplicationArguments.class);

  @Test
  void createsThreeAccountsWhenEmpty() {
    when(repository.count()).thenReturn(0L);

    loader.run(args);

    ArgumentCaptor<Employee> captor = ArgumentCaptor.forClass(Employee.class);
    verify(repository, times(3)).save(captor.capture());
    List<Employee> saved = captor.getAllValues();
    assertThat(saved)
        .extracting(Employee::getEmployeeNo)
        .containsExactly("E1001", "E1002", "A0001");
    assertThat(saved)
        .extracting(Employee::getRole)
        .containsExactly(EmployeeRole.EMPLOYEE, EmployeeRole.EMPLOYEE, EmployeeRole.ADMIN);
    for (Employee e : saved) {
      assertThat(e.getPasswordHash()).isNotEqualTo("dev-password");
      assertThat(encoder.matches("dev-password", e.getPasswordHash())).isTrue();
    }
  }

  @Test
  void skipsWhenAccountsExist() {
    when(repository.count()).thenReturn(3L);

    loader.run(args);

    verify(repository, never()).save(any(Employee.class));
  }
}
