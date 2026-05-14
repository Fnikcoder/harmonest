#!/bin/bash

# Multi-Tenant Client Deployment Script
# Deploys infrastructure for a specific client configuration

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
STACKS=""
DRY_RUN=false
BOOTSTRAP=false
VALIDATE_ONLY=false
FORCE=false

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
Usage: $0 [OPTIONS] CLIENT_NAME

Deploy infrastructure for a specific client configuration.

ARGUMENTS:
    CLIENT_NAME         Name of the client to deploy

OPTIONS:
    -e, --env ENV       Environment to deploy (default: prod)
    -s, --stacks LIST   Comma-separated list of specific stacks to deploy
    -d, --dry-run       Synthesize only, don't deploy
    -b, --bootstrap     Bootstrap AWS environment before deployment
    -v, --validate      Validate configuration only
    -f, --force         Force deployment without confirmation
    -h, --help          Show this help message

EXAMPLES:
    $0 harmonest                           # Deploy harmonest to prod
    $0 -e dev harmonest                    # Deploy harmonest to dev
    $0 -s Core,Api harmonest               # Deploy only Core and Api stacks
    $0 -d harmonest                        # Dry run (synthesize only)
    $0 -b harmonest                        # Bootstrap and deploy
    $0 -v harmonest                        # Validate configuration only

ENVIRONMENT VARIABLES:
    CDK_DEFAULT_ACCOUNT     AWS account ID (optional)
    CDK_DEFAULT_REGION      AWS region (optional)

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -s|--stacks)
            STACKS="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -b|--bootstrap)
            BOOTSTRAP=true
            shift
            ;;
        -v|--validate)
            VALIDATE_ONLY=true
            shift
            ;;
        -f|--force)
            FORCE=true
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
            if [[ -z "$CLIENT_NAME" ]]; then
                CLIENT_NAME="$1"
            else
                print_error "Multiple client names specified: $CLIENT_NAME and $1"
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate required arguments
if [[ -z "$CLIENT_NAME" ]]; then
    print_error "Client name is required"
    show_usage
    exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

print_status "Multi-Tenant Hotel Management System Deployment"
print_status "=============================================="
print_status "Client: $CLIENT_NAME"
print_status "Environment: $ENVIRONMENT"
print_status "Project Root: $PROJECT_ROOT"

# Change to project root
cd "$PROJECT_ROOT"

# Validate client configuration
print_status "Validating client configuration..."
if ! python config/config_manager.py validate "$CLIENT_NAME"; then
    print_error "Client configuration validation failed"
    exit 1
fi
print_success "Configuration validation passed"

# If validate only, exit here
if [[ "$VALIDATE_ONLY" == "true" ]]; then
    print_success "Configuration validation completed successfully"
    exit 0
fi

# Load client configuration to get AWS profile
print_status "Loading client configuration..."
CLIENT_CONFIG=$(python config/config_manager.py show "$CLIENT_NAME" "$ENVIRONMENT" 2>/dev/null)
if [[ $? -ne 0 ]]; then
    print_error "Failed to load client configuration"
    exit 1
fi

# Extract AWS profile from configuration
AWS_PROFILE=$(echo "$CLIENT_CONFIG" | python -c "
import sys, json
try:
    config = json.load(sys.stdin)
    print(config['client']['aws']['profile'])
except:
    print('default')
")

print_status "Using AWS profile: $AWS_PROFILE"

# Bootstrap if requested
if [[ "$BOOTSTRAP" == "true" ]]; then
    print_status "Bootstrapping AWS environment..."
    if ! cdk bootstrap --profile "$AWS_PROFILE"; then
        print_error "Bootstrap failed"
        exit 1
    fi
    print_success "Bootstrap completed"
fi

# Build CDK command
CDK_CMD="cdk"

if [[ "$DRY_RUN" == "true" ]]; then
    CDK_CMD="$CDK_CMD synth"
    print_status "Performing dry run (synthesis only)..."
else
    CDK_CMD="$CDK_CMD deploy"
    print_status "Deploying infrastructure..."
fi

# Add stacks or deploy all
if [[ -n "$STACKS" ]]; then
    # Convert comma-separated list to space-separated
    STACK_LIST=$(echo "$STACKS" | tr ',' ' ')
    CDK_CMD="$CDK_CMD $STACK_LIST"
    print_status "Deploying stacks: $STACKS"
else
    CDK_CMD="$CDK_CMD --all"
    print_status "Deploying all stacks"
fi

# Add context parameters
CDK_CMD="$CDK_CMD --context client=$CLIENT_NAME --context env=$ENVIRONMENT"

# Add AWS profile
CDK_CMD="$CDK_CMD --profile $AWS_PROFILE"

# Add deployment options
if [[ "$DRY_RUN" == "false" ]]; then
    if [[ "$FORCE" == "true" ]]; then
        CDK_CMD="$CDK_CMD --require-approval never"
    fi
    CDK_CMD="$CDK_CMD --progress events"
fi

# Show confirmation unless forced
if [[ "$DRY_RUN" == "false" && "$FORCE" == "false" ]]; then
    echo
    print_warning "About to deploy the following:"
    print_warning "  Client: $CLIENT_NAME"
    print_warning "  Environment: $ENVIRONMENT"
    print_warning "  AWS Profile: $AWS_PROFILE"
    if [[ -n "$STACKS" ]]; then
        print_warning "  Stacks: $STACKS"
    else
        print_warning "  Stacks: All"
    fi
    echo
    read -p "Continue with deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Deployment cancelled"
        exit 0
    fi
fi

# Execute CDK command
print_status "Executing: $CDK_CMD"
echo

if eval "$CDK_CMD"; then
    echo
    if [[ "$DRY_RUN" == "true" ]]; then
        print_success "Synthesis completed successfully"
        print_status "No resources were deployed (dry run mode)"
    else
        print_success "Deployment completed successfully"
        print_status "Infrastructure for $CLIENT_NAME ($ENVIRONMENT) is now available"
        
        # Show useful information
        echo
        print_status "Next steps:"
        print_status "1. Update secrets in AWS Secrets Manager if needed"
        print_status "2. Test API endpoints"
        print_status "3. Monitor CloudWatch logs for any issues"
        print_status "4. Update DNS records if using custom domains"
    fi
else
    echo
    print_error "Deployment failed"
    print_status "Check the error messages above for details"
    print_status "Common issues:"
    print_status "- AWS credentials not configured"
    print_status "- Insufficient permissions"
    print_status "- Resource conflicts"
    print_status "- Configuration validation errors"
    exit 1
fi
