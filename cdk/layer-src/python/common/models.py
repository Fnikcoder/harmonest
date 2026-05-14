"""
Simple models for G4H data structures.
Uses exact field names as used in website/API - no mapping needed.
Dictionary-based models without Pydantic for Lambda compatibility.
"""

from typing import Optional, Dict, Any, List
from decimal import Decimal
import time


def now_ms() -> int:
    """Get current timestamp in milliseconds."""
    return int(time.time() * 1000)


def convert_to_decimal(obj: Any) -> Any:
    """Convert float values to Decimal for DynamoDB compatibility."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: convert_to_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_to_decimal(item) for item in obj]
    else:
        return obj


def identify_booking_source(raw_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Identify the booking source/channel from G4H reservation data.

    Returns:
        {
            "source": "airbnb" | "booking_com" | "homeaway" | "direct" | "unknown",
            "sourceId": original sourceId from G4H,
            "sourceDetails": additional details about the source
        }
    """
    source_id = raw_data.get("sourceId")
    if source_id is None:
        sp = raw_data.get("source") or raw_data.get("platform")
        if isinstance(sp, str):
            sl = sp.lower()
            if "airbnb" in sl:
                source_id = 1
            elif "booking" in sl:
                source_id = 2
            elif "home" in sl or "vrbo" in sl:
                source_id = 3
    home_away_ref = raw_data.get("homeAwayReferenceNumber")
    reservation_code = raw_data.get("reservationCode", "")

    # Initialize result
    result = {
        "source": "unknown",
        "sourceId": source_id,
        "sourceDetails": {}
    }

    # Check for HomeAway/VRBO
    if home_away_ref:
        result["source"] = "homeaway"
        result["sourceDetails"]["referenceNumber"] = home_away_ref
        return result

    # Check based on sourceId patterns (common G4H patterns)
    if source_id:
        source_id_str = str(source_id).lower()

        # Airbnb typically has sourceId 1 or contains "airbnb"
        if source_id == 1 or "airbnb" in source_id_str:
            result["source"] = "airbnb"
            result["sourceDetails"]["platform"] = "Airbnb"
            return result

        # Booking.com typically has sourceId 2 or contains "booking"
        if source_id == 2 or "booking" in source_id_str:
            result["source"] = "booking_com"
            result["sourceDetails"]["platform"] = "Booking.com"
            return result

        # HomeAway/VRBO typically has sourceId 3 or contains "homeaway"/"vrbo"
        if source_id == 3 or "homeaway" in source_id_str or "vrbo" in source_id_str:
            result["source"] = "homeaway"
            result["sourceDetails"]["platform"] = "HomeAway/VRBO"
            return result

        # Direct booking typically has sourceId 0 or very high numbers
        if source_id == 0 or source_id > 100:
            result["source"] = "direct"
            result["sourceDetails"]["platform"] = "Direct Booking"
            return result

    # Check reservation code patterns
    if reservation_code:
        code_upper = reservation_code.upper()

        # Airbnb codes often start with "HM" or contain specific patterns
        if code_upper.startswith("HM") or "AIR" in code_upper:
            result["source"] = "airbnb"
            result["sourceDetails"]["platform"] = "Airbnb"
            result["sourceDetails"]["codePattern"] = "Airbnb pattern detected"
            return result

        # Booking.com codes often contain "BDC" or are purely numeric
        if "BDC" in code_upper or (code_upper.isdigit() and len(code_upper) >= 8):
            result["source"] = "booking_com"
            result["sourceDetails"]["platform"] = "Booking.com"
            result["sourceDetails"]["codePattern"] = "Booking.com pattern detected"
            return result

    # If no clear pattern found, mark as unknown but provide available info
    if source_id is not None:
        result["sourceDetails"]["unknownSourceId"] = source_id

    return result


def get_booking_source_display_name(booking_source: str) -> str:
    """
    Get a human-readable display name for the booking source.

    Args:
        booking_source: The booking source identifier

    Returns:
        Human-readable name for display
    """
    source_names = {
        "airbnb": "Airbnb",
        "booking_com": "Booking.com",
        "homeaway": "HomeAway/VRBO",
        "direct": "Direct Booking",
        "unknown": "Unknown Source"
    }

    return source_names.get(booking_source, "Unknown Source")


# =============================================================================
# SIMPLE HELPER FUNCTIONS - NO PYDANTIC
# =============================================================================

def create_reservation_from_g4h(raw_data: Dict[str, Any], existing_custom_fields: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Create Reservation dictionary from G4H API data."""

    # Handle price conversion to Decimal
    price = None
    if raw_data.get("price") is not None:
        price = Decimal(str(raw_data["price"]))

    porter_price = None
    if raw_data.get("porterReservationPrice"):
        porter_price = Decimal(str(raw_data["porterReservationPrice"]))

    # Identify booking source
    booking_source = identify_booking_source(raw_data)
    
    # Create default custom fields if none exist
    if not existing_custom_fields:
        current_time = now_ms()
        existing_custom_fields = {
            "checkin": {
                "status": "pending",
                "submittedAt": None,
                "createdAt": current_time,
                "updatedAt": current_time,
                "mainGuestFirstname": "",
                "mainGuestLastname": "",
                "mainGuestEmail": "",
                "mainGuestPhoneNumber": "",
                "documents": [],
                "validationResults": {
                    "documentsValid": False,
                    "identityVerified": False,
                    "validatedAt": None
                },
                "accessNotificationFunctionScheduled": False
            },
            "doorAccesses": {
                "qrCode": "",
                "pinCodes": {},
                "doorInfo": {
                    "qr_doors": [],
                    "pin_doors": [],
                    "total_doors": 0
                },
                "generatedAt": None,
                "status": "pending",
                "usageHistory": [],
                "accessNotificationScheduled": False,
                "accessNotificationScheduledAt": None
            }
        }
    
    return {
        "PK": f"RESERVATION#{raw_data['reservationId']}",
        "SK": "META",
        
        # G4H reservation data - using exact field names
        "reservationId": raw_data.get("reservationId"),
        "roomId": raw_data.get("roomId"),
        "sourceId": raw_data.get("sourceId"),
        "reservationCode": raw_data.get("reservationCode"),

        # Booking source identification
        "bookingSource": booking_source["source"],
        "bookingSourceDetails": booking_source["sourceDetails"],
        
        # Guest information
        "guestId": raw_data.get("guestId"),
        "guestName": raw_data.get("guestName", ""),
        "guestSurname": raw_data.get("guestSurname", ""),
        "phoneNumber": raw_data.get("phoneNumber", ""),
        "email": raw_data.get("email", ""),
        "preferredEmail": raw_data.get("preferredEmail"),
        
        # Dates and duration
        "checkInDate": raw_data.get("checkInDate"),
        "checkOutDate": raw_data.get("checkOutDate"),
        "checkInDateWithTime": raw_data.get("checkInDateWithTime"),
        "checkOutDateWithTime": raw_data.get("checkOutDateWithTime"),
        "nights": raw_data.get("nights"),
        
        # Occupancy
        "numOfAdults": raw_data.get("numOfAdults"),
        "numOfKids": raw_data.get("numOfKids"),
        "numOfInfants": raw_data.get("numOfInfants"),
        
        # Financial
        "currency": raw_data.get("currency", "EUR"),
        "price": price,
        "porterReservationPrice": porter_price,
        
        # Status and flags
        "status": raw_data.get("status"),
        "isDeleted": raw_data.get("isDeleted", 0),
        "isModified": raw_data.get("isModified", 0),
        
        # Property information
        "roomAlias": raw_data.get("roomAlias"),
        "roomName": raw_data.get("roomName"),
        
        # Additional information
        "note": raw_data.get("note"),
        "homeAwayReferenceNumber": raw_data.get("homeAwayReferenceNumber"),
        "guestFormShortLink": raw_data.get("guestFormShortLink"),
        
        # Timestamps
        "addedDate": raw_data.get("addedDate"),
        "lastUpdateDate": raw_data.get("lastUpdateDate"),
        
        # CRITICAL: Preserve existing customFields - never update from G4H
        "customFields": existing_custom_fields,
        
        # Sync metadata
        "sourceUpdatedAt": now_ms(),
        "updatedAt": now_ms(),
        "lastGuestySync": now_ms(),
        "lastCustomUpdate": None,  # Will be set from existing data
        
        # Raw data preservation
        "rawData": raw_data,
        "rawDataHash": str(hash(str(sorted(raw_data.items()))))
    }


def create_listing_from_g4h(raw_data: Dict[str, Any], existing_custom_fields: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Create Listing dictionary from G4H API data."""
    
    # Create default custom fields if none exist
    if not existing_custom_fields:
        existing_custom_fields = {
            "address": "",
            "responsiblePerson": "",
            "info4guest": "",
            "doors": []
        }
    
    return {
        "PK": f"LISTING#{raw_data['roomId']}",
        "SK": "META",
        
        # G4H listing data - using exact field names
        "roomId": raw_data.get("roomId"),
        "groupId": raw_data.get("groupId"),
        "roomName": raw_data.get("roomName"),
        "roomAlias": raw_data.get("roomAlias"),
        
        "maxGuests": raw_data.get("maxGuests"),
        "bedrooms": raw_data.get("bedrooms"),
        "bathrooms": raw_data.get("bathrooms"),
        "beds": raw_data.get("beds"),
        
        "city": raw_data.get("city"),
        "country": raw_data.get("country"),
        "timezone": raw_data.get("timezone"),
        
        "isActive": raw_data.get("isActive", True),
        "isDeleted": raw_data.get("isDeleted", 0),
        "deleted": raw_data.get("deleted", False),
        
        # Channel data from G4H
        "airbnbListings": raw_data.get("airbnbListings", []),
        "bookingComListings": raw_data.get("bookingComListings", []),
        "homeAwayListings": raw_data.get("homeAwayListings", []),
        "homeAwayHosts": raw_data.get("homeAwayHosts", []),
        "channelSummary": raw_data.get("channelSummary", []),
        
        "childList": raw_data.get("childList", []),
        
        # CRITICAL: Preserve existing customFields - never update from G4H
        "customFields": existing_custom_fields,
        
        # Sync metadata
        "sourceUpdatedAt": now_ms(),
        "updatedAt": now_ms(),
        "lastGuestySync": now_ms(),
        "lastCustomUpdate": None,  # Will be set from existing data
        
        # Raw data preservation
        "rawData": raw_data,
        "rawDataHash": str(hash(str(sorted(raw_data.items()))))
    }


# =============================================================================
# SIMPLE CLASSES FOR COMPATIBILITY
# =============================================================================

class Reservation:
    """Simple Reservation class that works like a dictionary."""
    
    def __init__(self, **kwargs):
        # Set all fields as attributes
        for key, value in kwargs.items():
            setattr(self, key, value)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return self.__dict__.copy()
    
    def to_dynamodb_dict(self) -> Dict[str, Any]:
        """Convert to DynamoDB-compatible dictionary."""
        return convert_to_decimal(self.__dict__.copy())


class Listing:
    """Simple Listing class that works like a dictionary."""
    
    def __init__(self, **kwargs):
        # Set all fields as attributes
        for key, value in kwargs.items():
            setattr(self, key, value)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return self.__dict__.copy()
    
    def to_dynamodb_dict(self) -> Dict[str, Any]:
        """Convert to DynamoDB-compatible dictionary."""
        return convert_to_decimal(self.__dict__.copy())
    
    def get_door_by_name(self, door_name: str) -> Optional[Dict[str, Any]]:
        """Get door configuration by name."""
        if hasattr(self, 'customFields') and 'doors' in self.customFields:
            for door in self.customFields['doors']:
                if door.get('name') == door_name:
                    return door
        return None


# Compatibility classes (not used but needed for imports)
class ReservationCustomFields:
    def __init__(self, **kwargs):
        pass

class ListingCustomFields:
    def __init__(self, **kwargs):
        pass
