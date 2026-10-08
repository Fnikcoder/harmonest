package de.harmonest.integration.guesty;

import de.harmonest.config.HarmonestProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

/**
 * HTTP client for <strong>Guesty Open API</strong> (OAuth2 client credentials).
 * <p>
 * This is <em>not</em> GuestyForHosts (G4H). Token and resource URLs come from
 * {@link HarmonestProperties.Guesty}.
 * <p>
 * Sync implementations will call {@link #fetchListings()} and {@link #fetchReservations()}
 * once you confirm pagination and field mapping.
 */
@Component
public class GuestyApiClient {

    private static final Logger log = LoggerFactory.getLogger(GuestyApiClient.class);

    private final HarmonestProperties properties;
    private final RestClient restClient;

    /** Cached bearer token — refreshed before expiry. */
    private final AtomicReference<CachedToken> tokenCache = new AtomicReference<>();

    public GuestyApiClient(HarmonestProperties properties) {
        this.properties = properties;
        this.restClient = RestClient.builder().build();
    }

    /**
     * Placeholder: returns empty list until Guesty listing endpoint contract is defined.
     */
    public List<Map<String, Object>> fetchListings() {
        ensureCredentialsConfigured();
        String token = getAccessToken();
        log.debug("Fetching listings from Guesty (token present: {})", token != null);

        // TODO: implement pagination + map to ListingDocument when API shape is confirmed.
        return List.of();
    }

    /**
     * Placeholder: returns empty list until Guesty reservations endpoint contract is defined.
     */
    public List<Map<String, Object>> fetchReservations() {
        ensureCredentialsConfigured();
        String token = getAccessToken();
        log.debug("Fetching reservations from Guesty (token present: {})", token != null);

        // TODO: implement pagination + map to ReservationDocument.
        return List.of();
    }

    private void ensureCredentialsConfigured() {
        var guesty = properties.getGuesty();
        if (guesty.getClientId() == null || guesty.getClientId().isBlank()
                || guesty.getClientSecret() == null || guesty.getClientSecret().isBlank()) {
            throw new GuestyConfigurationException(
                    "GUESTY_CLIENT_ID and GUESTY_CLIENT_SECRET must be set to call Guesty Open API");
        }
    }

    /**
     * Obtains or reuses an OAuth2 access token (client credentials grant).
     */
    public String getAccessToken() {
        CachedToken cached = tokenCache.get();
        if (cached != null && cached.expiresAt().isAfter(Instant.now().plusSeconds(60))) {
            return cached.accessToken();
        }

        var guesty = properties.getGuesty();
        var form = new LinkedMultiValueMap<String, String>();
        form.add("grant_type", "client_credentials");
        form.add("client_id", guesty.getClientId());
        form.add("client_secret", guesty.getClientSecret());
        form.add("scope", "open-api");

        GuestyTokenResponse response = restClient.post()
                .uri(guesty.getTokenUrl())
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(GuestyTokenResponse.class);

        if (response == null || response.accessToken() == null) {
            throw new GuestyApiException("Guesty token endpoint returned an empty response");
        }

        Instant expiresAt = Instant.now().plusSeconds(Math.max(60, response.expiresIn()));
        tokenCache.set(new CachedToken(response.accessToken(), expiresAt));
        return response.accessToken();
    }

    private record CachedToken(String accessToken, Instant expiresAt) {
    }
}
