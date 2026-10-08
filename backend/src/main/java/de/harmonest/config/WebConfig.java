package de.harmonest.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Central CORS configuration so the Angular app can call this API during development
 * and from production check-in / management domains.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final HarmonestProperties properties;

    public WebConfig(HarmonestProperties properties) {
        this.properties = properties;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        var origins = properties.getCors().getAllowedOrigins();
        if (origins == null || origins.isEmpty()) {
            return;
        }

        registry.addMapping("/api/**")
                .allowedOrigins(origins.toArray(String[]::new))
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
