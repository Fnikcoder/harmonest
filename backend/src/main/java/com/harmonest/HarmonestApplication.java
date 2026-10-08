package com.harmonest;

import com.harmonest.config.HarmonestProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Entry point for the HarmoNest Spring Boot application.
 * <p>
 * This service replaces the previous Lambda/CDK stack for four responsibilities only:
 * <ol>
 *   <li>Sync listings from Guesty → MongoDB</li>
 *   <li>Sync reservations from Guesty → MongoDB</li>
 *   <li>Guest check-in (validate, store ID image, schedule access notification)</li>
 *   <li>Send door-access notification emails when scheduled time arrives</li>
 * </ol>
 * <p>
 * {@link EnableScheduling} activates {@code @Scheduled} beans (sync + notification dispatcher).
 * Configuration is externalized under the {@code harmonest.*} prefix — see {@link HarmonestProperties}.
 */
@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(HarmonestProperties.class)
public class HarmonestApplication {

    public static void main(String[] args) {
        SpringApplication.run(HarmonestApplication.class, args);
    }
}
