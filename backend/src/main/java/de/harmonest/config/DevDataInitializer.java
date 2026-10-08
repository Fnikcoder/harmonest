package de.harmonest.config;

import de.harmonest.domain.user.UserDocument;
import de.harmonest.domain.user.UserRepository;
import de.harmonest.domain.user.UserRole;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Seeds a default admin user in local/docker profiles for first login.
 * <p>
 * Credentials: {@code admin@harmonest.de} / {@code changeme} — change immediately.
 */
@Configuration
@Profile({"default", "docker"})
public class DevDataInitializer {

    private static final Logger log = LoggerFactory.getLogger(DevDataInitializer.class);

    @Bean
    CommandLineRunner seedAdminUser(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            String email = "admin@harmonest.de";
            if (userRepository.existsByEmailIgnoreCase(email)) {
                return;
            }

            UserDocument admin = new UserDocument();
            admin.setEmail(email);
            admin.setPasswordHash(passwordEncoder.encode("changeme"));
            admin.setFirstName("HarmoNest");
            admin.setLastName("Admin");
            admin.setRole(UserRole.SUPER_ADMIN);
            admin.setEmailVerified(true);
            admin.setEnabled(true);
            userRepository.save(admin);

            log.warn("Created dev admin user {} — password: changeme (change in production!)", email);
        };
    }
}
