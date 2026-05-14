#!/usr/bin/env python3
from __future__ import annotations

"""
Test script to verify all imports in email_service.py work correctly
"""

import sys
import os

# Add the layer-src/python to the Python path to simulate Lambda layer
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'layer-src', 'python'))

# Add current directory to path for local imports
sys.path.insert(0, os.path.dirname(__file__))

def test_standard_library_imports():
    """Test standard library imports"""
    print("Testing standard library imports...")
    try:
        import base64
        import io
        from datetime import datetime, timezone
        from typing import Dict, Any, Optional, List
        from zoneinfo import ZoneInfo
        print("✅ Standard library imports: OK")
        return True
    except ImportError as e:
        print(f"❌ Standard library imports failed: {e}")
        return False

def test_external_package_imports():
    """Test external package imports"""
    print("Testing external package imports...")
    try:
        import qrcode
        from qrcode.constants import ERROR_CORRECT_H
        from PIL import Image, ImageDraw
        print("✅ External package imports (qrcode, PIL): OK")
        return True
    except ImportError as e:
        print(f"❌ External package imports failed: {e}")
        print("Make sure to install: pip install qrcode[pil] Pillow")
        return False

def test_boto3_import():
    """Test boto3 import (optional)"""
    print("Testing boto3 import...")
    try:
        import boto3
        print("✅ boto3 import: OK")
        return True
    except ImportError as e:
        print(f"⚠️  boto3 import failed (this is optional): {e}")
        return True  # This is expected to be optional

def test_common_email_utils_import():
    """Test common.email_utils import"""
    print("Testing common.email_utils import...")
    try:
        from common.email_utils import send_email_via_zoho
        print("✅ common.email_utils import: OK")
        return True
    except ImportError as e:
        print(f"❌ common.email_utils import failed: {e}")
        return False

def test_notification_templates_import():
    """Test notification_templates import"""
    print("Testing notification_templates import...")
    try:
        from notification_templates import UnifiedNotificationTemplateManager
        print("✅ notification_templates import: OK")
        return True
    except ImportError as e:
        print(f"❌ notification_templates import failed: {e}")
        return False

def test_function_instantiation():
    """Test that we can instantiate the main classes"""
    print("Testing function instantiation...")
    try:
        from notification_templates import UnifiedNotificationTemplateManager
        tm = UnifiedNotificationTemplateManager()
        print("✅ UnifiedNotificationTemplateManager instantiation: OK")
        return True
    except Exception as e:
        print(f"❌ Function instantiation failed: {e}")
        return False

def main():
    """Run all import tests"""
    print("🧪 Testing imports for email_service.py")
    print("=" * 50)
    
    tests = [
        test_standard_library_imports,
        test_external_package_imports,
        test_boto3_import,
        test_common_email_utils_import,
        test_notification_templates_import,
        test_function_instantiation
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"❌ Test {test.__name__} crashed: {e}")
            results.append(False)
        print()
    
    print("=" * 50)
    print("📊 SUMMARY:")
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("🎉 All imports should work correctly!")
    else:
        print("⚠️  Some imports may fail. Check the errors above.")
        
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
