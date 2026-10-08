package de.harmonest.domain.user;

import de.harmonest.domain.common.AuditableDocument;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.HashSet;
import java.util.Set;

/**
 * Management user stored in MongoDB (replaces Cognito for the new backend).
 * <p>
 * Passwords are stored as BCrypt hashes only — never plaintext.
 */
@Getter
@Setter
@Document(collection = "users")
public class UserDocument extends AuditableDocument {

    @Id
    private String id;

    @Indexed(unique = true)
    private String email;

    private String passwordHash;

    private String firstName;
    private String lastName;

    private UserRole role = UserRole.ADMIN;

    private boolean emailVerified;
    private boolean enabled = true;

    /** Optional refresh-token family id for rotation / revocation. */
    private Set<String> activeRefreshTokenIds = new HashSet<>();
}
