package de.harmonest.domain.user;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface UserRepository extends MongoRepository<UserDocument, String> {

    Optional<UserDocument> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);
}
