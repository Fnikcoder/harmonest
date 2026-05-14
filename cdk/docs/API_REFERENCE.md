# 🔌 Multi-Tenant Hotel Management System - API Reference

This document provides a comprehensive reference for the hotel management system API, including client-specific behavior and configuration-driven features.

## 🌐 **Base URL Structure**

The API base URL varies by client configuration:

```
https://{client-domain}/api
```

Examples:
- **HarmoNest**: `https://harmonest.de/api`
- **Alpine Lodge**: `https://alpinelodge.com/api`
- **Boutique Suites**: `https://boutiquesuites.com/api`

## 🔐 **Authentication & Headers**

### Required Headers

All API requests must include:

```http
Content-Type: application/json
X-Client-Name: {client-name}
```

### Optional Headers

```http
User-Agent: YourApp/1.0
X-Request-ID: unique-request-id
```

### Example Request

```bash
curl -X POST https://alpinelodge.com/api/checkin \
  -H "Content-Type: application/json" \
  -H "X-Client-Name: alpine-lodge" \
  -d '{"operation":"validate","reservationCode":"ABC123","guestFirstName":"John"}'
```

## 🏨 **Check-in API**

### POST /checkin

Submit or validate check-in information.

**Availability**: Only available if `features.checkin.enabled = true` in client configuration.

#### Validate Reservation

Validates a reservation code and guest name combination.

**Request:**
```json
{
  "operation": "validate",
  "reservationCode": "ABC123",
  "guestFirstName": "John"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Reservation validated successfully",
  "data": {
    "reservationId": "ALPINE1001",
    "guestName": "John Smith",
    "checkInDate": "2024-02-15",
    "checkOutDate": "2024-02-17",
    "listingTitle": "Mountain View Cabin",
    "canCheckIn": true,
    "deadlineHours": 24
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response (Not Found):**
```json
{
  "success": false,
  "message": "Reservation not found or guest name doesn't match",
  "errorCode": "RESERVATION_NOT_FOUND",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### Submit Check-in

Submits complete check-in information for a reservation.

**Request:**
```json
{
  "operation": "submit",
  "reservationId": "ALPINE1001",
  "guestName": "John",
  "guestLastName": "Smith",
  "guestEmail": "john.smith@example.com",
  "guestPhone": "+1234567890",
  "estimatedArrival": "15:00",
  "specialRequests": "Mountain view room please",
  "numberOfGuests": 2,
  "guestNames": ["John Smith", "Jane Smith"]
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Check-in submitted successfully",
  "data": {
    "checkinId": "CHECKIN_ALPINE1001_20240115",
    "reservationId": "ALPINE1001",
    "status": "submitted",
    "submittedAt": "2024-01-15T10:30:00Z",
    "qrCodeUrl": "https://alpine-lodge-storage.s3.amazonaws.com/qr-codes/ALPINE1001.png"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Configuration-Dependent Behavior:**
- **QR Code**: Only generated if `features.checkin.qrCodeEnabled = true`
- **Deadline**: Updates blocked within `features.checkin.deadlineHours` of check-in
- **Document Upload**: Available if `features.checkin.documentUpload.enabled = true`

### GET /checkin

Retrieve check-in status for a reservation.

**Parameters:**
- `reservationId` (required): The reservation ID

**Request:**
```bash
curl "https://alpinelodge.com/api/checkin?reservationId=ALPINE1001" \
  -H "X-Client-Name: alpine-lodge"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reservationId": "ALPINE1001",
    "status": "submitted",
    "guestName": "John Smith",
    "guestEmail": "john.smith@example.com",
    "estimatedArrival": "15:00",
    "submittedAt": "2024-01-15T10:30:00Z",
    "canUpdate": true,
    "qrCodeUrl": "https://alpine-lodge-storage.s3.amazonaws.com/qr-codes/ALPINE1001.png"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### PUT /checkin

Update check-in information (if within deadline).

**Request:**
```json
{
  "reservationId": "ALPINE1001",
  "guestPhone": "+1987654321",
  "estimatedArrival": "16:00",
  "specialRequests": "Late arrival, please hold room"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Check-in updated successfully",
  "data": {
    "reservationId": "ALPINE1001",
    "updatedAt": "2024-01-15T11:00:00Z"
  },
  "timestamp": "2024-01-15T11:00:00Z"
}
```

**Response (Deadline Exceeded):**
```json
{
  "success": false,
  "message": "Updates not allowed within 24 hours of check-in time",
  "errorCode": "UPDATE_DEADLINE_EXCEEDED",
  "timestamp": "2024-01-15T11:00:00Z"
}
```

## 🏠 **Public Listings API**

### GET /public/listings

Retrieve public listings information.

**Availability**: Only available if `features.listings.enabled = true` and `features.listings.publicListings = true`.

**Request:**
```bash
curl "https://alpinelodge.com/api/public/listings" \
  -H "X-Client-Name: alpine-lodge"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "client": "alpine-lodge",
    "clientDisplayName": "Alpine Lodge Resort",
    "dataSource": "alpine-lodge_api",
    "totalGroups": 5,
    "totalRooms": 15,
    "lastUpdated": "2024-01-15T09:00:00Z",
    "listings": [
      {
        "listingId": "CABIN001",
        "title": "Mountain View Cabin",
        "description": "Cozy cabin with stunning mountain views",
        "maxGuests": 4,
        "rooms": 2,
        "amenities": ["Mountain View", "Fireplace", "Hot Tub", "Ski Storage"]
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### GET /public/listings/search

Search available listings.

**Parameters:**
- `maxGuests` (optional): Maximum number of guests
- `checkIn` (optional): Check-in date (YYYY-MM-DD)
- `checkOut` (optional): Check-out date (YYYY-MM-DD)
- `amenities` (optional): Comma-separated list of required amenities

**Request:**
```bash
curl "https://alpinelodge.com/api/public/listings/search?maxGuests=4&checkIn=2024-02-01&checkOut=2024-02-03" \
  -H "X-Client-Name: alpine-lodge"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "searchCriteria": {
      "maxGuests": 4,
      "checkIn": "2024-02-01",
      "checkOut": "2024-02-03"
    },
    "results": [
      {
        "listingId": "CABIN001",
        "title": "Mountain View Cabin",
        "maxGuests": 4,
        "available": true,
        "pricePerNight": 250.00,
        "currency": "USD"
      }
    ],
    "totalResults": 1
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### GET /public/listings/{listingId}

Get details for a specific listing.

**Request:**
```bash
curl "https://alpinelodge.com/api/public/listings/CABIN001" \
  -H "X-Client-Name: alpine-lodge"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "listingId": "CABIN001",
    "title": "Mountain View Cabin",
    "description": "Cozy cabin with stunning mountain views and modern amenities",
    "maxGuests": 4,
    "rooms": 2,
    "bathrooms": 2,
    "amenities": ["Mountain View", "Fireplace", "Hot Tub", "Ski Storage", "WiFi"],
    "images": [
      "https://alpine-lodge-storage.s3.amazonaws.com/listings/CABIN001/image1.jpg"
    ],
    "policies": {
      "checkIn": "15:00",
      "checkOut": "11:00",
      "cancellation": "Free cancellation up to 24 hours before check-in"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 📧 **Email Verification API**

### POST /email/verification

Send or verify email verification codes.

#### Send Verification Code

**Request:**
```json
{
  "operation": "send",
  "email": "guest@alpinelodge.com",
  "type": "checkin",
  "language": "en"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification code sent successfully",
  "data": {
    "email": "guest@alpinelodge.com",
    "codeExpiry": "2024-01-15T10:40:00Z"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### Verify Code

**Request:**
```json
{
  "operation": "verify",
  "email": "guest@alpinelodge.com",
  "code": "123456"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "data": {
    "email": "guest@alpinelodge.com",
    "verified": true,
    "verifiedAt": "2024-01-15T10:35:00Z"
  },
  "timestamp": "2024-01-15T10:35:00Z"
}
```

**Response (Invalid Code):**
```json
{
  "success": false,
  "message": "Invalid or expired verification code",
  "errorCode": "INVALID_CODE",
  "timestamp": "2024-01-15T10:35:00Z"
}
```

## 🔍 **Health Check API**

### GET /health

Check API health and client configuration.

**Request:**
```bash
curl "https://alpinelodge.com/api/health" \
  -H "X-Client-Name: alpine-lodge"
```

**Response:**
```json
{
  "status": "healthy",
  "client": "alpine-lodge",
  "clientDisplayName": "Alpine Lodge Resort",
  "version": "1.0.0",
  "features": {
    "checkin": true,
    "reservations": true,
    "listings": true
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## ⚠️ **Error Responses**

### Standard Error Format

All error responses follow this format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "errorCode": "MACHINE_READABLE_CODE",
  "details": "Additional error details (optional)",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `FEATURE_DISABLED` | Requested feature is disabled for this client | 503 |
| `RESERVATION_NOT_FOUND` | Reservation not found or invalid | 404 |
| `INVALID_INPUT` | Request validation failed | 400 |
| `UPDATE_DEADLINE_EXCEEDED` | Update not allowed due to deadline | 409 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Server error | 500 |

### Feature-Specific Errors

#### Check-in Disabled

```json
{
  "success": false,
  "message": "Check-in feature is currently disabled for this client",
  "errorCode": "FEATURE_DISABLED",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### Public Listings Disabled

```json
{
  "success": false,
  "message": "Public listings are not available for this client",
  "errorCode": "FEATURE_DISABLED",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 🔄 **Rate Limiting**

### Default Limits

- **Per Client**: 1000 requests per minute
- **Per IP**: 100 requests per minute
- **Burst**: 2000 requests per minute

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642248600
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "message": "Rate limit exceeded. Please try again later.",
  "errorCode": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 🎨 **Client-Specific Behavior**

### Configuration-Driven Features

The API behavior changes based on client configuration:

#### Check-in Deadline

```json
// Client configuration
{
  "features": {
    "checkin": {
      "deadlineHours": 24  // Updates blocked 24 hours before check-in
    }
  }
}
```

#### QR Code Generation

```json
// Client configuration
{
  "features": {
    "checkin": {
      "qrCodeEnabled": true  // QR codes included in responses
    }
  }
}
```

#### Document Upload

```json
// Client configuration
{
  "features": {
    "checkin": {
      "documentUpload": {
        "enabled": true,
        "maxSizeMB": 10,
        "allowedTypes": ["pdf", "jpg", "png"]
      }
    }
  }
}
```

### Branding in Responses

Email templates and some responses include client-specific branding:

```json
{
  "success": true,
  "data": {
    "emailTemplate": {
      "fromName": "Alpine Lodge Resort",
      "primaryColor": "#2563eb",
      "logo": "https://alpine-lodge-storage.s3.amazonaws.com/branding/logo.png"
    }
  }
}
```

## 📊 **Response Metadata**

### Standard Metadata

All successful responses include:

```json
{
  "success": true,
  "data": { /* response data */ },
  "metadata": {
    "client": "alpine-lodge",
    "clientDisplayName": "Alpine Lodge Resort",
    "requestId": "req_123456789",
    "processingTime": 150,
    "version": "1.0.0"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Pagination (for list endpoints)

```json
{
  "success": true,
  "data": { /* paginated data */ },
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 45,
    "totalPages": 3,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

## 🔧 **Development & Testing**

### Testing Endpoints

Use these test values for development:

```json
{
  "reservationCode": "TEST123",
  "guestFirstName": "Test",
  "reservationId": "TEST_RESERVATION_001"
}
```

### Sandbox Mode

Add header for sandbox testing:

```http
X-Sandbox-Mode: true
```

This enables test data and prevents real integrations from being triggered.

---

## 📞 **Support**

For API support:
- **Documentation**: Check client-specific generated documentation
- **Validation**: Use configuration validation tools
- **Monitoring**: Review CloudWatch dashboards for API metrics
- **Logs**: Check CloudWatch logs for detailed error information

---

*This API reference is automatically updated based on client configurations. For client-specific API documentation, see the generated documentation in `docs/generated/{client-name}/api.md`.*
