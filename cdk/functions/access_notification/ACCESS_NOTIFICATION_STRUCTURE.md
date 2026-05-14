# Access Notification System Structure

## 📋 **6-Step Task Flow Implementation**

The access notification system now follows your specified 6-step task flow:

### **Step 1: Check Latest Reservation Status on Guesty and Update DB**
- Fetches latest reservation data from Guesty API
- Validates reservation is still active (status = 1)
- Updates local DB with latest Guesty data
- Handles canceled/inactive reservations

### **Step 2: Check Preferred Notification Type**
- Gets check-in details and guest information
- Determines notification preference (email/SMS)
- Validates contact information is available
- Extracts guest details (name, email, phone)

### **Step 3: Get Enhanced Listing from DB**
- Retrieves enhanced_listing using listing ID from reservation
- Gets doors_list, address, info4guest, contact person
- Validates doors are configured for the listing
- Provides complete listing information

### **Step 4: Create Door Accesses Based on doors_list**
- Processes each door in the doors_list sequentially
- Generates QR codes for "qrlock" type doors
- Generates PIN codes for "ttlock" type doors
- Maintains door order and configuration from doors_list
- Creates comprehensive access records

### **Step 5: Create Notification Templates**
- **Email**: Full details with QR images, address, info4guest, frontend link
- **SMS**: Short message with frontend link and PIN codes with door names
- Uses enhanced_listing data for complete information
- Generates QR code image attachments for email

### **Step 6: Store All Access Info in DB**
- Stores complete access record with all door details
- Updates reservation with access summary
- Maintains door order and configuration
- Tracks notification status and generation time

## 📁 **New File Structure**

```
functions/qr_code_notification/
├── handler.py                    # Main handler with complete 6-step flow
├── email_service.py             # Simplified email service
├── sms_service_simple.py        # Simplified SMS service
├── qrlock_client.py             # QRLock/TTLock API clients (existing)
├── notification_templates.py    # Email/SMS templates (existing)
├── sms_service.py               # Base SMS service (existing)
├── qr_image_generator.py        # QR image generation (existing)
└── ACCESS_NOTIFICATION_STRUCTURE.md # This documentation
```

## 🔄 **Renamed Functions and Files**

### **Main Handler (handler.py)**
- **Old**: `process_qr_code_notification()`
- **New**: `process_access_notification()`
- **Purpose**: Main entry point following 6-step flow

### **Step Functions (access_steps.py)**
- `step3_get_enhanced_listing()` - Get enhanced listing data
- `step4_create_door_accesses()` - Generate door access codes
- `step5_send_notification()` - Send notifications
- `step6_store_access_info()` - Store complete access data

### **Email Service (send_email.py)**
- **Enhanced**: `send_door_access_email()` now uses enhanced_listing data
- **New**: Supports full listing details, address, info4guest
- **Improved**: QR image attachments with proper naming

### **SMS Service (send_sms.py)**
- **Enhanced**: Short messages with frontend links
- **Improved**: PIN codes with door names
- **Optimized**: Concise format for SMS limitations

## 🎯 **Key Improvements**

### **1. Enhanced Listing Integration**
- Full access to doors_list configuration
- Address and info4guest in notifications
- Contact person information
- Proper door ordering and naming

### **2. Comprehensive Door Access**
- Processes doors in doors_list order
- Supports mixed door types (QR + PIN)
- Maintains door configuration and metadata
- Handles partial failures gracefully

### **3. Rich Notification Content**
- **Email**: Complete listing details, QR images, address, frontend link
- **SMS**: Essential info with frontend link for full details
- **Frontend Link**: Direct access to guest portal

### **4. Complete Data Storage**
- Stores all door access details
- Maintains door order and configuration
- Tracks generation time and notification status
- Updates reservation with access summary

## 📊 **Data Flow**

```
Event → Handler → Step 1 (Guesty Sync) → Step 2 (Notification Pref) 
     → Step 3 (Enhanced Listing) → Step 4 (Door Accesses) 
     → Step 5 (Send Notification) → Step 6 (Store Data) → Response
```

## 🔧 **Usage Examples**

### **Event Structure**
```json
{
  "detail": {
    "reservationId": "12345"
  }
}
```

### **Response Structure**
```json
{
  "statusCode": 200,
  "body": {
    "success": true,
    "message": "Access notification completed successfully via email",
    "data": {
      "reservationId": "12345",
      "notificationType": "email",
      "doorCount": 3,
      "accessTypes": ["qr_code", "pin_code"],
      "notificationSent": true
    }
  }
}
```

### **Database Records Created**

#### **ACCESS Record**
```json
{
  "PK": "ACCESS#12345",
  "SK": "COMPLETE_DETAILS",
  "reservationId": "12345",
  "doorAccesses": [
    {
      "doorIndex": 0,
      "doorName": "Main Entrance",
      "doorLocation": "Front Door",
      "type": "qr_code",
      "accessCode": "QR_CODE_STRING",
      "doorConfig": {...},
      "generatedAt": 1692216656789
    },
    {
      "doorIndex": 1,
      "doorName": "Apartment Door",
      "doorLocation": "Unit 5A",
      "type": "pin_code",
      "accessCode": "1234",
      "doorConfig": {...},
      "generatedAt": 1692216656789
    }
  ],
  "totalDoors": 2,
  "accessTypes": ["qr_code", "pin_code"],
  "notificationSent": true,
  "status": "active"
}
```

## 🚀 **Benefits**

1. **Complete Task Flow**: Follows all 6 steps as specified
2. **Enhanced Listing Integration**: Uses full listing data
3. **Proper Door Ordering**: Maintains doors_list sequence
4. **Rich Notifications**: Full details in email, concise SMS
5. **Comprehensive Storage**: Complete access information
6. **Better Organization**: Clear separation of concerns
7. **Improved Readability**: Descriptive function names
8. **Robust Error Handling**: Graceful failure management

The system now provides a complete, end-to-end access notification solution that follows your exact specifications! 🎯
