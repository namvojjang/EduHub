package com.example.eduhub.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;

class JwtConfigTest {

  private static final String KEY_A = "0123456789-0123456789-0123456789-AAAA";
  private static final String KEY_B = "9876543210-9876543210-9876543210-BBBB";

  private String issue(JwtConfig config, String subject) {
    Instant now = Instant.now();
    JwtClaimsSet claims =
        JwtClaimsSet.builder()
            .issuer("eduhub")
            .subject(subject)
            .issuedAt(now)
            .expiresAt(now.plusSeconds(60))
            .build();
    return config
        .jwtEncoder()
        .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
        .getTokenValue();
  }

  @Test
  void shortSecretIsRejected() {
    String shortSecret = "0123456789012345678901234567890"; // 31바이트

    assertThatThrownBy(() -> new JwtConfig(shortSecret))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageNotContaining(shortSecret);
  }

  @Test
  void encodedTokenIsDecodedWithSameKey() {
    JwtConfig config = new JwtConfig(KEY_A);

    Jwt jwt = config.jwtDecoder().decode(issue(config, "42"));

    assertThat(jwt.getSubject()).isEqualTo("42");
  }

  @Test
  void tokenSignedWithOtherKeyIsRejected() {
    String token = issue(new JwtConfig(KEY_B), "42");

    assertThatThrownBy(() -> new JwtConfig(KEY_A).jwtDecoder().decode(token))
        .isInstanceOf(JwtException.class);
  }
}
