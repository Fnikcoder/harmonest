# Custom PIN from Guest Phone Number

## Overview

The TTLock integration now supports **custom PIN codes** using the **last 4 digits of the guest's phone number**. This makes PINs more memorable for guests while maintaining security.

## How It Works

### PIN Generation Logic

1. **Extract Phone Number**: Get guest phone from check-in record
2. **Extract Digits**: Remove all non-digit characters from phone number
3. **Get Last 4 Digits**: Use the last 4 digits as potential PIN
4. **Validate PIN**: Check if PIN meets TTLock security requirements
5. **Use Custom or Random**: Use custom PIN if valid, otherwise generate random PIN

### Example Flow

**Guest Phone**: `+1 (555) 123-4567`
1. **Extract Digits**: `15551234567`
2. **Last 4 Digits**: `4567`
3. **Validate**: Check if `4567` is acceptable
4. **Result**: Use `4567` as PIN for all TTLock doors

## Implementation Details

### TTLock API Integration

**Custom PIN (keyboardPwd/add)**:
```python
# Use add endpoint for custom PIN
url = "https://lock2.ttlock.com/keyboardPwd/add"
data = {
    "lockId": "12345",
    "keyboardPwd": "4567",  # Custom PIN from phone
    "keyboardPwdName": "Guest_Room101_1692123456",
    "keyboardPwdType": "3",  # Temporary PIN
    "startDate": "1692123456789",
    "endDate": "1692209856789"
}
```

**Random PIN (keyboardPwd/get)**:
```python
# Use get endpoint for random PIN (fallback)
url = "https://lock2.ttlock.com/keyboardPwd/get"
data = {
    "lockId": "12345",
    "keyboardPwdName": "Guest_Room101_1692123456",
    "keyboardPwdType": "3",  # Temporary PIN
    "startDate": "1692123456789",
    "endDate": "1692209856789"
}
```

### PIN Validation Rules

**TTLock Security Requirements**:
- **Length**: 4-9 digits
- **No Repetition**: Cannot be all same digits (e.g., `1111`, `2222`)
- **No Sequences**: Cannot be simple sequences (e.g., `1234`, `4321`)

**Validation Examples**:
```python
# Valid PINs
"4567" ✅ - Mixed digits
"9182" ✅ - Mixed digits
"5309" ✅ - Mixed digits

# Invalid PINs
"1111" ❌ - All same digits
"1234" ❌ - Ascending sequence
"4321" ❌ - Descending sequence
"123"  ❌ - Too short
```

### Phone Number Processing

**Input Examples**:
```python
# Various phone formats supported
"+1 (555) 123-4567"  → "4567"
"555-123-4567"       → "4567"
"5551234567"         → "4567"
"+33 1 23 45 67 89"  → "6789"
"(555) 123.4567"     → "4567"
```

**Edge Cases**:
```python
# Insufficient digits
"555-123"            → Random PIN (less than 4 digits)
"123"                → Random PIN (too short)

# Invalid patterns
"555-111-1111"       → Random PIN (last 4 digits are "1111")
"555-123-4321"       → Random PIN (last 4 digits are "4321")
```

## Code Implementation

### UnifiedDoorAccessManager Updates

**Method Signature**:
```python
def generate_all_access_codes(self, room_name: str, checkin_time: int, checkout_time: int, 
                            client_name: str, guest_name: str, room_id: str = None, 
                            guest_phone: str = None) -> Dict[str, Any]:
```

**PIN Extraction**:
```python
def _extract_custom_pin_from_phone(self, guest_phone: str) -> Optional[str]:
    """Extract last 4 digits from phone number for custom PIN"""
    if not guest_phone:
        return None
    
    # Remove all non-digit characters
    digits_only = ''.join(filter(str.isdigit, guest_phone))
    
    if len(digits_only) < 4:
        return None
    
    # Get last 4 digits and validate
    last_4_digits = digits_only[-4:]
    return last_4_digits if self._is_valid_pin(last_4_digits) else None
```

**PIN Validation**:
```python
def _is_valid_pin(self, pin: str) -> bool:
    """Validate if PIN is acceptable for TTLock"""
    if len(pin) < 4 or len(pin) > 9:
        return False
    
    # Check if all digits are the same
    if len(set(pin)) == 1:
        return False
    
    # Check for sequential patterns
    if len(pin) >= 4:
        is_ascending = all(int(pin[i]) == int(pin[i-1]) + 1 for i in range(1, len(pin)))
        is_descending = all(int(pin[i]) == int(pin[i-1]) - 1 for i in range(1, len(pin)))
        if is_ascending or is_descending:
            return False
    
    return True
```

### TTLock Client Updates

**Enhanced PIN Generation**:
```python
def generate_pin_code(self, lock_id: str, pin_name: str, start_time_ms: int, 
                     end_time_ms: int, custom_pin: str = None) -> Optional[str]:
    """Generate PIN code with optional custom PIN"""
    return self._make_authenticated_request(
        self._generate_pin_code_request, 
        lock_id, pin_name, start_time_ms, end_time_ms, custom_pin
    )
```

**Dual Endpoint Support**:
```python
def _generate_pin_code_request(self, lock_id: str, pin_name: str, start_time_ms: int, 
                              end_time_ms: int, custom_pin: str = None) -> Optional[str]:
    if custom_pin:
        # Use add endpoint for custom PIN
        url = self.pin_add_url
        data["keyboardPwd"] = custom_pin
    else:
        # Use get endpoint for random PIN
        url = self.pin_get_url
        # No keyboardPwd field needed
```

## Logging and Monitoring

### Success Logs
```
Using last 4 digits of phone +1 (555) 123-4567 as custom PIN: 4567
Creating custom PIN 4567 for lock 12345
Custom PIN 4567 set successfully for lock 12345
Used custom PIN from phone number for Main Door: 4567
```

### Fallback Logs
```
No guest phone number provided, will use random PIN
Phone number 555-123 has less than 4 digits, will use random PIN
PIN 1111 rejected: all digits are the same
Last 4 digits 1111 from phone +1 (555) 111-1111 not valid for PIN, will use random PIN
Generating random PIN for lock 12345
Generated random PIN for Main Door: 8392
```

### Error Logs
```
TTLock authentication error (code -2): Invalid PIN format
PIN code generation failed for lock 12345: {"errorCode": -1, "errmsg": "Invalid PIN"}
```

## Guest Experience

### Benefits
- **Memorable PINs**: Guests can easily remember their own phone number
- **No Need to Save**: PIN is derived from information they already know
- **Consistent**: Same PIN for all TTLock doors in the room
- **Secure**: Still validates against common weak patterns

### Email/SMS Templates
```
Your door access codes for Room 101:

QR Code: [QR Code Image]
PIN Code: 4567 (last 4 digits of your phone number)

Use the PIN code 4567 for:
- Main Entrance
- Balcony Door

The PIN is active from [check-in] to [check-out].
```

## Security Considerations

### Strengths
- **Personal Information**: Based on guest's own phone number
- **Pattern Validation**: Rejects weak patterns like 1111, 1234
- **Temporary**: PIN expires after checkout
- **Limited Scope**: Only works for specific locks during reservation period

### Limitations
- **Predictable**: Someone who knows the guest's phone could guess the PIN
- **Phone Number Exposure**: PIN reveals last 4 digits of phone number
- **Pattern Limitations**: Some valid phone endings might be rejected

### Mitigation
- **Fallback to Random**: Use random PIN if phone-based PIN is weak
- **Time Limits**: PIN only valid during reservation period
- **Lock-Specific**: PIN only works for guest's assigned room
- **Audit Trail**: All PIN usage is logged

## Configuration

### Environment Variables
- No additional configuration needed
- Uses existing TTLock credentials from Secrets Manager

### Feature Toggle
```python
# To disable custom PINs and always use random
def _extract_custom_pin_from_phone(self, guest_phone: str) -> Optional[str]:
    return None  # Always use random PIN
```

## Testing

### Unit Tests
- Phone number parsing with various formats
- PIN validation with edge cases
- TTLock API endpoint selection
- Fallback to random PIN scenarios

### Integration Tests
- End-to-end PIN generation with real phone numbers
- TTLock API responses for both endpoints
- Guest notification with custom vs random PINs

This custom PIN feature enhances the guest experience by providing memorable, personalized access codes while maintaining security through validation and fallback mechanisms.
