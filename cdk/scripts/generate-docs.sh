#!/bin/bash

# Dynamic Documentation Generation Script
# Generates client-specific documentation based on configuration

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
OUTPUT_DIR=""
GENERATE_ALL=false
SERVE_DOCS=false
PORT=8080

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

Generate dynamic documentation for client configurations.

OPTIONS:
    -c, --client CLIENT     Generate documentation for specific client
    -e, --env ENV           Environment to document (default: prod)
    -o, --output DIR        Output directory for documentation
    -a, --all               Generate documentation for all clients
    -s, --serve             Serve documentation with local web server
    -p, --port PORT         Port for web server (default: 8080)
    -h, --help              Show this help message

EXAMPLES:
    $0 -c harmonest                    # Generate docs for harmonest client
    $0 -a                              # Generate docs for all clients
    $0 -c harmonest -e dev             # Generate docs for harmonest dev environment
    $0 -a -o /tmp/docs                 # Generate all docs to specific directory
    $0 -a -s                           # Generate all docs and serve with web server

REQUIREMENTS:
    - Python 3.8+ with jinja2 package
    - Client configurations in config/clients/
    - Valid AWS credentials for deployed environments

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
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -a|--all)
            GENERATE_ALL=true
            shift
            ;;
        -s|--serve)
            SERVE_DOCS=true
            shift
            ;;
        -p|--port)
            PORT="$2"
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

print_status "Dynamic Documentation Generator"
print_status "==============================="

# Change to project root
cd "$PROJECT_ROOT"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed or not in PATH"
    exit 1
fi

# Check if jinja2 is installed
if ! python3 -c "import jinja2" &> /dev/null; then
    print_warning "Jinja2 not found. Installing..."
    pip install jinja2
fi

# Build documentation generation command
DOC_CMD="python3 docs/generate_docs.py"

# Add output directory if specified
if [[ -n "$OUTPUT_DIR" ]]; then
    DOC_CMD="$DOC_CMD --output $OUTPUT_DIR"
    print_status "Output directory: $OUTPUT_DIR"
fi

# Add environment
DOC_CMD="$DOC_CMD --environment $ENVIRONMENT"

# Generate documentation
if [[ "$GENERATE_ALL" == "true" ]]; then
    print_status "Generating documentation for all clients..."
    DOC_CMD="$DOC_CMD --all"
    
    if eval "$DOC_CMD"; then
        print_success "Documentation generated for all clients"
    else
        print_error "Failed to generate documentation"
        exit 1
    fi
    
elif [[ -n "$CLIENT_NAME" ]]; then
    print_status "Generating documentation for client: $CLIENT_NAME"
    DOC_CMD="$DOC_CMD --client $CLIENT_NAME"
    
    if eval "$DOC_CMD"; then
        print_success "Documentation generated for $CLIENT_NAME"
    else
        print_error "Failed to generate documentation for $CLIENT_NAME"
        exit 1
    fi
    
else
    print_error "Either --client or --all must be specified"
    show_usage
    exit 1
fi

# Determine documentation directory
if [[ -n "$OUTPUT_DIR" ]]; then
    DOCS_DIR="$OUTPUT_DIR"
else
    DOCS_DIR="$PROJECT_ROOT/docs/generated"
fi

# Create index page for all clients
if [[ "$GENERATE_ALL" == "true" ]]; then
    print_status "Creating master index page..."
    
    INDEX_FILE="$DOCS_DIR/index.html"
    
    cat > "$INDEX_FILE" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Multi-Tenant Hotel Management System - Documentation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 10px;
            margin-bottom: 2rem;
            text-align: center;
        }
        .client-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        .client-card {
            background: white;
            border-radius: 10px;
            padding: 1.5rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .client-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        .client-name {
            font-size: 1.25rem;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 0.5rem;
        }
        .client-description {
            color: #7f8c8d;
            margin-bottom: 1rem;
        }
        .doc-links {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        .doc-link {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            background: #3498db;
            color: white;
            text-decoration: none;
            border-radius: 15px;
            font-size: 0.875rem;
            transition: background-color 0.2s;
        }
        .doc-link:hover {
            background: #2980b9;
        }
        .footer {
            text-align: center;
            color: #7f8c8d;
            margin-top: 2rem;
            padding-top: 2rem;
            border-top: 1px solid #ecf0f1;
        }
        .stats {
            display: flex;
            justify-content: center;
            gap: 2rem;
            margin: 1rem 0;
        }
        .stat {
            text-align: center;
        }
        .stat-number {
            font-size: 2rem;
            font-weight: bold;
            color: #3498db;
        }
        .stat-label {
            font-size: 0.875rem;
            color: #7f8c8d;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Multi-Tenant Hotel Management System</h1>
        <p>Dynamic Documentation Portal</p>
        <div class="stats">
            <div class="stat">
                <div class="stat-number" id="client-count">0</div>
                <div class="stat-label">Clients</div>
            </div>
            <div class="stat">
                <div class="stat-number" id="doc-count">0</div>
                <div class="stat-label">Documentation Files</div>
            </div>
        </div>
    </div>

    <div class="client-grid" id="client-grid">
        <!-- Client cards will be inserted here -->
    </div>

    <div class="footer">
        <p>Generated on <span id="generation-date"></span></p>
        <p>Documentation automatically generated from client configurations</p>
    </div>

    <script>
        // Set generation date
        document.getElementById('generation-date').textContent = new Date().toLocaleString();

        // Load client data and generate cards
        async function loadClientData() {
            const clientGrid = document.getElementById('client-grid');
            const clientDirs = [];
            
            // This would normally be populated by the shell script
            // For now, we'll scan the directory structure
            try {
                // In a real implementation, this would be populated by the generation script
                const clients = []; // Will be populated by the shell script
                
                document.getElementById('client-count').textContent = clients.length;
                document.getElementById('doc-count').textContent = clients.length * 5; // Assuming 5 docs per client
                
                clients.forEach(client => {
                    const card = createClientCard(client);
                    clientGrid.appendChild(card);
                });
            } catch (error) {
                console.error('Error loading client data:', error);
            }
        }

        function createClientCard(client) {
            const card = document.createElement('div');
            card.className = 'client-card';
            
            card.innerHTML = `
                <div class="client-name">${client.displayName || client.name}</div>
                <div class="client-description">${client.description || 'Hotel management system client'}</div>
                <div class="doc-links">
                    <a href="${client.name}/overview.md" class="doc-link">Overview</a>
                    <a href="${client.name}/api.md" class="doc-link">API</a>
                    <a href="${client.name}/deployment.md" class="doc-link">Deployment</a>
                    <a href="${client.name}/configuration.md" class="doc-link">Configuration</a>
                    <a href="${client.name}/troubleshooting.md" class="doc-link">Troubleshooting</a>
                </div>
            `;
            
            return card;
        }

        // Load data when page loads
        loadClientData();
    </script>
</body>
</html>
EOF

    print_success "Master index page created: $INDEX_FILE"
fi

# Serve documentation if requested
if [[ "$SERVE_DOCS" == "true" ]]; then
    print_status "Starting documentation server on port $PORT..."
    print_status "Documentation available at: http://localhost:$PORT"
    print_warning "Press Ctrl+C to stop the server"
    
    # Try different methods to serve the documentation
    if command -v python3 &> /dev/null; then
        cd "$DOCS_DIR"
        python3 -m http.server "$PORT"
    elif command -v python &> /dev/null; then
        cd "$DOCS_DIR"
        python -m SimpleHTTPServer "$PORT"
    elif command -v npx &> /dev/null; then
        cd "$DOCS_DIR"
        npx serve -p "$PORT"
    else
        print_error "No suitable web server found. Install Python or Node.js to serve documentation."
        print_status "You can manually serve the documentation from: $DOCS_DIR"
    fi
fi

# Summary
echo
print_success "Documentation generation completed!"
print_status "Documentation location: $DOCS_DIR"

if [[ "$GENERATE_ALL" == "true" ]]; then
    # Count generated clients
    CLIENT_COUNT=$(find "$DOCS_DIR" -maxdepth 1 -type d ! -path "$DOCS_DIR" | wc -l)
    print_status "Generated documentation for $CLIENT_COUNT clients"
    
    # List generated clients
    print_status "Generated clients:"
    find "$DOCS_DIR" -maxdepth 1 -type d ! -path "$DOCS_DIR" -exec basename {} \; | sort | while read client; do
        echo "  - $client"
    done
fi

echo
print_status "Next steps:"
print_status "1. Review generated documentation in $DOCS_DIR"
print_status "2. Customize templates in docs/templates/ if needed"
print_status "3. Regenerate documentation after configuration changes"
if [[ "$SERVE_DOCS" != "true" ]]; then
    print_status "4. Use --serve option to start a local web server"
fi
