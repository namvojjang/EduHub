package com.example.eduhub.enrollment;

import java.util.List;
import lombok.Value;

/** 수료 처리 결과: 처리된 사원 ID와 실패 사유 (FR-08). */
@Value
public class CompletionResponse {
  List<Long> processed;
  List<CompletionFailure> failed;
}
