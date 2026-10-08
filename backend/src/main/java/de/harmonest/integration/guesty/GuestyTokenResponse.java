package de.harmonest.integration.guesty;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * OAuth2 client-credentials token response from Guesty Open API.
 */
public record GuestyTokenResponse(
        @JsonProperty("access_token") String accessToken,
        @JsonProperty("token_type") String tokenType,
        @JsonProperty("expires_in") long expiresIn
) {
}
