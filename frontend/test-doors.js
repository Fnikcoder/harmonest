// Test script to add sample doors to DynamoDB
// Run this with: node test-doors.js

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

// Configuration
const TABLE_NAME = 'harmonest-main';
const REGION = 'eu-central-1';

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: REGION,
  // Uses AWS CLI profile: harmonestadmin
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Sample doors data
const sampleDoors = [
  {
    PK: 'DOOR#door_001',
    SK: 'METADATA',
    id: 'door_001',
    name: 'Main Entrance',
    type: 'qrlock',
    readerId: 'QR_READER_001',
    property: 'Building A',
    location: 'Ground Floor',
    floor: '0',
    building: 'A',
    isActive: true,
    batteryLevel: 85,
    lastActivity: Date.now() - 3600000, // 1 hour ago
    description: 'Main entrance door with QR lock system',
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    PK: 'DOOR#door_002',
    SK: 'METADATA',
    id: 'door_002',
    name: 'Apartment 101',
    type: 'ttlock',
    readerId: 'TT_READER_002',
    property: 'Building A',
    location: 'First Floor',
    floor: '1',
    building: 'A',
    isActive: true,
    batteryLevel: 92,
    lastActivity: Date.now() - 7200000, // 2 hours ago
    description: 'Apartment 101 door with TT lock system',
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    PK: 'DOOR#door_003',
    SK: 'METADATA',
    id: 'door_003',
    name: 'Emergency Exit',
    type: 'qrlock',
    readerId: 'QR_READER_003',
    property: 'Building B',
    location: 'Ground Floor',
    floor: '0',
    building: 'B',
    isActive: false,
    batteryLevel: 45,
    lastActivity: Date.now() - 86400000, // 24 hours ago
    description: 'Emergency exit door - currently under maintenance',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

async function addSampleDoors() {
  console.log('🔄 Adding sample doors to DynamoDB...');
  
  try {
    for (const door of sampleDoors) {
      const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: door
      });
      
      await docClient.send(command);
      console.log(`✅ Added door: ${door.name} (${door.id})`);
    }
    
    console.log('🎉 All sample doors added successfully!');
  } catch (error) {
    console.error('❌ Error adding doors:', error);
  }
}

async function listDoors() {
  console.log('🔄 Listing all doors from DynamoDB...');
  
  try {
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'DOOR#'
      }
    });
    
    const result = await docClient.send(command);
    const doors = result.Items || [];
    
    console.log(`📋 Found ${doors.length} doors:`);
    doors.forEach(door => {
      console.log(`  - ${door.name} (${door.type}) - ${door.isActive ? 'Active' : 'Inactive'} - Battery: ${door.batteryLevel}%`);
    });
  } catch (error) {
    console.error('❌ Error listing doors:', error);
  }
}

async function main() {
  console.log('🚪 Door Management Test Script');
  console.log('===============================');
  
  // First, list existing doors
  await listDoors();
  
  console.log('\n');
  
  // Add sample doors
  await addSampleDoors();
  
  console.log('\n');
  
  // List doors again to verify
  await listDoors();
}

// Run the script
main().catch(console.error);
