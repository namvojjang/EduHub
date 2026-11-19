package com.example.eduhub.auth;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

/** JWT 서명 키(NFR-03, NFR-06). 환경 변수 EDUHUB_JWT_SECRET에서 읽고, 32바이트 미만이면 기동을 실패시킨다. */
@Configuration
public class JwtConfig {

  private static final int MIN_KEY_BYTES = 32;

  private final SecretKey key;

  public JwtConfig(@Value("${eduhub.jwt.secret}") String secret) {
    byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
    if (bytes.length < MIN_KEY_BYTES) {
      // 키 값은 메시지에 넣지 않는다.
      throw new IllegalStateException("EDUHUB_JWT_SECRET은 32바이트 이상이어야 합니다.");
    }
    this.key = new SecretKeySpec(bytes, "HmacSHA256");
  }

  @Bean
  public JwtEncoder jwtEncoder() {
    return new NimbusJwtEncoder(new ImmutableSecret<>(key));
  }

  @Bean
  public JwtDecoder jwtDecoder() {
    return NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
  }
}
