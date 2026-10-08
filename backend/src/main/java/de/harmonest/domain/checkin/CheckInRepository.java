package de.harmonest.domain.checkin;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface CheckInRepository extends MongoRepository<CheckInDocument, String> {

    Optional<CheckInDocument> findByConfirmationCodeIgnoreCase(String confirmationCode);
}
