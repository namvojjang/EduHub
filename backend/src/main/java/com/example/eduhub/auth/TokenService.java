package com.example.eduhub.auth;

import java.time.Clock;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/** 로그인한 사원에게 JWT(HS256)를 발급한다 (NFR-03). 토큰·키는 로그에 남기지 않는다. */
@Service
public class TokenService {

  private final JwtEncoder jwtEncoder;
  private final long ttlMinutes;
  private final Clock clock;

  @Autowired
  public TokenService(
      JwtEncoder jwtEncoder, @Value("${eduhub.jwt.ttl-minutes:60}") long ttlMinutes) {
    this(jwtEncoder, ttlMinutes, Clock.systemUTC());
  }

  /** 테스트에서 만료된 토큰을 만들 수 있도록 시계를 받는다. */
  public TokenService(JwtEncoder jwtEncoder, long ttlMinutes, Clock clock) {
    this.jwtEncoder = jwtEncoder;
    this.ttlMinutes = ttlMinutes;
    this.clock = clock;
  }

  public String issue(Employee employee) {
    Instant now = clock.instant();
    JwtClaimsSet claims =
        JwtClaimsSet.builder()
            .issuer("eduhub")
            .subject(String.valueOf(employee.getId()))
            .claim("employeeNo", employee.getEmployeeNo())
            .claim("name", employee.getName())
            .claim("role", employee.getRole().name())
            .issuedAt(now)
            .expiresAt(now.plusSeconds(ttlSeconds()))
            .build();
    return jwtEncoder
        .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
        .getTokenValue();
  }

  public long ttlSeconds() {
    return ttlMinutes * 60;
  }
}
