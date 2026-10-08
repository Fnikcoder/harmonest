package de.harmonest;

import de.harmonest.config.HarmonestProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Entry point for the Harmonest Spring Boot backend.
 * <p>
 * This service replaces the fragmented AWS Lambda + API Gateway setup with a single
 * deployable application responsible for:
 * <ul>
 *   <li>Syncing listings and reservations from <strong>Guesty Open API</strong> (not G4H)</li>
 *   <li>Guest check-in (validation, proof image, email verification, scheduling)</li>
 *   <li>Sending access / notification emails</li>
 *   <li>Management authentication (JWT) for the Angular frontend</li>
 * </ul>
 * <p>
 * Data models and exact request/response shapes are intentionally minimal here;
 * you will refine them as the frontend contract stabilizes.
 */
@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(HarmonestProperties.class)
public class HarmonestApplication {

    public static void main(String[] args) {
        SpringApplication.run(HarmonestApplication.class, args);
    }
}
