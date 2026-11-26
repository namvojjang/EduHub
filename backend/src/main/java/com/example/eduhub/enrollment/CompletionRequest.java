package com.example.eduhub.enrollment;

import java.util.List;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 수료·미수료 처리 요청 (FR-08, D-05). */
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class CompletionRequest {

  @NotNull private CompletionOutcome result;

  @NotEmpty
  @Size(max = 200)
  private List<@NotNull Long> employeeIds;
}
