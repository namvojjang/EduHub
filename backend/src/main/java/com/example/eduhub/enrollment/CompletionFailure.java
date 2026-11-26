package com.example.eduhub.enrollment;

import lombok.Value;

/** 수료 처리에 실패한 사원과 사유 (FR-08). code: NOT_ENROLLED, WAITING, CANCELLED, ALREADY_RECORDED. */
@Value
public class CompletionFailure {
  Long employeeId;
  String code;
  String reason;
}
