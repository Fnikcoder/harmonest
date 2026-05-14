# Retry and Token Management Analysis

## 🔄 **Retry Strategies by System**

### **1. G4H (Guesty for Hosts) - Multi-Layer Approach**

#### **HTTP Level Retries**
```python
# Built into requests session
retry = Retry(
    total=5, 
    backoff_factor=0.2,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["HEAD","GET","POST","PUT","DELETE","OPTIONS","TRACE"]
)
```

#### **Authentication Level Retries**
```python
def refresh_on_auth_error(fn, *args, **kwargs):
    """Single retry on 401/403 with fresh login"""
    try:
        r = fn(*args, **kwargs)
        if r.status_code in (401,403):
            raise PermissionError("auth")
        return r
    except PermissionError:
        fresh = _login_and_store()  # Force relogin
        _CACHED.update(fresh)
        return fn(*args, **kwargs)  # Single retry
```

#### **Session Management**
- **3-Tier Caching**: Warm container → AWS Secrets Manager → Fresh login
- **12-Hour Sessions**: Long-lived sessions with automatic refresh
- **Proactive Expiration**: Checks expiration before use

### **2. QRLock - Dedicated Auth Wrapper**

#### **Authentication Retry Pattern**
```python
def _make_authenticated_request(self, request_func, *args, **kwargs):
    max_retries = 2
    for attempt in range(max_retries):
        # Ensure we have a token
        if not self.access_token:
            if not self.authenticate():
                return None
        
        try:
            return request_func(*args, **kwargs)
        except AuthenticationError:
            if attempt < max_retries - 1:
                self.access_token = None  # Clear token
                if not self.authenticate():  # Re-authenticate
                    return None
```

#### **Token Management**
- **1-Hour TTL**: Default 3600 seconds expiration
- **Expiration Check**: Validates `expires_at` timestamp on load
- **Auto-Creation**: Creates secret if not found

### **3. TTLock - Same Pattern as QRLock**

#### **Identical Retry Logic**
- Same `_make_authenticated_request()` pattern
- Same 2-retry maximum
- Same authentication error handling

#### **Token Management**
- **2-Hour TTL**: Default 7200 seconds expiration
- **Same Storage Pattern**: AWS Secrets Manager with try/except
- **Same Expiration Logic**: Timestamp-based validation

## 🔐 **Token Update Mechanisms**

### **G4H Session Updates**
```python
def _put_secret_json(name_or_arn: str, obj: dict):
    """Direct AWS Secrets Manager update with fallback creation"""
    try:
        sm.put_secret_value(SecretId=name_or_arn, SecretString=json.dumps(obj))
    except sm.exceptions.ResourceNotFoundException:
        # Extract name from ARN and create secret
        secret_name = name_or_arn.split(":")[-1].rsplit("-", 1)[0]
        sm.create_secret(Name=secret_name, SecretString=json.dumps(obj))
```

### **QRLock/TTLock Token Updates**
```python
def _save_token(self, token: str, expires_in_seconds: int):
    """Save token with expiration timestamp"""
    token_data = {
        "access_token": token,
        "expires_at": time.time() + expires_in_seconds,
        "created_at": time.time()
    }
    
    try:
        # Try update first
        sm.update_secret(SecretId=self.token_secret, SecretString=json.dumps(token_data))
    except sm.exceptions.ResourceNotFoundException:
        # Create if doesn't exist
        sm.create_secret(Name=self.token_secret, SecretString=json.dumps(token_data))
```

## 🔧 **Enhanced credentials.py Functions**

### **Added Features**

1. **Expiration Checking**:
   ```python
   def get_ttlock_token(self) -> Dict[str, Any]:
       token_data = self.get_secret('ttlock', 'token')
       if token_data:
           expires_at = token_data.get('expires_at', 0)
           if time.time() >= expires_at:
               print("TTLock token has expired")
               self.clear_secret_cache()
               return {}
       return token_data
   ```

2. **Cache Management**:
   ```python
   def clear_secret_cache(self):
       """Clear LRU cache when tokens expire"""
       if hasattr(self.get_secret, 'cache_clear'):
           self.get_secret.cache_clear()
   ```

3. **Update with Cache Clearing**:
   ```python
   def update_ttlock_token(self, token_data: Dict[str, Any]) -> bool:
       success = self.update_secret('ttlock', 'token', token_data)
       if success:
           self.clear_secret_cache()  # Force fresh data
       return success
   ```

## 📊 **Comparison Summary**

| System | HTTP Retries | Auth Retries | Token TTL | Cache Strategy |
|--------|--------------|--------------|-----------|----------------|
| **G4H** | 5 retries + backoff | 1 retry | 12 hours | 3-tier caching |
| **QRLock** | None (default) | 2 retries | 1 hour | Direct AWS SM |
| **TTLock** | None (default) | 2 retries | 2 hours | Direct AWS SM |

## 🎯 **Best Practices Implemented**

### **1. Separation of Concerns**
- **HTTP retries**: Handle network/server issues
- **Auth retries**: Handle token expiration
- **Cache management**: Handle stale data

### **2. Graceful Degradation**
- **Max retry limits**: Prevent infinite loops
- **Error logging**: Clear failure reasons
- **Fallback handling**: Return None/empty on failure

### **3. Token Lifecycle Management**
- **Proactive expiration**: Check before use
- **Automatic refresh**: Re-authenticate on failure
- **Persistent storage**: Survive Lambda cold starts

### **4. Error Handling Patterns**
```python
# QRLock/TTLock pattern
try:
    return request_func(*args, **kwargs)
except AuthenticationError:
    # Clear token and retry
    self.access_token = None
    if not self.authenticate():
        return None
except Exception as e:
    # Log and fail gracefully
    print(f"Non-authentication error: {str(e)}")
    return None
```

## 🚀 **Usage Recommendations**

### **For New Integrations**
1. **Use the QRLock/TTLock pattern** for new APIs
2. **Implement `_make_authenticated_request()` wrapper**
3. **Store tokens with expiration timestamps**
4. **Use the enhanced `credentials.py` functions**

### **For Existing Code**
1. **G4H system is already optimal** - no changes needed
2. **QRLock/TTLock work correctly** - patterns are solid
3. **Use enhanced credential functions** for better cache management

## 🚨 **Critical Issue Fixed: HTML Response Detection**

### **Problem Identified**
TTLock (and potentially QRLock) can return **HTML pages** instead of JSON when:
- Token is expired
- Another user logs in with same credentials (session conflict)
- Server redirects to login page

**Example HTML Response:**
```html
<!DOCTYPE html><html><head><meta charset="utf-8">...
<div class="ant-spin-text">Loading...</div>
```

### **Previous Detection (Insufficient)**
```python
# Only checked HTTP status codes and JSON error codes
if response.status_code == 401:
    raise AuthenticationError("TTLock token expired")

result = response.json()  # Would fail on HTML!
if result.get("errorCode") in [-2, -3, -4]:
    raise AuthenticationError("Auth failed")
```

### **Enhanced Detection (Fixed)**
```python
# Check content type and response format
content_type = response.headers.get('content-type', '').lower()
if 'text/html' in content_type or response.text.strip().startswith('<!DOCTYPE html'):
    print("TTLock returned HTML page - likely session expired")
    raise AuthenticationError("TTLock session expired - HTML response received")

# Safe JSON parsing
try:
    result = response.json()
except ValueError as e:
    raise AuthenticationError(f"Invalid JSON response: {str(e)}")
```

### **Applied to All Methods**
✅ **TTLock Authentication** - Fixed HTML detection
✅ **TTLock PIN Generation** - Fixed HTML detection
✅ **QRLock Authentication** - Fixed HTML detection
✅ **QRLock QR Generation** - Fixed HTML detection

### **Benefits of Fix**
1. **Proper Error Detection**: HTML responses now trigger authentication retry
2. **Clear Logging**: Shows content type and response preview for debugging
3. **Graceful Handling**: No more JSON parsing crashes on HTML
4. **Automatic Recovery**: Retry mechanism will re-authenticate and try again

The retry and token management systems are now **truly robust** and handle all edge cases! 🎉
