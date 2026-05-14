#!/bin/bash

# Multi-Tenant Testing Script
# Runs comprehensive tests across all client configurations

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
TEST_TYPE="all"
CLIENT_NAME=""
ENVIRONMENT=""
DEPLOYED_ONLY=false
VERBOSE=false
COVERAGE=false
PARALLEL=false
OUTPUT_DIR="test-results"

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

Run comprehensive tests for the multi-tenant hotel management system.

OPTIONS:
    -t, --type TYPE         Type of tests to run (unit|integration|config|feature|api|all)
    -c, --client CLIENT     Test specific client only
    -e, --env ENV           Test specific environment only
    -d, --deployed-only     Test only deployed environments
    -v, --verbose           Verbose output
    --coverage              Generate coverage report
    --parallel              Run tests in parallel
    -o, --output DIR        Output directory for test results
    -h, --help              Show this help message

TEST TYPES:
    unit                    Unit tests (fast, no AWS resources)
    integration             Integration tests (require mocked AWS)
    config                  Configuration validation tests
    feature                 Feature-specific tests
    api                     API endpoint tests
    e2e                     End-to-end tests (require deployed resources)
    all                     All test types

EXAMPLES:
    $0                                      # Run all tests
    $0 -t unit                              # Run only unit tests
    $0 -c harmonest                         # Test only harmonest client
    $0 -c harmonest -e prod                 # Test harmonest prod environment
    $0 -d                                   # Test only deployed environments
    $0 -t integration --coverage            # Run integration tests with coverage
    $0 -t e2e -d                           # Run end-to-end tests on deployed environments

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            TEST_TYPE="$2"
            shift 2
            ;;
        -c|--client)
            CLIENT_NAME="$2"
            shift 2
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -d|--deployed-only)
            DEPLOYED_ONLY=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --coverage)
            COVERAGE=true
            shift
            ;;
        --parallel)
            PARALLEL=true
            shift
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
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

print_status "Multi-Tenant Hotel Management System Testing"
print_status "============================================"
print_status "Test Type: $TEST_TYPE"
print_status "Project Root: $PROJECT_ROOT"

# Change to project root
cd "$PROJECT_ROOT"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if pytest is installed
if ! command -v pytest &> /dev/null; then
    print_error "pytest is not installed. Please install it with: pip install pytest"
    exit 1
fi

# Install test dependencies if needed
print_status "Installing test dependencies..."
pip install -q pytest pytest-cov pytest-xdist moto boto3 requests

# Build pytest command
PYTEST_CMD="pytest"

# Add test markers based on test type
case $TEST_TYPE in
    unit)
        PYTEST_CMD="$PYTEST_CMD -m unit"
        ;;
    integration)
        PYTEST_CMD="$PYTEST_CMD -m integration"
        ;;
    config)
        PYTEST_CMD="$PYTEST_CMD -m config"
        ;;
    feature)
        PYTEST_CMD="$PYTEST_CMD -m feature"
        ;;
    api)
        PYTEST_CMD="$PYTEST_CMD -m api"
        ;;
    e2e)
        PYTEST_CMD="$PYTEST_CMD -m e2e"
        ;;
    all)
        # Run all tests
        ;;
    *)
        print_error "Unknown test type: $TEST_TYPE"
        exit 1
        ;;
esac

# Add client filter
if [[ -n "$CLIENT_NAME" ]]; then
    PYTEST_CMD="$PYTEST_CMD --client $CLIENT_NAME"
    print_status "Testing client: $CLIENT_NAME"
fi

# Add environment filter
if [[ -n "$ENVIRONMENT" ]]; then
    PYTEST_CMD="$PYTEST_CMD --env $ENVIRONMENT"
    print_status "Testing environment: $ENVIRONMENT"
fi

# Add deployed-only filter
if [[ "$DEPLOYED_ONLY" == "true" ]]; then
    PYTEST_CMD="$PYTEST_CMD --deployed-only"
    print_status "Testing deployed environments only"
fi

# Add verbose output
if [[ "$VERBOSE" == "true" ]]; then
    PYTEST_CMD="$PYTEST_CMD -v -s"
fi

# Add coverage
if [[ "$COVERAGE" == "true" ]]; then
    PYTEST_CMD="$PYTEST_CMD --cov=functions --cov=config --cov-report=html:$OUTPUT_DIR/coverage --cov-report=term"
    print_status "Coverage reporting enabled"
fi

# Add parallel execution
if [[ "$PARALLEL" == "true" ]]; then
    PYTEST_CMD="$PYTEST_CMD -n auto"
    print_status "Parallel execution enabled"
fi

# Add output options
PYTEST_CMD="$PYTEST_CMD --junitxml=$OUTPUT_DIR/junit.xml --html=$OUTPUT_DIR/report.html --self-contained-html"

# Add test directory
PYTEST_CMD="$PYTEST_CMD tests/"

print_status "Running tests..."
print_status "Command: $PYTEST_CMD"
echo

# Run the tests
if eval "$PYTEST_CMD"; then
    echo
    print_success "All tests completed successfully!"
    
    # Show results summary
    if [[ -f "$OUTPUT_DIR/junit.xml" ]]; then
        print_status "Test results saved to: $OUTPUT_DIR/junit.xml"
    fi
    
    if [[ -f "$OUTPUT_DIR/report.html" ]]; then
        print_status "HTML report saved to: $OUTPUT_DIR/report.html"
    fi
    
    if [[ "$COVERAGE" == "true" && -d "$OUTPUT_DIR/coverage" ]]; then
        print_status "Coverage report saved to: $OUTPUT_DIR/coverage/index.html"
    fi
    
    # Run dynamic test framework for additional reporting
    print_status "Running dynamic test framework..."
    if python tests/framework/dynamic_test_framework.py --report "$OUTPUT_DIR/dynamic_test_report.md"; then
        print_status "Dynamic test report saved to: $OUTPUT_DIR/dynamic_test_report.md"
    fi
    
else
    echo
    print_error "Some tests failed!"
    print_status "Check the test output above for details"
    print_status "Test results saved to: $OUTPUT_DIR/"
    
    # Still generate reports for failed tests
    if [[ -f "$OUTPUT_DIR/junit.xml" ]]; then
        print_status "JUnit XML: $OUTPUT_DIR/junit.xml"
    fi
    
    if [[ -f "$OUTPUT_DIR/report.html" ]]; then
        print_status "HTML report: $OUTPUT_DIR/report.html"
    fi
    
    exit 1
fi

# Additional validation for multi-tenant setup
print_status "Running additional multi-tenant validation..."

# Check for hardcoded references
print_status "Checking for hardcoded references..."
HARDCODED_FOUND=false

# Check Python files for hardcoded "harmonest" (case insensitive)
if grep -r -i "harmonest" functions/ --include="*.py" | grep -v "# Allow harmonest" | grep -v "test" > /dev/null; then
    print_warning "Found potential hardcoded 'harmonest' references in functions/"
    grep -r -i "harmonest" functions/ --include="*.py" | grep -v "# Allow harmonest" | grep -v "test" | head -5
    HARDCODED_FOUND=true
fi

# Check CDK files for hardcoded references
if grep -r -i "harmonest" cdk/ --include="*.py" | grep -v "# Allow harmonest" | grep -v "test" > /dev/null; then
    print_warning "Found potential hardcoded 'harmonest' references in cdk/"
    grep -r -i "harmonest" cdk/ --include="*.py" | grep -v "# Allow harmonest" | grep -v "test" | head -5
    HARDCODED_FOUND=true
fi

if [[ "$HARDCODED_FOUND" == "true" ]]; then
    print_warning "Please review hardcoded references to ensure they are intentional"
    print_warning "Use environment variables or configuration for client-specific values"
else
    print_success "No hardcoded references found"
fi

# Summary
echo
print_status "Testing Summary"
print_status "==============="
print_status "Test Type: $TEST_TYPE"
if [[ -n "$CLIENT_NAME" ]]; then
    print_status "Client: $CLIENT_NAME"
fi
if [[ -n "$ENVIRONMENT" ]]; then
    print_status "Environment: $ENVIRONMENT"
fi
print_status "Results Directory: $OUTPUT_DIR"

echo
print_success "Multi-tenant testing completed!"
print_status "Review the reports in $OUTPUT_DIR/ for detailed results"
