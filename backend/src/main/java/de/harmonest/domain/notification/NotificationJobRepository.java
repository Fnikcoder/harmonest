package de.harmonest.domain.notification;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;

public interface NotificationJobRepository extends MongoRepository<NotificationJobDocument, String> {

    List<NotificationJobDocument> findByStatusAndScheduledAtBefore(
            NotificationJobStatus status,
            Instant before
    );
}
