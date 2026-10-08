package de.harmonest.service.sync;

import de.harmonest.domain.listing.ListingDocument;
import de.harmonest.domain.listing.ListingRepository;
import de.harmonest.integration.guesty.GuestyApiClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Pulls listings from Guesty Open API and upserts MongoDB documents.
 * <p>
 * Mapping logic will expand once you define the canonical listing shape.
 */
@Service
public class ListingSyncService {

    private static final Logger log = LoggerFactory.getLogger(ListingSyncService.class);

    private final GuestyApiClient guestyApiClient;
    private final ListingRepository listingRepository;

    public ListingSyncService(GuestyApiClient guestyApiClient, ListingRepository listingRepository) {
        this.guestyApiClient = guestyApiClient;
        this.listingRepository = listingRepository;
    }

    public SyncResult syncAll() {
        var payloads = guestyApiClient.fetchListings();
        int created = 0;
        int updated = 0;

        for (Map<String, Object> payload : payloads) {
            String guestyId = extractGuestyId(payload);
            if (guestyId == null) {
                log.warn("Skipping listing without id: {}", payload.keySet());
                continue;
            }

            ListingDocument doc = listingRepository.findByGuestyListingId(guestyId)
                    .orElseGet(ListingDocument::new);

            boolean isNew = doc.getId() == null;
            doc.setGuestyListingId(guestyId);
            doc.setGuestyPayload(payload);
            doc.setTitle(stringOrNull(payload.get("title")));
            doc.setNickname(stringOrNull(payload.get("nickname")));
            listingRepository.save(doc);

            if (isNew) {
                created++;
            } else {
                updated++;
            }
        }

        log.info("Listing sync finished: created={}, updated={}, fetched={}", created, updated, payloads.size());
        return new SyncResult(created, updated, payloads.size());
    }

    private static String extractGuestyId(Map<String, Object> payload) {
        Object id = payload.get("_id");
        if (id == null) {
            id = payload.get("id");
        }
        return id != null ? id.toString() : null;
    }

    private static String stringOrNull(Object value) {
        return value != null ? value.toString() : null;
    }
}
