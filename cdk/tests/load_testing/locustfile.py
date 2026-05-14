"""
Load Testing for Multi-Tenant Hotel Management System

This script uses Locust to simulate multiple clients and users
accessing the system simultaneously to test performance and isolation.
"""

import json
import random
import time
from locust import HttpUser, task, between, events
from locust.env import Environment
from pathlib import Path
import sys

# Add config directory to Python path
project_root = Path(__file__).parent.parent.parent
config_dir = project_root / "config"
sys.path.insert(0, str(config_dir))

from config.config_manager import ConfigManager


class MultiTenantUser(HttpUser):
    """Base user class for multi-tenant testing"""
    
    wait_time = between(1, 3)
    
    def on_start(self):
        """Initialize user with client-specific configuration"""
        # Load available clients
        config_manager = ConfigManager()
        clients = config_manager.list_clients()
        
        if not clients:
            raise Exception("No client configurations found")
        
        # Randomly assign this user to a client
        self.client_name = random.choice(clients)
        self.client_config = config_manager.load_client_config(self.client_name)
        
        # Set up test data for this client
        self.reservation_codes = [
            f"{self.client_name.upper()}{random.randint(100, 999)}"
            for _ in range(10)
        ]
        
        self.guest_names = [
            "John", "Jane", "Mike", "Sarah", "David", "Lisa", "Tom", "Anna"
        ]
        
        print(f"User initialized for client: {self.client_name}")
    
    def get_headers(self):
        """Get headers with client-specific information"""
        return {
            "Content-Type": "application/json",
            "User-Agent": f"LoadTest-{self.client_name}",
            "X-Client-Name": self.client_name
        }


class CheckinUser(MultiTenantUser):
    """User that performs check-in operations"""
    
    @task(3)
    def validate_reservation(self):
        """Validate a reservation"""
        reservation_code = random.choice(self.reservation_codes)
        guest_name = random.choice(self.guest_names)
        
        payload = {
            "operation": "validate",
            "reservationCode": reservation_code,
            "guestFirstName": guest_name
        }
        
        with self.client.post(
            "/checkin",
            json=payload,
            headers=self.get_headers(),
            catch_response=True
        ) as response:
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    response.success()
                else:
                    response.failure(f"Validation failed: {data.get('message', 'Unknown error')}")
            elif response.status_code == 404:
                # Expected for random reservation codes
                response.success()
            else:
                response.failure(f"Unexpected status code: {response.status_code}")
    
    @task(2)
    def submit_checkin(self):
        """Submit check-in information"""
        reservation_id = f"TEST_{self.client_name}_{random.randint(1000, 9999)}"
        guest_name = random.choice(self.guest_names)
        
        payload = {
            "operation": "submit",
            "reservationId": reservation_id,
            "guestName": guest_name,
            "guestLastName": "TestUser",
            "guestEmail": f"{guest_name.lower()}@{self.client_config['client']['domains']['primary']}",
            "guestPhone": f"+1{random.randint(1000000000, 9999999999)}",
            "estimatedArrival": f"{random.randint(10, 20)}:00",
            "specialRequests": f"Load test request from {self.client_name}"
        }
        
        with self.client.post(
            "/checkin",
            json=payload,
            headers=self.get_headers(),
            catch_response=True
        ) as response:
            if response.status_code in [200, 400]:  # 400 might be expected for test data
                response.success()
            else:
                response.failure(f"Submit failed: {response.status_code}")
    
    @task(1)
    def get_checkin_status(self):
        """Get check-in status"""
        reservation_id = f"TEST_{self.client_name}_{random.randint(1000, 9999)}"
        
        with self.client.get(
            f"/checkin?reservationId={reservation_id}",
            headers=self.get_headers(),
            catch_response=True
        ) as response:
            if response.status_code in [200, 404]:  # 404 expected for non-existent reservations
                response.success()
            else:
                response.failure(f"Get status failed: {response.status_code}")


class PublicListingsUser(MultiTenantUser):
    """User that accesses public listings"""
    
    @task(5)
    def get_public_listings(self):
        """Get public listings"""
        with self.client.get(
            "/public/listings",
            headers=self.get_headers(),
            catch_response=True
        ) as response:
            if response.status_code == 200:
                data = response.json()
                # Verify client-specific data
                if data.get("client") == self.client_name:
                    response.success()
                else:
                    response.failure(f"Wrong client data: expected {self.client_name}, got {data.get('client')}")
            else:
                response.failure(f"Listings request failed: {response.status_code}")
    
    @task(2)
    def search_listings(self):
        """Search listings"""
        search_params = {
            "maxGuests": random.randint(1, 6),
            "checkIn": "2024-02-01",
            "checkOut": "2024-02-03"
        }
        
        with self.client.get(
            "/public/listings/search",
            params=search_params,
            headers=self.get_headers(),
            catch_response=True
        ) as response:
            if response.status_code in [200, 404]:  # 404 if no results
                response.success()
            else:
                response.failure(f"Search failed: {response.status_code}")
    
    @task(1)
    def get_listing_details(self):
        """Get specific listing details"""
        listing_id = f"LISTING_{random.randint(1, 100)}"
        
        with self.client.get(
            f"/public/listings/{listing_id}",
            headers=self.get_headers(),
            catch_response=True
        ) as response:
            if response.status_code in [200, 404]:  # 404 expected for non-existent listings
                response.success()
            else:
                response.failure(f"Listing details failed: {response.status_code}")


class EmailVerificationUser(MultiTenantUser):
    """User that performs email verification operations"""
    
    @task(2)
    def send_verification_email(self):
        """Send verification email"""
        payload = {
            "operation": "send",
            "email": f"test@{self.client_config['client']['domains']['primary']}",
            "type": "checkin"
        }
        
        with self.client.post(
            "/email/verification",
            json=payload,
            headers=self.get_headers(),
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Email send failed: {response.status_code}")
    
    @task(1)
    def verify_email_code(self):
        """Verify email code"""
        payload = {
            "operation": "verify",
            "email": f"test@{self.client_config['client']['domains']['primary']}",
            "code": f"{random.randint(100000, 999999)}"
        }
        
        with self.client.post(
            "/email/verification",
            json=payload,
            headers=self.get_headers(),
            catch_response=True
        ) as response:
            if response.status_code in [200, 400]:  # 400 expected for invalid codes
                response.success()
            else:
                response.failure(f"Email verify failed: {response.status_code}")


# Custom events for multi-tenant metrics
@events.init.add_listener
def on_locust_init(environment, **kwargs):
    """Initialize custom metrics tracking"""
    environment.client_metrics = {}


@events.request.add_listener
def on_request(request_type, name, response_time, response_length, response, context, exception, **kwargs):
    """Track client-specific metrics"""
    if hasattr(context, 'locust') and hasattr(context.locust, 'client_name'):
        client_name = context.locust.client_name
        
        # Track metrics per client
        if not hasattr(context.locust.environment, 'client_metrics'):
            context.locust.environment.client_metrics = {}
        
        if client_name not in context.locust.environment.client_metrics:
            context.locust.environment.client_metrics[client_name] = {
                'requests': 0,
                'failures': 0,
                'total_response_time': 0,
                'min_response_time': float('inf'),
                'max_response_time': 0
            }
        
        metrics = context.locust.environment.client_metrics[client_name]
        metrics['requests'] += 1
        metrics['total_response_time'] += response_time
        metrics['min_response_time'] = min(metrics['min_response_time'], response_time)
        metrics['max_response_time'] = max(metrics['max_response_time'], response_time)
        
        if exception:
            metrics['failures'] += 1


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Print client-specific metrics at test end"""
    if hasattr(environment, 'client_metrics'):
        print("\n" + "="*50)
        print("CLIENT-SPECIFIC METRICS")
        print("="*50)
        
        for client_name, metrics in environment.client_metrics.items():
            if metrics['requests'] > 0:
                avg_response_time = metrics['total_response_time'] / metrics['requests']
                failure_rate = (metrics['failures'] / metrics['requests']) * 100
                
                print(f"\nClient: {client_name}")
                print(f"  Requests: {metrics['requests']}")
                print(f"  Failures: {metrics['failures']} ({failure_rate:.1f}%)")
                print(f"  Avg Response Time: {avg_response_time:.1f}ms")
                print(f"  Min Response Time: {metrics['min_response_time']:.1f}ms")
                print(f"  Max Response Time: {metrics['max_response_time']:.1f}ms")


# Load test scenarios
class LightLoadScenario(CheckinUser):
    """Light load scenario - normal usage"""
    weight = 3


class MediumLoadScenario(PublicListingsUser):
    """Medium load scenario - browsing listings"""
    weight = 2


class HeavyLoadScenario(EmailVerificationUser):
    """Heavy load scenario - email operations"""
    weight = 1


if __name__ == "__main__":
    # Example of running load test programmatically
    from locust.env import Environment
    from locust.stats import stats_printer, stats_history
    from locust.log import setup_logging
    import gevent
    
    setup_logging("INFO", None)
    
    # Setup Environment and Runner
    env = Environment(user_classes=[LightLoadScenario, MediumLoadScenario, HeavyLoadScenario])
    env.create_local_runner()
    
    # Start a WebUI instance
    env.create_web_ui("127.0.0.1", 8089)
    
    # Start the test
    env.runner.start(1, spawn_rate=1)
    
    # Run for 60 seconds
    gevent.spawn_later(60, lambda: env.runner.quit())
    
    # Start Locust
    env.runner.greenlet.join()
