package de.harmonest.domain.listing;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface ListingRepository extends MongoRepository<ListingDocument, String> {

    Optional<ListingDocument> findByGuestyListingId(String guestyListingId);
}
