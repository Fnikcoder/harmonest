"""
Enhanced API Gateway Stack with Public and Protected Routes
"""
from aws_cdk import (
    Stack,
    aws_apigateway as apigateway,
    aws_lambda as lambda_,
    Duration,
)
from constructs import Construct


class EnhancedApiStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, env_name: str, 
                 authorizer_function: lambda_.Function = None, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)
        
        self.env_name = env_name
        self.authorizer_function = authorizer_function
        
        # Create main API Gateway
        self.api = apigateway.RestApi(
            self, f"HarmonestMainApi-{env_name}",
            rest_api_name=f"harmonest-main-api-{env_name}",
            description="Harmonest main API with public and protected routes",
            default_cors_preflight_options=apigateway.CorsOptions(
                allow_origins=[
                    "https://harmonest.de",
                    "https://www.harmonest.de",
                    "https://checkin.harmonest.de",
                    "https://www.checkin.harmonest.de",
                    "https://dev.harmonest.de",
                    "https://www.dev.harmonest.de",
                    "http://localhost:4200"
                ],
                allow_methods=apigateway.Cors.ALL_METHODS,
                allow_headers=["Content-Type", "Authorization"]
            )
        )
        
        # Create Lambda authorizer (optional for protected routes)
        if self.authorizer_function:
            self.authorizer = apigateway.TokenAuthorizer(
                self, f"MainApiAuthorizer-{env_name}",
                handler=self.authorizer_function,
                identity_source="method.request.header.Authorization",
                results_cache_ttl=Duration.minutes(5)
            )
        
        # Create route structure
        self.create_public_routes()
        self.create_protected_routes()
    
    def create_public_routes(self):
        """Create public routes that don't require authentication"""
        
        # Public listings routes
        listings_resource = self.api.root.add_resource("listings")
        listing_resource = listings_resource.add_resource("{listingId}")
        
        # Public check-in routes  
        checkin_resource = self.api.root.add_resource("checkin")
        
        # Public email verification routes
        email_verification_resource = self.api.root.add_resource("email-verification")
        
        # Store resources for later use
        self.public_resources = {
            "listings": listings_resource,
            "listing": listing_resource,
            "checkin": checkin_resource,
            "email_verification": email_verification_resource
        }
    
    def create_protected_routes(self):
        """Create protected routes that require authentication"""
        
        # Admin routes (protected)
        admin_resource = self.api.root.add_resource("admin")
        admin_users_resource = admin_resource.add_resource("users")
        admin_user_resource = admin_users_resource.add_resource("{userId}")
        admin_user_groups_resource = admin_user_resource.add_resource("groups")
        admin_user_status_resource = admin_user_resource.add_resource("status")
        
        # System management routes (protected)
        system_resource = admin_resource.add_resource("system")
        system_config_resource = system_resource.add_resource("config")
        system_logs_resource = system_resource.add_resource("logs")
        
        # User profile routes (protected, but accessible by the user themselves)
        profile_resource = self.api.root.add_resource("profile")
        profile_reservations_resource = profile_resource.add_resource("reservations")
        
        # Store resources for later use
        self.protected_resources = {
            "admin": admin_resource,
            "admin_users": admin_users_resource,
            "admin_user": admin_user_resource,
            "admin_user_groups": admin_user_groups_resource,
            "admin_user_status": admin_user_status_resource,
            "system": system_resource,
            "system_config": system_config_resource,
            "system_logs": system_logs_resource,
            "profile": profile_resource,
            "profile_reservations": profile_reservations_resource
        }
    
    def add_public_method(self, resource_name: str, method: str, integration: apigateway.Integration):
        """Add a public method (no authorization required)"""
        resource = self.public_resources.get(resource_name)
        if resource:
            resource.add_method(method, integration)
    
    def add_protected_method(self, resource_name: str, method: str, integration: apigateway.Integration):
        """Add a protected method (authorization required)"""
        resource = self.protected_resources.get(resource_name)
        if resource and self.authorizer:
            resource.add_method(method, integration, authorizer=self.authorizer)
    
    def add_optional_auth_method(self, resource_name: str, method: str, integration: apigateway.Integration):
        """Add a method with optional authentication (enhanced features when signed in)"""
        resource = self.public_resources.get(resource_name)
        if resource:
            # This method doesn't require auth but can use it if provided
            resource.add_method(method, integration)


# Example of how to use this in your existing stacks
class ListingsApiIntegration:
    """Helper class to integrate listings with the enhanced API"""
    
    def __init__(self, api_stack: EnhancedApiStack, listings_function: lambda_.Function):
        self.api_stack = api_stack
        self.listings_function = listings_function
        
        # Create integration
        self.integration = apigateway.LambdaIntegration(
            self.listings_function,
            proxy=True
        )
        
        # Add public methods
        self.setup_public_endpoints()
    
    def setup_public_endpoints(self):
        """Setup public listings endpoints"""
        
        # GET /listings - List all listings (public)
        self.api_stack.add_public_method("listings", "GET", self.integration)
        
        # GET /listings/{listingId} - Get specific listing (public)
        self.api_stack.add_public_method("listing", "GET", self.integration)
        
        # POST /listings/{listingId}/availability - Check availability (public)
        # This would be added to a sub-resource if needed


class CheckinApiIntegration:
    """Helper class to integrate check-in with the enhanced API"""
    
    def __init__(self, api_stack: EnhancedApiStack, checkin_function: lambda_.Function):
        self.api_stack = api_stack
        self.checkin_function = checkin_function
        
        # Create integration
        self.integration = apigateway.LambdaIntegration(
            self.checkin_function,
            proxy=True
        )
        
        # Add public methods (check-in should be accessible without sign-in)
        self.setup_public_endpoints()
    
    def setup_public_endpoints(self):
        """Setup public check-in endpoints"""
        
        # POST /checkin - All check-in operations (public)
        self.api_stack.add_public_method("checkin", "POST", self.integration)
        
        # GET /checkin - Get check-in status (public)
        self.api_stack.add_public_method("checkin", "GET", self.integration)


class UserManagementApiIntegration:
    """Helper class to integrate user management with the enhanced API"""
    
    def __init__(self, api_stack: EnhancedApiStack, user_management_function: lambda_.Function):
        self.api_stack = api_stack
        self.user_management_function = user_management_function
        
        # Create integration
        self.integration = apigateway.LambdaIntegration(
            self.user_management_function,
            proxy=True
        )
        
        # Add protected methods
        self.setup_protected_endpoints()
    
    def setup_protected_endpoints(self):
        """Setup protected user management endpoints"""
        
        # GET /admin/users - List users (admin+)
        self.api_stack.add_protected_method("admin_users", "GET", self.integration)
        
        # POST /admin/users - Create user (admin+)
        self.api_stack.add_protected_method("admin_users", "POST", self.integration)
        
        # GET /admin/users/{userId} - Get user (admin+)
        self.api_stack.add_protected_method("admin_user", "GET", self.integration)
        
        # PUT /admin/users/{userId}/groups - Update user groups (owner only)
        self.api_stack.add_protected_method("admin_user_groups", "PUT", self.integration)
        
        # PUT /admin/users/{userId}/status - Enable/disable user (admin+)
        self.api_stack.add_protected_method("admin_user_status", "PUT", self.integration)
