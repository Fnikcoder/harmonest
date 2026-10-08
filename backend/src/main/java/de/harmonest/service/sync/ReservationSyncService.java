package de.harmonest.service.sync;

import de.harmonest.domain.reservation.ReservationDocument;
import de.harmonest.domain.reservation.ReservationRepository;
import de.harmonest.integration.guesty.GuestyApiClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class ReservationSyncService {

    private static final Logger log = LoggerFactory.getLogger(ReservationSyncService.class);

    private final GuestyApiClient guestyApiClient;
    private final ReservationRepository reservationRepository;

    public ReservationSyncService(
            GuestyApiClient guestyApiClient,
            ReservationRepository reservationRepository
    ) {
        this.guestyApiClient = guestyApiClient;
        this.reservationRepository = reservationRepository;
    }

    public SyncResult syncAll() {
        var payloads = guestyApiClient.fetchReservations();
        int created = 0;
        int updated = 0;

        for (Map<String, Object> payload : payloads) {
            String guestyId = extractGuestyId(payload);
            if (guestyId == null) {
                continue;
            }

            ReservationDocument doc = reservationRepository.findByGuestyReservationId(guestyId)
                    .orElseGet(ReservationDocument::new);

            boolean isNew = doc.getId() == null;
            doc.setGuestyReservationId(guestyId);
            doc.setGuestyPayload(payload);
            doc.setConfirmationCode(stringOrNull(payload.get("confirmationCode")));
            reservationRepository.save(doc);

            if (isNew) {
                created++;
            } else {
                updated++;
            }
        }

        log.info("Reservation sync finished: created={}, updated={}", created, updated);
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
