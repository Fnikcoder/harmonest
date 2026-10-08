package de.harmonest.domain.user;

/**
 * Roles aligned with the Angular {@code AuthUser.role} union type.
 * <p>
 * Spring Security authorities are derived as {@code ROLE_<name>} in uppercase.
 */
public enum UserRole {
    SUPER_ADMIN,
    OWNER,
    ADMIN,
    SUPPORT,
    USER,
    GUEST
}
