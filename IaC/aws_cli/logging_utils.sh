#!/bin/bash

# Logging Utilities for Harmonest AWS Scripts
# Provides centralized logging functionality for all shell scripts

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Get current timestamp
get_timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

# Get log filename based on script name and date
get_log_file() {
    local script_name="$1"
    local date_str=$(date '+%Y%m%d')
    echo "$LOG_DIR/${script_name}_${date_str}.log"
}

# Initialize logging for a script
init_logging() {
    local script_name="$1"
    local env="$2"
    
    LOG_FILE=$(get_log_file "$script_name")
    
    # Create log entry
    echo "========================================" >> "$LOG_FILE"
    echo "Script: $script_name" >> "$LOG_FILE"
    echo "Environment: $env" >> "$LOG_FILE"
    echo "Started: $(get_timestamp)" >> "$LOG_FILE"
    echo "User: $(whoami)" >> "$LOG_FILE"
    echo "AWS Profile: ${AWS_PROFILE:-'default'}" >> "$LOG_FILE"
    echo "Region: ${REGION:-'us-east-1'}" >> "$LOG_FILE"
    echo "========================================" >> "$LOG_FILE"
    
    # Also log to console
    echo -e "${BLUE}📝 Logging to: $LOG_FILE${NC}"
}

# Log info message
log_info() {
    local message="$1"
    local timestamp=$(get_timestamp)
    
    echo -e "${BLUE}ℹ️  $message${NC}"
    echo "[$timestamp] INFO: $message" >> "$LOG_FILE"
}

# Log success message
log_success() {
    local message="$1"
    local timestamp=$(get_timestamp)
    
    echo -e "${GREEN}✅ $message${NC}"
    echo "[$timestamp] SUCCESS: $message" >> "$LOG_FILE"
}

# Log warning message
log_warning() {
    local message="$1"
    local timestamp=$(get_timestamp)
    
    echo -e "${YELLOW}⚠️  $message${NC}"
    echo "[$timestamp] WARNING: $message" >> "$LOG_FILE"
}

# Log error message
log_error() {
    local message="$1"
    local timestamp=$(get_timestamp)
    
    echo -e "${RED}❌ $message${NC}"
    echo "[$timestamp] ERROR: $message" >> "$LOG_FILE"
}

# Log command execution
log_command() {
    local command="$1"
    local timestamp=$(get_timestamp)
    
    echo -e "${CYAN}🔧 Executing: $command${NC}"
    echo "[$timestamp] COMMAND: $command" >> "$LOG_FILE"
}

# Log AWS API call
log_aws_call() {
    local service="$1"
    local operation="$2"
    local resource="$3"
    local timestamp=$(get_timestamp)
    
    echo -e "${PURPLE}☁️  AWS $service: $operation $resource${NC}"
    echo "[$timestamp] AWS_API: $service.$operation $resource" >> "$LOG_FILE"
}

# Log step start
log_step() {
    local step_number="$1"
    local step_description="$2"
    local timestamp=$(get_timestamp)
    
    echo -e "${BLUE}🔄 Step $step_number: $step_description${NC}"
    echo "[$timestamp] STEP: $step_number - $step_description" >> "$LOG_FILE"
}

# Log configuration
log_config() {
    local key="$1"
    local value="$2"
    local timestamp=$(get_timestamp)
    
    echo -e "${CYAN}⚙️  Config: $key = $value${NC}"
    echo "[$timestamp] CONFIG: $key = $value" >> "$LOG_FILE"
}

# Log resource creation
log_resource_created() {
    local resource_type="$1"
    local resource_id="$2"
    local timestamp=$(get_timestamp)
    
    echo -e "${GREEN}🎉 Created $resource_type: $resource_id${NC}"
    echo "[$timestamp] RESOURCE_CREATED: $resource_type = $resource_id" >> "$LOG_FILE"
}

# Log resource deletion
log_resource_deleted() {
    local resource_type="$1"
    local resource_id="$2"
    local timestamp=$(get_timestamp)
    
    echo -e "${RED}🗑️  Deleted $resource_type: $resource_id${NC}"
    echo "[$timestamp] RESOURCE_DELETED: $resource_type = $resource_id" >> "$LOG_FILE"
}

# Log script completion
finish_logging() {
    local exit_code="$1"
    local timestamp=$(get_timestamp)
    
    if [ "$exit_code" -eq 0 ]; then
        echo -e "${GREEN}🎉 Script completed successfully${NC}"
        echo "[$timestamp] COMPLETED: Script finished successfully (exit code: $exit_code)" >> "$LOG_FILE"
    else
        echo -e "${RED}💥 Script failed with exit code: $exit_code${NC}"
        echo "[$timestamp] FAILED: Script failed (exit code: $exit_code)" >> "$LOG_FILE"
    fi
    
    echo "========================================" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
}

# Function to execute AWS command with logging
execute_aws_command() {
    local service="$1"
    local operation="$2"
    local resource="$3"
    shift 3
    local aws_command="$@"
    
    log_aws_call "$service" "$operation" "$resource"
    log_command "aws $aws_command"
    
    # Execute the command and capture output
    local output
    local exit_code
    
    output=$(eval "aws $aws_command" 2>&1)
    exit_code=$?
    
    # Log the result
    if [ $exit_code -eq 0 ]; then
        log_success "$service $operation completed successfully"
        echo "[$timestamp] AWS_OUTPUT: $output" >> "$LOG_FILE"
    else
        log_error "$service $operation failed: $output"
        echo "[$timestamp] AWS_ERROR: $output" >> "$LOG_FILE"
    fi
    
    return $exit_code
}

# Function to show recent logs
show_logs() {
    local script_name="$1"
    local lines="${2:-50}"
    
    local log_file=$(get_log_file "$script_name")
    
    if [ -f "$log_file" ]; then
        echo -e "${BLUE}📋 Last $lines lines from $log_file:${NC}"
        echo "----------------------------------------"
        tail -n "$lines" "$log_file"
        echo "----------------------------------------"
    else
        echo -e "${YELLOW}⚠️  No log file found: $log_file${NC}"
    fi
}

# Function to list all log files
list_logs() {
    echo -e "${BLUE}📋 Available log files:${NC}"
    
    if [ -d "$LOG_DIR" ]; then
        ls -la "$LOG_DIR"/*.log 2>/dev/null | while read -r line; do
            echo "  $line"
        done
    else
        echo -e "${YELLOW}⚠️  No logs directory found${NC}"
    fi
}

# Function to clean old logs (older than 30 days)
clean_old_logs() {
    local days="${1:-30}"
    
    log_info "Cleaning logs older than $days days"
    
    if [ -d "$LOG_DIR" ]; then
        find "$LOG_DIR" -name "*.log" -type f -mtime +$days -delete
        log_success "Old logs cleaned"
    else
        log_warning "No logs directory found"
    fi
}

# Export functions for use in other scripts
export -f get_timestamp get_log_file init_logging log_info log_success log_warning log_error
export -f log_command log_aws_call log_step log_config log_resource_created log_resource_deleted
export -f finish_logging execute_aws_command show_logs list_logs clean_old_logs
