package de.harmonest.domain.listing;

import de.harmonest.domain.common.AuditableDocument;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Map;

/**
 * A property / room synced from Guesty Open API.
 * <p>
 * {@code guestyPayload} holds the raw API response until you finalize the denormalized
 * fields the frontend grid needs. We intentionally avoid G4H field names here.
 */
@Getter
@Setter
@Document(collection = "listings")
public class ListingDocument extends AuditableDocument {

    @Id
    private String id;

    /** Guesty listing id (e.g. Mongo ObjectId string from their API). */
    @Indexed(unique = true)
    private String guestyListingId;

    private String title;
    private String nickname;
    private boolean active = true;

    /**
     * Full Guesty listing JSON — schema version and source metadata live inside
     * until the contract is frozen.
     */
    private Map<String, Object> guestyPayload;

    private int guestySchemaVersion = 2;
    private String guestySource = "guesty-open-api";
}
