package de.harmonest.domain.reservation;

import de.harmonest.domain.common.AuditableDocument;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

/**
 * Reservation synced from Guesty (reservations-reports list + optional fegw detail).
 * <p>
 * {@link #guestyPayload} stores the native API row; top-level fields are denormalized for queries.
 */
@Getter
@Setter
@Document(collection = "reservations")
public class ReservationDocument extends AuditableDocument {

    @Id
    private String id;

    @Indexed(unique = true)
    private String guestyReservationId;

    @Indexed
    private String accountId;

    @Indexed
    private String confirmationCode;

    @Indexed
    private String guestyListingId;

    private String listingName;
    private String listingImageUrl;

    private String guestEmail;
    private String guestFirstName;
    private String guestLastName;
    private String guestFullName;

    private Integer guestsCount;

    private Instant checkIn;
    private Instant checkOut;
    private String checkInDisplay;
    private String checkOutDisplay;
    private String timezone;

    /** Guesty status string, e.g. confirmed */
    private String guestyStatus;

    /** Channel key from reports, e.g. Booking.com, airbnb2, vrboLite */
    private String platform;

    private String currency;
    private BigDecimal hostPayout;
    private BigDecimal totalPaid;

    /** Legacy numeric status for compatibility (1 active, 0 canceled) */
    private Integer status;

    /** Native Guesty JSON (reservations-reports row or merged with fegw detail). */
    private Map<String, Object> guestyPayload;

    private int guestySchemaVersion = 2;

    /** reservations-reports | reservations-fegw | legacy-g4h */
    private String guestySource = "reservations-reports";
}
