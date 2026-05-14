# HarmoNest Check-in API Documentation

## Overview

The HarmoNest Check-in API provides online check-in functionality for hotel reservations. It allows guests to validate their reservations, submit check-in information, and upload identification documents.

## API Endpoint

**Base URL**: `https://179a2g0pgk.execute-api.eu-central-1.amazonaws.com/prod/checkin`

## Authentication

No authentication required for guest check-in operations.

## CORS Support

The API supports requests from:
- `https://harmonest.de`
- `https://www.harmonest.de`
- `https://dev.harmonest.de`
- `https://www.dev.harmonest.de`
- `http://localhost:4200` (for local testing)

## Operations

### 1. Validate Reservation

Validates a reservation using reservation code and guest first name.

**Endpoint**: `POST /checkin`

**Request Body**:
```json
{
  "operation": "validate",
  "reservationCode": "608175568",
  "guestFirstName": "farhad"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Reservation validated successfully. Please provide your current guest information.",
  "data": {
    "reservation": {
      "reservationCode": "608175568",
      "reservationId": "09458725-8b63-4222-9cac-dc9f826df50a",
      "checkInDate": 1759449600000,
      "checkOutDate": 1759536000000,
      "roomName": "Deluxe Room",
      "roomAlias": "room1",
      "originalGuestName": "farhad",
      "originalGuestSurname": "surname",
      "originalEmail": "original@email.com",
      "originalPhoneNumber": "+49 123456789"
    },
    "checkin": {
      "exists": true,
      "status": "pending",
      "canUpdate": true,
      "requiresGuestInfo": true,
      "currentFirstName": "",
      "currentLastName": "",
      "currentEmail": "",
      "currentPhone": ""
    }
  },
  "timestamp": 1755183057016
}
```

**Behavior**:
- Creates a minimal pending check-in record if none exists
- Does NOT pre-fill guest data from reservation
- Frontend must collect current guest information
- Sets status to "pending"

### 2. Submit Check-in

Submits complete check-in information including ID document.

**Endpoint**: `POST /checkin`

**Request Body**:
```json
{
  "operation": "submit",
  "reservationCode": "608175568",
  "firstName": "Farhad Updated",
  "lastName": "New Surname",
  "email": "new@email.com",
  "phone": "+49 new number",
  "idCardFile": "base64-encoded-image-data",
  "fileExtension": "jpg"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Check-in completed successfully",
  "data": {
    "reservationCode": "608175568",
    "reservationId": "09458725-8b63-4222-9cac-dc9f826df50a",
    "status": "completed",
    "message": "Thank you! Your check-in has been completed successfully. The QR code for the doors will be sent to you 24 hours before your check-in on [DATE].",
    "qrCodeDelivery": {
      "timing": "24_hours_before", // or "15_minutes"
      "scheduledTime": 1759363200000,
      "checkInDate": 1759449600000
    }
  },
  "timestamp": 1755183057016
}
```

**Response Messages:**
- **Normal case (>24h before check-in)**: "Thank you! Your check-in has been completed successfully. The QR code for the doors will be sent to you 24 hours before your check-in on [DATE]."
- **Late case (<24h before check-in)**: "Thank you! Your check-in has been completed successfully. The QR code for the doors will be sent to you in the next 15 minutes."

**Behavior**:
- Updates existing check-in record with user-submitted values
- Uploads ID document to S3
- Changes status from "pending" to "completed"
- Schedules QR code generation

### 3. Get Check-in Status

Retrieves current check-in status for a reservation.

**Endpoint**: `GET /checkin?reservationCode=608175568`

**Success Response** (200):
```json
{
  "success": true,
  "message": "Check-in status retrieved successfully",
  "data": {
    "reservationCode": "608175568",
    "reservationId": "09458725-8b63-4222-9cac-dc9f826df50a",
    "status": "completed",
    "hasCheckedIn": true,
    "firstName": "Farhad Updated",
    "lastName": "New Surname",
    "email": "new@email.com",
    "phone": "+49 new number",
    "canUpdate": true,
    "createdAt": 1755183057016,
    "updatedAt": 1755183157016
  },
  "timestamp": 1755183057016
}
```

### 4. QR Code Display

Displays the QR code for door access when user clicks the link from email.

**Frontend Route**: `/display-qrcode?qr=sdf345wedfgadrt435twerte5t6`

**Behavior**:
- Displays QR code immediately
- Provides download option
- Shows check-in details
- No API call needed (QR data in URL parameter)

**Frontend Implementation**:
```javascript
// Extract QR code from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const qrCode = urlParams.get('qr');

// Display QR code and download option
// QR code contains door access credentials
```

## Frontend URL Parameters

### Check-in Pre-fill
The check-in form can be pre-filled using URL parameters:

**URL Format**: `/online-check-in?guestFirstName=John&reservationCode=608175568`

**Parameters**:
- `guestFirstName`: Pre-fills the guest first name field
- `reservationCode`: Pre-fills the reservation code field

**Frontend Behavior**:
- Extract parameters from URL
- Auto-fill form fields
- User clicks validation button to proceed
- Reduces manual input for guests

**Example Implementation**:
```javascript
// Extract URL parameters
const urlParams = new URLSearchParams(window.location.search);
const guestFirstName = urlParams.get('guestFirstName');
const reservationCode = urlParams.get('reservationCode');

// Pre-fill form fields
if (guestFirstName) document.getElementById('guestFirstName').value = guestFirstName;
if (reservationCode) document.getElementById('reservationCode').value = reservationCode;
```

## Data Flow Structure

### Phase 1: Validation
```
User Input → Reservation Lookup → Minimal Pending Record Creation
```

**Database Record (Pending)**:
```json
{
  "firstName": "",                 // Empty - user will provide
  "lastName": "",                  // Empty - user will provide
  "email": "",                     // Empty - user will provide
  "phone": "",                     // Empty - user will provide
  "reservationFirstName": "farhad", // Original from reservation
  "reservationLastName": "surname", // Original from reservation
  "reservationEmail": "original@email.com", // Original from reservation
  "reservationPhone": "+49 123456789", // Original from reservation
  "status": "pending",
  "reservationStatus": 1           // From reservation
}
```

### Phase 2: Frontend Data Collection
```
Frontend → Collect Main Guest Information → Prepare for Submission
```

**User provides their current/actual information:**
- First Name
- Last Name
- Email Address
- Phone Number
- ID Document Upload

### Phase 3: Submission
```
User Input → Complete Record Creation → File Upload → Final Record
```

**Database Record (Completed)**:
```json
{
  "firstName": "Farhad Current",    // User's actual current info
  "lastName": "Current Surname",   // User's actual current info
  "email": "current@email.com",    // User's actual current info
  "phone": "+49 current number",   // User's actual current info
  "reservationFirstName": "farhad", // Original from reservation (preserved)
  "reservationLastName": "surname", // Original from reservation (preserved)
  "reservationEmail": "original@email.com", // Original from reservation (preserved)
  "reservationPhone": "+49 123456789", // Original from reservation (preserved)
  "idCardUrl": "s3://bucket/path", // Uploaded document
  "status": "completed",           // Updated
  "reservationStatus": 1           // From reservation
}
```

### 4. Main Guest Information Concept

**Important**: The check-in system stores **both** the original reservation information and the current guest information provided by the user. This allows:

- ✅ **Frontend to display original reservation details**
- ✅ **Users to provide their current/updated information**
- ✅ **System to maintain audit trail of changes**
- ✅ **Comparison between original and current data**

**Data Storage**:
- ✅ **firstName/lastName/email/phone**: User's current information
- ✅ **reservationFirstName/reservationLastName/reservationEmail/reservationPhone**: Original reservation data
- ✅ **checkInDate/checkOutDate**: Reservation dates for display
- ✅ **idCardUrl**: Uploaded identification document
- ✅ **status**: "pending" → "completed"
- ✅ **reservationStatus**: Original reservation status from G4H

## Business Rules

### Check-in Deadline
- Users can update check-in information until **25 hours** before check-in time
- Deadline only applies to **completed** check-ins
- Pending check-ins can always be updated (until deadline)

### Default Check-in Time
- If check-in time is 00:00 or not specified, defaults to **14:00 Germany time**
- Germany timezone: UTC+1 (CET) or UTC+2 (CEST)

### QR Code Scheduling
- **Normal case**: QR code scheduled 24 hours before check-in
- **Late case**: If check-in is less than 24 hours away, QR code scheduled 15 minutes after submission

### User Messages After Submission
- **Normal case (>24h before check-in)**:
  "Thank you! Your check-in has been completed successfully. The QR code for the doors will be sent to you 24 hours before your check-in on [DATE]."
- **Late case (<24h before check-in)**:
  "Thank you! Your check-in has been completed successfully. The QR code for the doors will be sent to you in the next 15 minutes."

### QR Code Delivery
- **Email**: Contains link to QR code display page
- **Link Format**: `https://harmonest.de/display-qrcode?qr={qrCodeData}`
- **Page Features**:
  - Immediate QR code display
  - Download option
  - Check-in confirmation details

### File Upload Requirements
- **Formats**: JPEG, PNG, GIF, WebP
- **Size limit**: 5MB maximum
- **Encoding**: Base64 (without data URL prefix)
- **Storage**: S3 with 2-month auto-deletion

## Error Handling

### Common Error Codes
- `RESERVATION_NOT_FOUND`: Invalid reservation code
- `INVALID_GUEST_NAME`: Guest name doesn't match reservation
- `RESERVATION_CANCELED`: Reservation is canceled/inactive
- `CHECKIN_DEADLINE_PASSED`: 25-hour deadline exceeded
- `INVALID_FILE`: Image file invalid or too large
- `MISSING_REQUIRED_FIELDS`: Required fields missing
- `INTERNAL_ERROR`: Server error

### Error Response Format
```json
{
  "success": false,
  "message": "Reservation not found",
  "data": {},
  "errorCode": "RESERVATION_NOT_FOUND",
  "timestamp": 1755183057016
}
```

## Database Schema

### Check-in Records
```
PK: CHECKIN#{reservationId}
SK: META
```

**Attributes**:
- `firstName`: Guest first name (user-provided current information)
- `lastName`: Guest last name (user-provided current information)
- `email`: Guest email (user-provided current information)
- `phone`: Guest phone number (user-provided current information)
- `reservationCode`: Reservation code for reference
- `reservationFirstName`: Original first name from reservation (preserved)
- `reservationLastName`: Original last name from reservation (preserved)
- `reservationEmail`: Original email from reservation (preserved)
- `reservationPhone`: Original phone from reservation (preserved)
- `idCardUrl`: S3 URL of uploaded ID document
- `status`: "pending" | "completed" | "expired"
- `reservationStatus`: Original reservation status from G4H (1=active, 0=canceled)
- `canUpdateUntil`: Timestamp (25 hours before check-in)
- `qrCodeTriggerTime`: Timestamp for QR code generation
- `qrCodeTriggerScheduled`: Boolean
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

## Performance Optimizations

### GSI for Reservation Code Lookup
- **Index Name**: `ReservationCodeIndex`
- **Partition Key**: `reservationCode`
- **Projection**: ALL
- **Fallback**: Table scan if GSI unavailable

## Complete User Journey

### 1. Email/SMS Link (Optional)
Guest receives link with pre-filled parameters:
```
https://harmonest.de/online-check-in?guestFirstName=John&reservationCode=608175568
```

### 2. Check-in Form
- Form fields auto-filled from URL parameters (if provided)
- User clicks "Validate Reservation" button
- System validates reservation and creates pending record

### 3. Guest Information Collection
- Frontend displays original reservation details for reference
- User provides their current information:
  - First Name (current)
  - Last Name (current)
  - Email (current)
  - Phone Number (current)
  - ID Document Upload

### 4. Submission & Confirmation
- User submits complete information
- System processes and stores data
- User receives confirmation with QR code timing

### 5. QR Code Delivery
- **24h before check-in**: Email with QR code link
- **<24h case**: Email within 15 minutes
- Link format: `https://harmonest.de/display-qrcode?qr={qrCodeData}`

### 6. QR Code Access
- User clicks email link
- QR code displayed immediately
- Download option available
- Use for door access during stay

## Frontend Integration

### Check-in Form Pre-fill
The online check-in form supports URL parameters for automatic field population:

**URL Format**:
```
https://harmonest.de/online-check-in?guestFirstName=John&reservationCode=608175568
```

**Supported Parameters**:
- `guestFirstName`: Pre-fills the guest first name field
- `reservationCode`: Pre-fills the reservation code field

**User Experience**:
1. User clicks link from email/SMS
2. Form fields are automatically filled
3. User clicks "Validate Reservation" button
4. Proceeds with check-in process

### QR Code Display Page
Dedicated page for displaying door access QR codes:

**URL Format**:
```
https://harmonest.de/display-qrcode?qr=sdf345wedfgadrt435twerte5t6
```

**Features**:
- ✅ **Immediate Display**: QR code shown instantly
- ✅ **Download Option**: Save QR code as image
- ✅ **Check-in Details**: Show reservation and guest information
- ✅ **Mobile Optimized**: Works on all devices

**Implementation Notes**:
- QR parameter contains encrypted door access data
- No API calls needed (data embedded in URL)
- Page should work offline once loaded

## Testing

### Postman Examples

**Validate Request**:
```bash
POST https://179a2g0pgk.execute-api.eu-central-1.amazonaws.com/prod/checkin
Content-Type: application/json

{
  "operation": "validate",
  "reservationCode": "608175568",
  "guestFirstName": "farhad"
}
```

**Submit Request**:
```bash
POST https://179a2g0pgk.execute-api.eu-central-1.amazonaws.com/prod/checkin
Content-Type: application/json

{
  "operation": "submit",
  "reservationCode": "608175568",
  "firstName": "Farhad",
  "lastName": "Surname",
  "email": "test@email.com",
  "phone": "+49 123456789",
  "idCardFile": "base64-image-data",
  "fileExtension": "jpg"
}
```

**Status Request**:
```bash
GET https://179a2g0pgk.execute-api.eu-central-1.amazonaws.com/prod/checkin?reservationCode=608175568
```

## Deployment

```bash
# Deploy all stacks
cdk deploy --all --context env=prod --profile harmonestadmin

# Deploy check-in stack only
cdk deploy HarmonestCheckin-prod --context env=prod --profile harmonestadmin
```

## Monitoring

- **CloudWatch Logs**: `/aws/lambda/harmonest-prod-lambda_checkin`
- **Metrics**: Lambda invocations, errors, duration
- **S3 Storage**: File upload monitoring
- **DynamoDB**: Read/write capacity monitoring
