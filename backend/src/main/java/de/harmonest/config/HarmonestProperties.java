package de.harmonest.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * Type-safe binding for {@code harmonest.*} settings in {@code application.yml}.
 * <p>
 * Keeping configuration in one place avoids scattering {@code @Value} injections
 * across the codebase — a pattern senior teams use so environment differences
 * (local, Docker, prod) stay predictable.
 */
@ConfigurationProperties(prefix = "harmonest")
public class HarmonestProperties {

    private final Cors cors = new Cors();
    private final Security security = new Security();
    private final Guesty guesty = new Guesty();
    private final Storage storage = new Storage();
    private final Checkin checkin = new Checkin();

    public Cors getCors() {
        return cors;
    }

    public Security getSecurity() {
        return security;
    }

    public Guesty getGuesty() {
        return guesty;
    }

    public Storage getStorage() {
        return storage;
    }

    public Checkin getCheckin() {
        return checkin;
    }

    public static class Cors {
        /** Origins allowed to call the API from a browser (Angular dev server + prod domains). */
        private List<String> allowedOrigins = List.of();

        public List<String> getAllowedOrigins() {
            return allowedOrigins;
        }

        public void setAllowedOrigins(List<String> allowedOrigins) {
            this.allowedOrigins = allowedOrigins;
        }
    }

    public static class Security {
        private final Jwt jwt = new Jwt();

        public Jwt getJwt() {
            return jwt;
        }

        public static class Jwt {
            private String secret;
            private long accessTokenTtlMinutes = 60;
            private long refreshTokenTtlDays = 7;

            public String getSecret() {
                return secret;
            }

            public void setSecret(String secret) {
                this.secret = secret;
            }

            public long getAccessTokenTtlMinutes() {
                return accessTokenTtlMinutes;
            }

            public void setAccessTokenTtlMinutes(long accessTokenTtlMinutes) {
                this.accessTokenTtlMinutes = accessTokenTtlMinutes;
            }

            public long getRefreshTokenTtlDays() {
                return refreshTokenTtlDays;
            }

            public void setRefreshTokenTtlDays(long refreshTokenTtlDays) {
                this.refreshTokenTtlDays = refreshTokenTtlDays;
            }
        }
    }

    /**
     * Guesty Open API (OAuth2) — separate from legacy GuestyForHosts (G4H).
     */
    public static class Guesty {
        private String baseUrl;
        private String tokenUrl;
        private String clientId;
        private String clientSecret;
        private String listingsPath;
        private String reservationsPath;

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }

        public String getTokenUrl() {
            return tokenUrl;
        }

        public void setTokenUrl(String tokenUrl) {
            this.tokenUrl = tokenUrl;
        }

        public String getClientId() {
            return clientId;
        }

        public void setClientId(String clientId) {
            this.clientId = clientId;
        }

        public String getClientSecret() {
            return clientSecret;
        }

        public void setClientSecret(String clientSecret) {
            this.clientSecret = clientSecret;
        }

        public String getListingsPath() {
            return listingsPath;
        }

        public void setListingsPath(String listingsPath) {
            this.listingsPath = listingsPath;
        }

        public String getReservationsPath() {
            return reservationsPath;
        }

        public void setReservationsPath(String reservationsPath) {
            this.reservationsPath = reservationsPath;
        }
    }

    public static class Storage {
        /** {@code local} today; {@code s3} when we wire object storage. */
        private String type = "local";
        private String localBasePath = "./data/uploads";

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public String getLocalBasePath() {
            return localBasePath;
        }

        public void setLocalBasePath(String localBasePath) {
            this.localBasePath = localBasePath;
        }
    }

    public static class Checkin {
        private int notificationLeadHours = 24;

        public int getNotificationLeadHours() {
            return notificationLeadHours;
        }

        public void setNotificationLeadHours(int notificationLeadHours) {
            this.notificationLeadHours = notificationLeadHours;
        }
    }
}
