# Guesty Status Verification for Door Access

## Overview

Before generating any QR codes or PIN codes, the system now **verifies the reservation status directly from Guesty** to ensure the reservation is still active. This prevents generating access codes for canceled or inactive reservations.

## Implementation

### QR Code Generation Verification

**File**: `functions/qr_code_notification/handler.py`

**Process**:
1. Receive QR code generation request
2. **Fetch latest status from Guesty API** using `_fetch_latest_reservation_status()`
3. Check reservation status:
   - `status == 0`: Canceled → **Block generation**
   - `status == 1`: Active → **Allow generation**
   - `status != 1`: Inactive → **Block generation**
4. Only proceed with QR/PIN generation if reservation is active

### Door Access Retrieval Verification

**File**: `functions/door_access/handler.py`

**Process**:
1. Receive request to retrieve door access codes
2. **Verify reservation is still active in Guesty**
3. Check reservation status:
   - `status == 0`: Canceled → **Return 410 Gone**
   - `status == 1`: Active → **Return codes**
   - `status != 1`: Inactive → **Return 410 Gone**
4. If Guesty API is down, continue with warning (don't block access)

## API Integration

### Guesty API Endpoint
```
POST https://api.guestyforhosts.com/getReservationDetailById
```

### Request Payload
```json
{
  "guestyId": false,
  "reservationId": "reservation_id_here",
  "userId": "guesty_user_id",
  "version": 3
}
```

### Response Structure
```json
{
  "success": true,
  "reservation": {
    "reservation": {
      "reservationId": "res123",
      "status": 1,  // 0=Canceled, 1=Active, 2+=Other
      "checkInDate": 1692123456789,
      "checkOutDate": 1692209856789,
      // ... other reservation details
    }
  }
}
```

## Status Codes

### Reservation Status Values
- **0**: Canceled
- **1**: Active/Confirmed
- **2+**: Other statuses (inactive)

### HTTP Response Codes

#### QR Code Generation
- **200**: Success - codes generated
- **400**: Bad request - reservation canceled/inactive
- **500**: Server error - Guesty API failure

#### Door Access Retrieval
- **200**: Success - codes returned
- **410**: Gone - reservation canceled/inactive
- **500**: Server error - Guesty API failure

## Error Handling

### QR Code Generation Errors

**Canceled Reservation**:
```json
{
  "statusCode": 400,
  "success": false,
  "message": "Cannot generate door access codes: reservation has been canceled in Guesty",
  "errorCode": "RESERVATION_CANCELED"
}
```

**Inactive Reservation**:
```json
{
  "statusCode": 400,
  "success": false,
  "message": "Cannot generate door access codes: reservation is not active in Guesty (status: 2)",
  "errorCode": "RESERVATION_CANCELED"
}
```

**Guesty API Failure**:
```json
{
  "statusCode": 500,
  "success": false,
  "message": "Failed to fetch latest reservation status from Guesty: API timeout",
  "errorCode": "INTERNAL_ERROR"
}
```

### Door Access Retrieval Errors

**Canceled Reservation**:
```json
{
  "statusCode": 410,
  "success": false,
  "message": "Reservation has been canceled in Guesty"
}
```

**Inactive Reservation**:
```json
{
  "statusCode": 410,
  "success": false,
  "message": "Reservation is not active in Guesty (status: 2)"
}
```

## Logging

### QR Code Generation Logs
```
Processing door access notification for reservation: res123
Fetching latest reservation status from Guesty for: res123
Reservation res123 is active in Guesty (status: 1)
Generated access codes for room Test Room: QR=true, PINs=2
```

### Door Access Retrieval Logs
```
Verifying reservation status in Guesty for: res123
Reservation res123 is active in Guesty (status: 1)
Door access codes retrieved for reservation res123
```

### Error Logs
```
Failed to fetch latest reservation status from Guesty: Connection timeout
Warning: Could not verify reservation status in Guesty: API unavailable
```

## Benefits

### Security
- Prevents access code generation for canceled reservations
- Ensures codes are only valid for active bookings
- Real-time verification against source of truth

### Guest Experience
- Prevents confusion from receiving codes for canceled bookings
- Ensures codes work when guests arrive
- Reduces support tickets from invalid access attempts

### Operational
- Reduces unnecessary QR code generation
- Prevents door access for canceled reservations
- Maintains data consistency with Guesty

## Monitoring

### Key Metrics
- Guesty API response times
- Verification success/failure rates
- Blocked generation attempts (canceled/inactive)
- API timeout/error rates

### Recommended Alerts
- High Guesty API failure rate
- Increased blocked generation attempts
- API response time degradation
- Authentication failures with Guesty

## Testing

### Unit Tests
- Active reservation allows generation
- Canceled reservation blocks generation
- Inactive reservation blocks generation
- Guesty API failure handling
- Door access retrieval verification

### Integration Tests
- End-to-end QR generation with Guesty verification
- Door access retrieval with status checking
- Error handling for various Guesty responses

## Fallback Behavior

### QR Code Generation
- **Strict**: Always blocks if Guesty verification fails
- **Reason**: Prevents generating codes for invalid reservations

### Door Access Retrieval
- **Graceful**: Continues with warning if Guesty API is down
- **Reason**: Don't block guest access if Guesty has temporary issues
- **Logging**: Warns about verification failure for monitoring

## Implementation Notes

### Performance
- Adds ~200-500ms to QR generation (Guesty API call)
- Cached authentication reduces overhead
- Timeout set to 45 seconds for reliability

### Reliability
- Uses existing `refresh_on_auth_error` for token refresh
- Proper error handling and logging
- Graceful degradation for door access retrieval

### Consistency
- Same verification logic as checkin process
- Consistent error codes and messages
- Unified logging format

This verification ensures that door access codes are only generated and provided for legitimate, active reservations, maintaining security and preventing guest confusion.
