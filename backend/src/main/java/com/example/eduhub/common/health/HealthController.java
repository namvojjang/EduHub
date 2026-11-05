package com.example.eduhub.common.health;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Collections;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Health", description = "서버 상태 확인")
@RestController
@RequestMapping("/api/health")
public class HealthController {

  @Operation(summary = "서버 상태 확인", description = "서버가 요청을 받을 수 있으면 status=UP을 돌려준다.")
  @GetMapping
  public Map<String, String> health() {
    return Collections.singletonMap("status", "UP");
  }
}
