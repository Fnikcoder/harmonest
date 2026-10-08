package de.harmonest.infrastructure.storage;

import de.harmonest.config.HarmonestProperties;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

/**
 * Stores guest proof-of-identity images on local disk (dev) — swap for S3 in production.
 */
@Component
public class ProofImageStorage {

    private final HarmonestProperties properties;

    public ProofImageStorage(HarmonestProperties properties) {
        this.properties = properties;
    }

    public String store(String checkInId, MultipartFile file) {
        try {
            Path base = Path.of(properties.getStorage().getLocalBasePath(), "checkin", checkInId);
            Files.createDirectories(base);

            String filename = UUID.randomUUID() + "_" + sanitize(file.getOriginalFilename());
            Path target = base.resolve(filename);
            file.transferTo(target);

            return target.toString();
        } catch (IOException e) {
            throw new StorageException("Failed to store proof image", e);
        }
    }

    private static String sanitize(String name) {
        if (name == null) {
            return "upload";
        }
        return name.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
