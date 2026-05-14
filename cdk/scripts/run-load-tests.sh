#!/bin/bash

# Multi-Tenant Load Testing Script
# Runs load tests against deployed environments to validate performance and isolation

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
CLIENT_NAME=""
ENVIRONMENT="prod"
API_URL=""
USERS=10
SPAWN_RATE=2
DURATION=300  # 5 minutes
TEST_TYPE="mixed"
OUTPUT_DIR="load-test-results"
HEADLESS=false

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Run load tests against the multi-tenant hotel management system.

OPTIONS:
    -c, --client CLIENT     Test specific client (required if no API URL)
    -e, --env ENV           Environment to test (default: prod)
    -u, --url URL           API base URL (overrides client/env lookup)
    --users USERS           Number of concurrent users (default: 10)
    --spawn-rate RATE       User spawn rate per second (default: 2)
    --duration SECONDS      Test duration in seconds (default: 300)
    -t, --type TYPE         Test type (checkin|listings|email|mixed) (default: mixed)
    -o, --output DIR        Output directory for results (default: load-test-results)
    --headless              Run without web UI
    -h, --help              Show this help message

TEST TYPES:
    checkin                 Focus on check-in operations
    listings                Focus on listings and search
    email                   Focus on email verification
    mixed                   Mixed workload (default)

EXAMPLES:
    $0 -c harmonest                        # Test harmonest client
    $0 -c harmonest -e dev                 # Test harmonest dev environment
    $0 -u https://api.example.com          # Test specific API URL
    $0 --users 50 --duration 600           # 50 users for 10 minutes
    $0 -t checkin --headless               # Headless check-in test

REQUIREMENTS:
    - Locust must be installed: pip install locust
    - Target environment must be deployed and accessible
    - Client configuration must exist in config/clients/

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--client)
            CLIENT_NAME="$2"
            shift 2
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -u|--url)
            API_URL="$2"
            shift 2
            ;;
        --users)
            USERS="$2"
            shift 2
            ;;
        --spawn-rate)
            SPAWN_RATE="$2"
            shift 2
            ;;
        --duration)
            DURATION="$2"
            shift 2
            ;;
        -t|--type)
            TEST_TYPE="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --headless)
            HEADLESS=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        -*)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
        *)
            print_error "Unexpected argument: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

print_status "Multi-Tenant Load Testing"
print_status "=========================="

# Change to project root
cd "$PROJECT_ROOT"

# Check if locust is installed
if ! command -v locust &> /dev/null; then
    print_error "Locust is not installed. Please install it with: pip install locust"
    exit 1
fi

# Determine API URL if not provided
if [[ -z "$API_URL" ]]; then
    if [[ -z "$CLIENT_NAME" ]]; then
        print_error "Either --client or --url must be specified"
        exit 1
    fi
    
    print_status "Looking up API URL for client: $CLIENT_NAME, environment: $ENVIRONMENT"
    
    # Load client configuration to get AWS profile
    if ! python config/config_manager.py validate "$CLIENT_NAME" > /dev/null 2>&1; then
        print_error "Client configuration validation failed for: $CLIENT_NAME"
        exit 1
    fi
    
    # Get AWS profile from configuration
    AWS_PROFILE=$(python -c "
import sys
sys.path.insert(0, 'config')
from config_manager import ConfigManager
config = ConfigManager().load_client_config('$CLIENT_NAME')
print(config['client']['aws']['profile'])
")
    
    print_status "Using AWS profile: $AWS_PROFILE"
    
    # Try to get API URL from SSM
    API_URL=$(aws ssm get-parameter \
        --name "/$CLIENT_NAME/$ENVIRONMENT/api/url" \
        --profile "$AWS_PROFILE" \
        --query "Parameter.Value" \
        --output text 2>/dev/null || echo "")
    
    if [[ -z "$API_URL" || "$API_URL" == "None" ]]; then
        print_error "Could not find API URL for $CLIENT_NAME/$ENVIRONMENT"
        print_error "Make sure the environment is deployed and SSM parameters are set"
        exit 1
    fi
fi

print_status "Target API URL: $API_URL"
print_status "Test Configuration:"
print_status "  Users: $USERS"
print_status "  Spawn Rate: $SPAWN_RATE/sec"
print_status "  Duration: $DURATION seconds"
print_status "  Test Type: $TEST_TYPE"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Build locust command
LOCUST_CMD="locust"

# Add locustfile
LOCUST_CMD="$LOCUST_CMD -f tests/load_testing/locustfile.py"

# Add host
LOCUST_CMD="$LOCUST_CMD --host $API_URL"

# Add user classes based on test type
case $TEST_TYPE in
    checkin)
        LOCUST_CMD="$LOCUST_CMD CheckinUser"
        ;;
    listings)
        LOCUST_CMD="$LOCUST_CMD PublicListingsUser"
        ;;
    email)
        LOCUST_CMD="$LOCUST_CMD EmailVerificationUser"
        ;;
    mixed)
        LOCUST_CMD="$LOCUST_CMD LightLoadScenario MediumLoadScenario HeavyLoadScenario"
        ;;
    *)
        print_error "Unknown test type: $TEST_TYPE"
        exit 1
        ;;
esac

# Add test parameters
LOCUST_CMD="$LOCUST_CMD --users $USERS --spawn-rate $SPAWN_RATE --run-time ${DURATION}s"

# Add output options
LOCUST_CMD="$LOCUST_CMD --html $OUTPUT_DIR/report.html --csv $OUTPUT_DIR/results"

# Add headless mode if requested
if [[ "$HEADLESS" == "true" ]]; then
    LOCUST_CMD="$LOCUST_CMD --headless"
    print_status "Running in headless mode"
else
    print_status "Web UI will be available at http://localhost:8089"
    print_warning "Test will start automatically in headless mode after 10 seconds if not started manually"
    LOCUST_CMD="$LOCUST_CMD --autostart"
fi

# Set environment variables for the test
export LOAD_TEST_CLIENT="$CLIENT_NAME"
export LOAD_TEST_ENVIRONMENT="$ENVIRONMENT"
export LOAD_TEST_API_URL="$API_URL"

print_status "Starting load test..."
print_status "Command: $LOCUST_CMD"
echo

# Run the load test
if eval "$LOCUST_CMD"; then
    echo
    print_success "Load test completed successfully!"
    
    # Show results summary
    print_status "Results saved to: $OUTPUT_DIR/"
    
    if [[ -f "$OUTPUT_DIR/report.html" ]]; then
        print_status "HTML report: $OUTPUT_DIR/report.html"
    fi
    
    if [[ -f "$OUTPUT_DIR/results_stats.csv" ]]; then
        print_status "CSV results: $OUTPUT_DIR/results_*.csv"
        
        # Show quick summary
        print_status "Quick Summary:"
        echo "Request Type,Request Count,Failure Count,Average Response Time,Min Response Time,Max Response Time"
        tail -n +2 "$OUTPUT_DIR/results_stats.csv" | head -10
    fi
    
    # Check for failures
    if [[ -f "$OUTPUT_DIR/results_failures.csv" ]]; then
        FAILURE_COUNT=$(wc -l < "$OUTPUT_DIR/results_failures.csv")
        if [[ $FAILURE_COUNT -gt 1 ]]; then  # Header line counts as 1
            print_warning "Found $((FAILURE_COUNT - 1)) failures - check $OUTPUT_DIR/results_failures.csv"
        else
            print_success "No failures detected"
        fi
    fi
    
else
    echo
    print_error "Load test failed!"
    print_status "Check the output above for details"
    print_status "Results (if any) saved to: $OUTPUT_DIR/"
    exit 1
fi

# Performance analysis
print_status "Performing basic performance analysis..."

if [[ -f "$OUTPUT_DIR/results_stats.csv" ]]; then
    # Check for performance issues
    python3 << EOF
import csv
import sys

try:
    with open('$OUTPUT_DIR/results_stats.csv', 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['Type'] == 'Aggregated':
                continue
            
            avg_time = float(row['Average Response Time'])
            failure_rate = float(row['Failure Count']) / max(float(row['Request Count']), 1) * 100
            
            print(f"Endpoint: {row['Name']}")
            print(f"  Requests: {row['Request Count']}")
            print(f"  Avg Response Time: {avg_time:.1f}ms")
            print(f"  Failure Rate: {failure_rate:.1f}%")
            
            # Performance warnings
            if avg_time > 2000:
                print(f"  ⚠️  High response time (>{avg_time:.1f}ms)")
            if failure_rate > 5:
                print(f"  ⚠️  High failure rate ({failure_rate:.1f}%)")
            if failure_rate == 0 and avg_time < 500:
                print(f"  ✅ Good performance")
            print()
            
except Exception as e:
    print(f"Error analyzing results: {e}")
EOF
fi

echo
print_success "Load testing completed!"
print_status "Review the detailed reports in $OUTPUT_DIR/ for comprehensive analysis"
