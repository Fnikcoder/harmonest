#!/usr/bin/env python3
"""
Simple API server for the client configuration web applications.
Provides REST endpoints for managing client configurations.
"""

import os
import sys
import json
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS

# Add the config directory to the Python path
config_dir = Path(__file__).parent.parent
sys.path.insert(0, str(config_dir))

from config_manager import ConfigManager, ConfigurationError

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize configuration manager
config_manager = ConfigManager()

@app.errorhandler(ConfigurationError)
def handle_config_error(error):
    """Handle configuration errors"""
    return jsonify({'error': str(error)}), 400

@app.errorhandler(Exception)
def handle_general_error(error):
    """Handle general errors"""
    app.logger.error(f"Unexpected error: {error}")
    return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/clients', methods=['GET'])
def list_clients():
    """Get list of all clients"""
    try:
        clients = config_manager.list_clients()
        return jsonify({'clients': clients})
    except Exception as e:
        raise ConfigurationError(f"Failed to list clients: {e}")

@app.route('/api/clients/<client_name>', methods=['GET'])
def get_client(client_name):
    """Get configuration for a specific client"""
    try:
        config = config_manager.load_client_config(client_name)
        return jsonify(config)
    except Exception as e:
        raise ConfigurationError(f"Failed to load client {client_name}: {e}")

@app.route('/api/clients/<client_name>', methods=['POST'])
def create_client(client_name):
    """Create a new client with example configuration"""
    try:
        # Check if client already exists
        existing_clients = config_manager.list_clients()
        if client_name in existing_clients:
            raise ConfigurationError(f"Client '{client_name}' already exists")
        
        # Create example configuration
        example_config = config_manager.create_example_client(client_name)
        config_manager.save_client_config(client_name, example_config)
        
        return jsonify(example_config), 201
    except Exception as e:
        raise ConfigurationError(f"Failed to create client {client_name}: {e}")

@app.route('/api/clients/<client_name>', methods=['PUT'])
def update_client(client_name):
    """Update configuration for a specific client"""
    try:
        if not request.is_json:
            raise ConfigurationError("Request must be JSON")
        
        config = request.get_json()
        if not config:
            raise ConfigurationError("Empty configuration provided")
        
        # Validate configuration
        config_manager.validate_config(config, client_name)
        
        # Save configuration
        config_manager.save_client_config(client_name, config)
        
        return jsonify({'message': f'Client {client_name} updated successfully'})
    except Exception as e:
        raise ConfigurationError(f"Failed to update client {client_name}: {e}")

@app.route('/api/clients/<client_name>', methods=['DELETE'])
def delete_client(client_name):
    """Delete a client configuration"""
    try:
        client_dir = config_manager.clients_dir / client_name
        if not client_dir.exists():
            raise ConfigurationError(f"Client '{client_name}' not found")
        
        # Remove the client directory and all its contents
        import shutil
        shutil.rmtree(client_dir)
        
        return jsonify({'message': f'Client {client_name} deleted successfully'})
    except Exception as e:
        raise ConfigurationError(f"Failed to delete client {client_name}: {e}")

@app.route('/api/clients/<client_name>/environments/<env_name>', methods=['GET'])
def get_client_environment(client_name, env_name):
    """Get environment-specific configuration for a client"""
    try:
        config = config_manager.get_environment_config(client_name, env_name)
        return jsonify(config)
    except Exception as e:
        raise ConfigurationError(f"Failed to load environment {env_name} for client {client_name}: {e}")

@app.route('/api/validate', methods=['POST'])
def validate_configuration():
    """Validate a configuration against the schema"""
    try:
        if not request.is_json:
            raise ConfigurationError("Request must be JSON")
        
        config = request.get_json()
        if not config:
            raise ConfigurationError("Empty configuration provided")
        
        # Validate configuration
        config_manager.validate_config(config)
        
        return jsonify({'valid': True, 'message': 'Configuration is valid'})
    except Exception as e:
        raise ConfigurationError(f"Validation failed: {e}")

@app.route('/api/schema', methods=['GET'])
def get_schema():
    """Get the JSON schema for client configuration"""
    try:
        with open(config_manager.schema_file, 'r', encoding='utf-8') as f:
            schema = json.load(f)
        return jsonify(schema)
    except Exception as e:
        raise ConfigurationError(f"Failed to load schema: {e}")

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'config_root': str(config_manager.config_root),
        'clients_count': len(config_manager.list_clients())
    })

@app.route('/', methods=['GET'])
def index():
    """Root endpoint with API information"""
    return jsonify({
        'name': 'Client Configuration API',
        'version': '1.0.0',
        'endpoints': {
            'GET /api/clients': 'List all clients',
            'GET /api/clients/<name>': 'Get client configuration',
            'POST /api/clients/<name>': 'Create new client',
            'PUT /api/clients/<name>': 'Update client configuration',
            'DELETE /api/clients/<name>': 'Delete client',
            'GET /api/clients/<name>/environments/<env>': 'Get environment-specific config',
            'POST /api/validate': 'Validate configuration',
            'GET /api/schema': 'Get JSON schema',
            'GET /api/health': 'Health check'
        }
    })

def main():
    """Run the development server"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Client Configuration API Server')
    parser.add_argument('--host', default='localhost', help='Host to bind to')
    parser.add_argument('--port', type=int, default=8000, help='Port to bind to')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    
    args = parser.parse_args()
    
    print(f"Starting Client Configuration API Server...")
    print(f"Config root: {config_manager.config_root}")
    print(f"Available clients: {', '.join(config_manager.list_clients()) or 'None'}")
    print(f"Server running at http://{args.host}:{args.port}")
    print(f"API documentation at http://{args.host}:{args.port}")
    
    app.run(host=args.host, port=args.port, debug=args.debug)

if __name__ == '__main__':
    main()
