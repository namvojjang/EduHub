package com.example.eduhub.auth;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class LoginRequest {

  @NotBlank
  @Size(max = 20)
  private String employeeNo;

  @NotBlank
  @Size(max = 100)
  private String password;
}
