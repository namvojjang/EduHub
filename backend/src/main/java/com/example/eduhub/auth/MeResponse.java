package com.example.eduhub.auth;

import lombok.Value;

/** 현재 사용자. 비밀번호 해시는 담지 않는다. */
@Value
public class MeResponse {
  Long employeeId;
  String employeeNo;
  String name;
  String role;

  public static MeResponse from(Employee employee) {
    return new MeResponse(
        employee.getId(), employee.getEmployeeNo(), employee.getName(), employee.getRole().name());
  }

  public static MeResponse from(CurrentUser user) {
    return new MeResponse(
        user.getEmployeeId(), user.getEmployeeNo(), user.getName(), user.getRole());
  }
}
