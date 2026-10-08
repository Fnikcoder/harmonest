package de.harmonest.domain.checkin;

import de.harmonest.domain.common.AuditableDocument;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Guest check-in session — links reservation, email verification, proof image, and notification schedule.
 */
@Getter
@Setter
@Document(collection = "checkins")
public class CheckInDocument extends AuditableDocument {

    @Id
    private String id;

    @Indexed
    private String reservationId;

    @Indexed
    private String confirmationCode;

    private CheckInStatus status = CheckInStatus.DRAFT;

    private String guestEmail;
    private boolean emailVerified;

    /** Storage key / URL for ID or proof image — populated after upload. */
    private String proofImageRef;

    private Instant completedAt;

    /** Reference to a scheduled notification job, if any. */
    private String scheduledNotificationId;
}
