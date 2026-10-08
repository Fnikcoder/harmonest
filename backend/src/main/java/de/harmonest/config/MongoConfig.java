package de.harmonest.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.config.EnableMongoAuditing;

/**
 * Enables {@link org.springframework.data.annotation.CreatedDate} on documents.
 */
@Configuration
@EnableMongoAuditing
public class MongoConfig {
}
