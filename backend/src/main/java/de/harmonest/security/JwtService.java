package de.harmonest.security;

import de.harmonest.config.HarmonestProperties;
import de.harmonest.domain.user.UserDocument;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

/**
 * Issues and validates JWT access tokens for the management UI.
 * <p>
 * Refresh tokens use a separate claim {@code typ=refresh} so we can apply
 * different TTL and validation rules later (rotation, revocation list).
 */
@Service
public class JwtService {

    public static final String CLAIM_ROLE = "role";
    public static final String CLAIM_TYP = "typ";
    public static final String TYP_ACCESS = "access";
    public static final String TYP_REFRESH = "refresh";

    private final HarmonestProperties properties;
    private final SecretKey signingKey;

    public JwtService(HarmonestProperties properties) {
        this.properties = properties;
        this.signingKey = buildSigningKey(properties.getSecurity().getJwt().getSecret());
    }

    public String createAccessToken(UserDocument user) {
        var jwt = properties.getSecurity().getJwt();
        Instant now = Instant.now();
        Instant expiry = now.plusSeconds(jwt.getAccessTokenTtlMinutes() * 60);

        return Jwts.builder()
                .subject(user.getId())
                .claim(CLAIM_ROLE, user.getRole().name())
                .claim(CLAIM_TYP, TYP_ACCESS)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .id(UUID.randomUUID().toString())
                .signWith(signingKey)
                .compact();
    }

    public String createRefreshToken(UserDocument user) {
        var jwt = properties.getSecurity().getJwt();
        Instant now = Instant.now();
        Instant expiry = now.plusSeconds(jwt.getRefreshTokenTtlDays() * 24 * 3600);

        return Jwts.builder()
                .subject(user.getId())
                .claim(CLAIM_TYP, TYP_REFRESH)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .id(UUID.randomUUID().toString())
                .signWith(signingKey)
                .compact();
    }

    public Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public boolean isAccessToken(Claims claims) {
        return TYP_ACCESS.equals(claims.get(CLAIM_TYP, String.class));
    }

    private static SecretKey buildSigningKey(String secret) {
        if (secret == null || secret.length() < 32) {
            throw new IllegalStateException(
                    "harmonest.security.jwt.secret must be at least 32 characters");
        }
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
