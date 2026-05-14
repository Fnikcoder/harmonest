#!/usr/bin/env python3
"""
Multi-Client Demo Environment Manager

Creates and manages a comprehensive demo environment showcasing
the multi-tenant capabilities of the hotel management system.
"""

import os
import sys
import json
import time
from pathlib import Path
from typing import Dict, List, Any, Optional
import argparse
from datetime import datetime

# Add config directory to Python path
project_root = Path(__file__).parent.parent
config_dir = project_root / "config"
sys.path.insert(0, str(config_dir))

from config.config_manager import ConfigManager, ConfigurationError


class DemoEnvironmentManager:
    """Manages the multi-client demo environment"""
    
    def __init__(self):
        """Initialize demo environment manager"""
        self.config_manager = ConfigManager()
        self.demo_clients = [
            "harmonest",
            "alpine-lodge", 
            "boutique-suites",
            "budget-stay",
            "paradise-resort",
            "executive-inn"
        ]
        
        # Demo scenarios
        self.demo_scenarios = {
            "luxury": ["paradise-resort", "boutique-suites"],
            "business": ["executive-inn", "harmonest"],
            "budget": ["budget-stay"],
            "mountain": ["alpine-lodge"],
            "all": self.demo_clients
        }
    
    def create_demo_environment(self, scenario: str = "all") -> Dict[str, Any]:
        """Create a complete demo environment"""
        print("🎭 Creating Multi-Client Demo Environment")
        print("=" * 50)
        
        clients_to_demo = self.demo_scenarios.get(scenario, self.demo_clients)
        
        results = {
            "scenario": scenario,
            "clients": {},
            "summary": {
                "total_clients": len(clients_to_demo),
                "successful": 0,
                "failed": 0
            }
        }
        
        for client_name in clients_to_demo:
            print(f"\n🏨 Setting up demo for: {client_name}")
            try:
                client_result = self._setup_client_demo(client_name)
                results["clients"][client_name] = client_result
                results["summary"]["successful"] += 1
                print(f"✅ {client_name} demo setup completed")
            except Exception as e:
                print(f"❌ {client_name} demo setup failed: {e}")
                results["clients"][client_name] = {"error": str(e)}
                results["summary"]["failed"] += 1
        
        # Generate demo report
        self._generate_demo_report(results)
        
        return results
    
    def _setup_client_demo(self, client_name: str) -> Dict[str, Any]:
        """Set up demo for a specific client"""
        try:
            # Load client configuration
            config = self.config_manager.load_client_config(client_name)
            
            result = {
                "client_name": client_name,
                "display_name": config["client"]["displayName"],
                "description": config["client"]["description"],
                "features": list(config["client"]["features"].keys()),
                "environments": list(config["environments"].keys()),
                "domains": config["client"]["domains"],
                "demo_data": self._generate_demo_data(client_name, config),
                "api_examples": self._generate_api_examples(client_name, config),
                "test_scenarios": self._generate_test_scenarios(client_name, config)
            }
            
            return result
            
        except Exception as e:
            raise Exception(f"Failed to setup demo for {client_name}: {e}")
    
    def _generate_demo_data(self, client_name: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Generate demo data for a client"""
        demo_data = {
            "reservations": [],
            "listings": [],
            "guests": []
        }
        
        # Generate sample reservations
        base_reservation_id = 1000
        for i in range(5):
            reservation = {
                "reservationId": f"{client_name.upper()}{base_reservation_id + i}",
                "reservationCode": f"DEMO{i+1:03d}",
                "guestName": ["John", "Jane", "Mike", "Sarah", "David"][i],
                "guestLastName": ["Smith", "Johnson", "Williams", "Brown", "Davis"][i],
                "checkInDate": f"2024-0{(i % 3) + 1}-{15 + i:02d}",
                "checkOutDate": f"2024-0{(i % 3) + 1}-{17 + i:02d}",
                "status": 1,
                "listingId": f"LISTING{i+1:03d}",
                "specialRequests": self._get_demo_special_requests(client_name, i)
            }
            demo_data["reservations"].append(reservation)
        
        # Generate sample listings
        for i in range(3):
            listing = {
                "listingId": f"LISTING{i+1:03d}",
                "title": self._get_demo_listing_title(client_name, i),
                "description": self._get_demo_listing_description(client_name, i),
                "maxGuests": [2, 4, 6][i],
                "rooms": [1, 2, 3][i],
                "amenities": self._get_demo_amenities(client_name, i)
            }
            demo_data["listings"].append(listing)
        
        # Generate sample guests
        for i in range(5):
            guest = {
                "guestId": f"GUEST{i+1:03d}",
                "firstName": ["John", "Jane", "Mike", "Sarah", "David"][i],
                "lastName": ["Smith", "Johnson", "Williams", "Brown", "Davis"][i],
                "email": f"demo{i+1}@{config['client']['domains']['primary']}",
                "phone": f"+1555{i+1:03d}{i+2:04d}",
                "preferences": self._get_demo_guest_preferences(client_name, i)
            }
            demo_data["guests"].append(guest)
        
        return demo_data
    
    def _get_demo_special_requests(self, client_name: str, index: int) -> str:
        """Get demo special requests based on client type"""
        requests_by_type = {
            "paradise-resort": [
                "Beachfront room with ocean view",
                "Spa package with couples massage",
                "Private dining on the beach",
                "Snorkeling equipment rental",
                "Late checkout for flight departure"
            ],
            "boutique-suites": [
                "Champagne and flowers for anniversary",
                "High floor with city view",
                "Late arrival after midnight",
                "Extra pillows and blankets",
                "Quiet room away from elevator"
            ],
            "executive-inn": [
                "Early check-in for business meeting",
                "Conference room booking for 10 people",
                "Airport shuttle service",
                "Business center access",
                "Express laundry service"
            ],
            "budget-stay": [
                "Ground floor room",
                "Extra towels",
                "Late checkout",
                "Parking space",
                "WiFi password"
            ],
            "alpine-lodge": [
                "Mountain view room",
                "Ski equipment storage",
                "Hot tub access",
                "Fireplace room",
                "Trail maps and recommendations"
            ]
        }
        
        default_requests = [
            "Non-smoking room",
            "Extra towels",
            "Late checkout",
            "Quiet room",
            "High floor"
        ]
        
        requests = requests_by_type.get(client_name, default_requests)
        return requests[index % len(requests)]
    
    def _get_demo_listing_title(self, client_name: str, index: int) -> str:
        """Get demo listing titles based on client type"""
        titles_by_type = {
            "paradise-resort": [
                "Ocean View Villa",
                "Beachfront Suite", 
                "Presidential Penthouse"
            ],
            "boutique-suites": [
                "Executive Suite",
                "Deluxe City View",
                "Penthouse Loft"
            ],
            "executive-inn": [
                "Business Suite",
                "Conference Room Package",
                "Executive Floor Room"
            ],
            "budget-stay": [
                "Standard Room",
                "Economy Double",
                "Basic Single"
            ],
            "alpine-lodge": [
                "Mountain View Cabin",
                "Ski-in Ski-out Suite",
                "Fireside Lodge Room"
            ]
        }
        
        default_titles = ["Standard Room", "Deluxe Suite", "Premium Room"]
        titles = titles_by_type.get(client_name, default_titles)
        return titles[index % len(titles)]
    
    def _get_demo_listing_description(self, client_name: str, index: int) -> str:
        """Get demo listing descriptions"""
        descriptions = {
            "paradise-resort": "Luxury accommodation with stunning ocean views and premium amenities",
            "boutique-suites": "Elegant suite with modern design and personalized service",
            "executive-inn": "Professional accommodation with business amenities and meeting facilities",
            "budget-stay": "Comfortable and affordable room with essential amenities",
            "alpine-lodge": "Cozy mountain retreat with rustic charm and outdoor activities"
        }
        
        return descriptions.get(client_name, "Comfortable accommodation with modern amenities")
    
    def _get_demo_amenities(self, client_name: str, index: int) -> List[str]:
        """Get demo amenities based on client type"""
        amenities_by_type = {
            "paradise-resort": ["Ocean View", "Private Beach", "Spa Access", "Fine Dining", "Water Sports"],
            "boutique-suites": ["City View", "Concierge Service", "Premium Linens", "Minibar", "Room Service"],
            "executive-inn": ["Business Center", "Meeting Rooms", "Airport Shuttle", "Fitness Center", "WiFi"],
            "budget-stay": ["WiFi", "Parking", "24h Front Desk", "Breakfast", "Air Conditioning"],
            "alpine-lodge": ["Mountain View", "Ski Storage", "Hot Tub", "Fireplace", "Hiking Trails"]
        }
        
        default_amenities = ["WiFi", "Air Conditioning", "TV", "Private Bathroom"]
        return amenities_by_type.get(client_name, default_amenities)
    
    def _get_demo_guest_preferences(self, client_name: str, index: int) -> Dict[str, Any]:
        """Get demo guest preferences"""
        preferences = {
            "roomType": ["standard", "deluxe", "suite", "premium", "economy"][index % 5],
            "floor": ["high", "low", "any"][index % 3],
            "view": ["ocean", "city", "mountain", "garden", "any"][index % 5],
            "bedType": ["king", "queen", "twin", "double"][index % 4],
            "smoking": False,
            "accessibility": index == 0  # First guest needs accessibility
        }
        
        return preferences
    
    def _generate_api_examples(self, client_name: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Generate API examples for the client"""
        primary_domain = config["client"]["domains"]["primary"]
        api_base = f"https://{primary_domain}/api"
        
        examples = {
            "base_url": api_base,
            "endpoints": {}
        }
        
        # Check-in API examples
        if config["client"]["features"].get("checkin", {}).get("enabled"):
            examples["endpoints"]["checkin"] = {
                "validate": {
                    "method": "POST",
                    "url": f"{api_base}/checkin",
                    "body": {
                        "operation": "validate",
                        "reservationCode": "DEMO001",
                        "guestFirstName": "John"
                    }
                },
                "submit": {
                    "method": "POST", 
                    "url": f"{api_base}/checkin",
                    "body": {
                        "operation": "submit",
                        "reservationId": f"{client_name.upper()}1001",
                        "guestName": "John",
                        "guestLastName": "Smith",
                        "guestEmail": f"john.smith@{primary_domain}",
                        "guestPhone": "+15551234567",
                        "estimatedArrival": "15:00"
                    }
                }
            }
        
        # Public listings API examples
        if config["client"]["features"].get("listings", {}).get("publicListings"):
            examples["endpoints"]["listings"] = {
                "get_all": {
                    "method": "GET",
                    "url": f"{api_base}/public/listings"
                },
                "search": {
                    "method": "GET",
                    "url": f"{api_base}/public/listings/search?maxGuests=4&checkIn=2024-02-01&checkOut=2024-02-03"
                }
            }
        
        return examples
    
    def _generate_test_scenarios(self, client_name: str, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate test scenarios for the client"""
        scenarios = []
        
        # Basic check-in scenario
        if config["client"]["features"].get("checkin", {}).get("enabled"):
            scenarios.append({
                "name": "Basic Check-in Flow",
                "description": "Test complete check-in process from validation to completion",
                "steps": [
                    "Validate reservation with code DEMO001",
                    "Submit check-in information",
                    "Verify check-in status",
                    "Test update functionality"
                ]
            })
        
        # Listings scenario
        if config["client"]["features"].get("listings", {}).get("enabled"):
            scenarios.append({
                "name": "Listings Management",
                "description": "Test listings sync and public API",
                "steps": [
                    "Sync listings from G4H",
                    "Verify listings in database",
                    "Test public listings API",
                    "Search for available listings"
                ]
            })
        
        # Load testing scenario
        scenarios.append({
            "name": "Load Testing",
            "description": "Test system performance under load",
            "steps": [
                f"Simulate 50 concurrent users for {client_name}",
                "Test API response times",
                "Monitor error rates",
                "Verify system stability"
            ]
        })
        
        return scenarios
    
    def _generate_demo_report(self, results: Dict[str, Any]):
        """Generate comprehensive demo report"""
        report_file = f"demo-report-{datetime.now().strftime('%Y%m%d-%H%M%S')}.md"
        
        report_lines = [
            "# Multi-Client Demo Environment Report",
            "",
            f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"**Scenario:** {results['scenario']}",
            f"**Total Clients:** {results['summary']['total_clients']}",
            f"**Successful:** {results['summary']['successful']}",
            f"**Failed:** {results['summary']['failed']}",
            "",
            "## Demo Clients Overview",
            ""
        ]
        
        for client_name, client_data in results["clients"].items():
            if "error" in client_data:
                report_lines.append(f"### ❌ {client_name}")
                report_lines.append(f"**Error:** {client_data['error']}")
            else:
                report_lines.append(f"### ✅ {client_data['display_name']} ({client_name})")
                report_lines.append(f"**Description:** {client_data['description']}")
                report_lines.append(f"**Features:** {', '.join(client_data['features'])}")
                report_lines.append(f"**Environments:** {', '.join(client_data['environments'])}")
                report_lines.append(f"**Primary Domain:** {client_data['domains']['primary']}")
                
                # API Examples
                if "api_examples" in client_data:
                    report_lines.append("")
                    report_lines.append("**API Examples:**")
                    api_base = client_data["api_examples"]["base_url"]
                    report_lines.append(f"- Base URL: {api_base}")
                    
                    for endpoint, methods in client_data["api_examples"]["endpoints"].items():
                        report_lines.append(f"- {endpoint.title()}: {len(methods)} endpoints")
                
                # Demo Data
                if "demo_data" in client_data:
                    demo_data = client_data["demo_data"]
                    report_lines.append("")
                    report_lines.append("**Demo Data:**")
                    report_lines.append(f"- Reservations: {len(demo_data['reservations'])}")
                    report_lines.append(f"- Listings: {len(demo_data['listings'])}")
                    report_lines.append(f"- Guests: {len(demo_data['guests'])}")
            
            report_lines.append("")
        
        # Usage instructions
        report_lines.extend([
            "## How to Use the Demo",
            "",
            "### 1. Validate All Configurations",
            "```bash",
            "python scripts/validate-config.py --all",
            "```",
            "",
            "### 2. Deploy Demo Clients",
            "```bash",
            "# Deploy all demo clients to dev environment",
            "for client in harmonest alpine-lodge boutique-suites budget-stay paradise-resort executive-inn; do",
            "  python deploy.py deploy $client --env dev",
            "done",
            "```",
            "",
            "### 3. Run Tests",
            "```bash",
            "# Test all clients",
            "python scripts/run-tests.sh --all",
            "",
            "# Test specific scenario",
            "python scripts/run-tests.sh --client paradise-resort",
            "```",
            "",
            "### 4. Generate Documentation",
            "```bash",
            "python scripts/generate-docs.sh --all",
            "```",
            "",
            "### 5. Setup Monitoring",
            "```bash",
            "python scripts/setup-monitoring.py --all",
            "```",
            "",
            "### 6. Load Testing",
            "```bash",
            "# Test luxury hotels",
            "python scripts/run-load-tests.sh --client paradise-resort --users 100",
            "python scripts/run-load-tests.sh --client boutique-suites --users 50",
            "```",
            "",
            "## Demo Scenarios",
            "",
            "### Luxury Hotels",
            "- **Paradise Resort & Spa**: Full-featured resort with spa, dining, activities",
            "- **Boutique Suites Downtown**: Luxury boutique with concierge services",
            "",
            "### Business Hotels", 
            "- **Executive Inn**: Corporate hotel with meeting facilities",
            "- **HarmoNest**: Original client with full features",
            "",
            "### Budget Hotels",
            "- **Budget Stay Hotels**: Minimal features, cost-optimized",
            "",
            "### Specialty Hotels",
            "- **Alpine Lodge Resort**: Mountain resort with outdoor activities",
            "",
            f"*Report generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*"
        ])
        
        report_content = "\n".join(report_lines)
        
        with open(report_file, 'w') as f:
            f.write(report_content)
        
        print(f"\n📋 Demo report generated: {report_file}")
        return report_content
    
    def list_demo_clients(self) -> Dict[str, Any]:
        """List all demo clients with their configurations"""
        clients_info = {}
        
        for client_name in self.demo_clients:
            try:
                config = self.config_manager.load_client_config(client_name)
                clients_info[client_name] = {
                    "display_name": config["client"]["displayName"],
                    "description": config["client"]["description"],
                    "features": list(config["client"]["features"].keys()),
                    "environments": list(config["environments"].keys()),
                    "primary_domain": config["client"]["domains"]["primary"]
                }
            except Exception as e:
                clients_info[client_name] = {"error": str(e)}
        
        return clients_info
    
    def validate_demo_environment(self) -> Dict[str, Any]:
        """Validate the entire demo environment"""
        print("🔍 Validating Demo Environment")
        print("-" * 30)
        
        validation_results = {
            "total_clients": len(self.demo_clients),
            "valid_clients": 0,
            "invalid_clients": 0,
            "results": {}
        }
        
        for client_name in self.demo_clients:
            try:
                config = self.config_manager.load_client_config(client_name)
                self.config_manager.validate_config(config)
                
                validation_results["results"][client_name] = {
                    "status": "valid",
                    "message": "Configuration is valid"
                }
                validation_results["valid_clients"] += 1
                print(f"✅ {client_name}: Valid")
                
            except Exception as e:
                validation_results["results"][client_name] = {
                    "status": "invalid",
                    "message": str(e)
                }
                validation_results["invalid_clients"] += 1
                print(f"❌ {client_name}: {e}")
        
        return validation_results


def main():
    """Main function for demo environment management"""
    parser = argparse.ArgumentParser(description="Multi-Client Demo Environment Manager")
    parser.add_argument("--create", action="store_true", help="Create demo environment")
    parser.add_argument("--scenario", choices=["luxury", "business", "budget", "mountain", "all"], 
                       default="all", help="Demo scenario to create")
    parser.add_argument("--list", action="store_true", help="List demo clients")
    parser.add_argument("--validate", action="store_true", help="Validate demo environment")
    
    args = parser.parse_args()
    
    # Initialize demo manager
    demo_manager = DemoEnvironmentManager()
    
    if args.create:
        print(f"Creating demo environment for scenario: {args.scenario}")
        results = demo_manager.create_demo_environment(args.scenario)
        
        print(f"\n🎉 Demo environment created!")
        print(f"Scenario: {results['scenario']}")
        print(f"Clients: {results['summary']['successful']}/{results['summary']['total_clients']} successful")
    
    elif args.list:
        print("📋 Demo Clients:")
        clients_info = demo_manager.list_demo_clients()
        
        for client_name, info in clients_info.items():
            if "error" in info:
                print(f"❌ {client_name}: {info['error']}")
            else:
                print(f"✅ {info['display_name']} ({client_name})")
                print(f"   Description: {info['description']}")
                print(f"   Features: {', '.join(info['features'])}")
                print(f"   Domain: {info['primary_domain']}")
                print()
    
    elif args.validate:
        results = demo_manager.validate_demo_environment()
        
        print(f"\n📊 Validation Summary:")
        print(f"Total Clients: {results['total_clients']}")
        print(f"Valid: {results['valid_clients']}")
        print(f"Invalid: {results['invalid_clients']}")
        
        if results['invalid_clients'] > 0:
            print("\n❌ Some clients have configuration issues. Please review and fix.")
            sys.exit(1)
        else:
            print("\n✅ All demo clients are valid!")
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
