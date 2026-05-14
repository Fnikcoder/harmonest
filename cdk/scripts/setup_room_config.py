#!/usr/bin/env python3
"""
Room Configuration Setup Script
Creates room configurations in DynamoDB for door access management
"""
import json
import boto3
import os
import sys
from typing import Dict, Any, List


def setup_room_config(table_name: str, client_name: str, room_configs: List[Dict[str, Any]]):
    """Setup room configurations in DynamoDB"""
    
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(table_name)
    
    print(f"Setting up room configurations for client: {client_name}")
    print(f"Target table: {table_name}")
    
    for room_config in room_configs:
        room_name = room_config["roomName"]
        
        # Create DynamoDB item
        item = {
            "PK": f"ROOM_CONFIG#{client_name}",
            "SK": f"ROOM#{room_name}",
            "roomName": room_name,
            "roomType": room_config.get("roomType", "standard"),
            "doors": room_config.get("doors", []),
            "description": room_config.get("description", ""),
            "createdAt": int(time.time() * 1000),
            "updatedAt": int(time.time() * 1000)
        }
        
        try:
            table.put_item(Item=item)
            print(f"✅ Created configuration for room: {room_name}")
            
            # Print door summary
            doors = room_config.get("doors", [])
            qr_doors = [d for d in doors if d.get("type") == "qrlock"]
            pin_doors = [d for d in doors if d.get("type", "").startswith("pin")]
            
            print(f"   - QR Doors: {len(qr_doors)}")
            print(f"   - PIN Doors: {len(pin_doors)}")
            print(f"   - Total Doors: {len(doors)}")
            
        except Exception as e:
            print(f"❌ Error creating configuration for room {room_name}: {str(e)}")


def create_sample_config() -> List[Dict[str, Any]]:
    """Create sample room configurations"""
    return [
        {
            "roomName": "101",
            "roomType": "standard",
            "description": "Standard room on first floor",
            "doors": [
                {
                    "name": "Main Entrance",
                    "readerId": "12345",
                    "type": "qrlock",
                    "description": "Building main entrance"
                },
                {
                    "name": "Elevator Access",
                    "readerId": "12346", 
                    "type": "qrlock",
                    "description": "Elevator to floor 1"
                },
                {
                    "name": "Room 101 Door",
                    "readerId": "12347",
                    "type": "qrlock",
                    "description": "Room 101 entrance"
                }
            ]
        },
        {
            "roomName": "102",
            "roomType": "standard",
            "description": "Standard room on first floor",
            "doors": [
                {
                    "name": "Main Entrance",
                    "readerId": "12345",
                    "type": "qrlock",
                    "description": "Building main entrance"
                },
                {
                    "name": "Elevator Access",
                    "readerId": "12346",
                    "type": "qrlock", 
                    "description": "Elevator to floor 1"
                },
                {
                    "name": "Room 102 Door",
                    "readerId": "12348",
                    "type": "qrlock",
                    "description": "Room 102 entrance"
                },
                {
                    "name": "Laundry Room",
                    "readerId": "12349",
                    "type": "pin4",
                    "pin": "1234",
                    "description": "Shared laundry facility"
                }
            ]
        },
        {
            "roomName": "201",
            "roomType": "deluxe",
            "description": "Deluxe room on second floor",
            "doors": [
                {
                    "name": "Main Entrance",
                    "readerId": "12345",
                    "type": "qrlock",
                    "description": "Building main entrance"
                },
                {
                    "name": "Elevator Access",
                    "readerId": "12346",
                    "type": "qrlock",
                    "description": "Elevator access"
                },
                {
                    "name": "Floor 2 Access",
                    "readerId": "12350",
                    "type": "qrlock",
                    "description": "Second floor access"
                },
                {
                    "name": "Room 201 Door",
                    "readerId": "12351",
                    "type": "qrlock",
                    "description": "Room 201 entrance"
                },
                {
                    "name": "Gym Access",
                    "readerId": "12352",
                    "type": "pin6",
                    "pin": "123456",
                    "description": "Fitness center access"
                }
            ]
        }
    ]


def load_config_from_file(file_path: str) -> List[Dict[str, Any]]:
    """Load room configurations from JSON file"""
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading config file {file_path}: {str(e)}")
        return []


def main():
    """Main function"""
    import time
    
    if len(sys.argv) < 3:
        print("Usage: python setup_room_config.py <table_name> <client_name> [config_file.json]")
        print("Example: python setup_room_config.py harmonest-main harmonest")
        print("Example: python setup_room_config.py harmonest-main harmonest rooms.json")
        sys.exit(1)
    
    table_name = sys.argv[1]
    client_name = sys.argv[2]
    config_file = sys.argv[3] if len(sys.argv) > 3 else None
    
    # Load configurations
    if config_file:
        print(f"Loading room configurations from: {config_file}")
        room_configs = load_config_from_file(config_file)
        if not room_configs:
            print("No configurations loaded from file. Exiting.")
            sys.exit(1)
    else:
        print("Using sample room configurations")
        room_configs = create_sample_config()
    
    # Setup configurations
    setup_room_config(table_name, client_name, room_configs)
    
    print(f"\n✅ Room configuration setup complete!")
    print(f"Created {len(room_configs)} room configurations for client '{client_name}'")


def create_sample_config_file():
    """Create a sample configuration file"""
    sample_config = create_sample_config()
    
    with open("sample_room_config.json", "w") as f:
        json.dump(sample_config, f, indent=2)
    
    print("Sample configuration file created: sample_room_config.json")
    print("You can modify this file and use it with the setup script.")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--create-sample":
        create_sample_config_file()
    else:
        main()
