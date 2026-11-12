package com.example.eduhub.enrollment;

import javax.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 수강 신청 요청 (FR-04). */
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class EnrollmentRequest {

  @NotNull private Long sessionId;
}
