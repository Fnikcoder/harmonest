package de.harmonest.domain.reservation;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface ReservationRepository extends MongoRepository<ReservationDocument, String> {

    Optional<ReservationDocument> findByConfirmationCodeIgnoreCase(String confirmationCode);

    Optional<ReservationDocument> findByGuestyReservationId(String guestyReservationId);
}
