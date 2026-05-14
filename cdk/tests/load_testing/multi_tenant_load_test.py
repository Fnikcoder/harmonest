#!/usr/bin/env python3
"""
Multi-Tenant Load Testing Framework

This framework tests the performance and isolation of the multi-tenant system
by simulating multiple clients with different load patterns simultaneously.
"""

import asyncio
import aiohttp
import json
import time
import random
import statistics
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from pathlib import Path
import sys
import argparse

# Add config directory to Python path
project_root = Path(__file__).parent.parent.parent
config_dir = project_root / "config"
sys.path.insert(0, str(config_dir))

from config.config_manager import ConfigManager


@dataclass
class LoadTestResult:
    """Results from a load test"""
    client_name: str
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    response_times: List[float] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    start_time: float = 0
    end_time: float = 0
    
    @property
    def duration(self) -> float:
        return self.end_time - self.start_time
    
    @property
    def success_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return (self.successful_requests / self.total_requests) * 100
    
    @property
    def requests_per_second(self) -> float:
        if self.duration == 0:
            return 0.0
        return self.total_requests / self.duration
    
    @property
    def avg_response_time(self) -> float:
        if not self.response_times:
            return 0.0
        return statistics.mean(self.response_times)
    
    @property
    def p95_response_time(self) -> float:
        if not self.response_times:
            return 0.0
        return statistics.quantiles(self.response_times, n=20)[18]  # 95th percentile
    
    @property
    def p99_response_time(self) -> float:
        if not self.response_times:
            return 0.0
        return statistics.quantiles(self.response_times, n=100)[98]  # 99th percentile


@dataclass
class LoadTestConfig:
    """Configuration for load testing"""
    client_name: str
    api_base_url: str
    concurrent_users: int = 10
    requests_per_user: int = 50
    test_duration: int = 300  # seconds
    ramp_up_time: int = 30   # seconds
    think_time_min: float = 0.5  # seconds
    think_time_max: float = 2.0  # seconds


class MultiTenantLoadTester:
    """Load tester for multi-tenant system"""
    
    def __init__(self):
        self.config_manager = ConfigManager()
        self.results: Dict[str, LoadTestResult] = {}
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        """Async context manager entry"""
        connector = aiohttp.TCPConnector(limit=100, limit_per_host=50)
        timeout = aiohttp.ClientTimeout(total=30)
        self.session = aiohttp.ClientSession(connector=connector, timeout=timeout)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
    
    def discover_test_clients(self) -> List[str]:
        """Discover available clients for testing"""
        return self.config_manager.list_clients()
    
    def get_client_api_url(self, client_name: str, environment: str = "prod") -> Optional[str]:
        """Get API URL for a client"""
        try:
            import boto3
            config = self.config_manager.load_client_config(client_name)
            aws_profile = config["client"]["aws"]["profile"]
            
            session = boto3.Session(profile_name=aws_profile)
            ssm_client = session.client('ssm')
            
            param_name = f"/{client_name}/{environment}/api/url"
            response = ssm_client.get_parameter(Name=param_name)
            return response['Parameter']['Value']
            
        except Exception as e:
            print(f"Warning: Could not get API URL for {client_name}: {e}")
            return None
    
    async def make_request(self, method: str, url: str, headers: Dict[str, str], 
                          data: Optional[Dict] = None, result: LoadTestResult = None) -> bool:
        """Make a single HTTP request and record metrics"""
        start_time = time.time()
        
        try:
            if method.upper() == "GET":
                async with self.session.get(url, headers=headers) as response:
                    await response.text()  # Consume response
                    success = response.status < 400
            else:
                async with self.session.post(url, headers=headers, json=data) as response:
                    await response.text()  # Consume response
                    success = response.status < 400
            
            response_time = (time.time() - start_time) * 1000  # Convert to ms
            
            if result:
                result.total_requests += 1
                result.response_times.append(response_time)
                
                if success:
                    result.successful_requests += 1
                else:
                    result.failed_requests += 1
                    result.errors.append(f"HTTP {response.status}")
            
            return success
            
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            
            if result:
                result.total_requests += 1
                result.failed_requests += 1
                result.response_times.append(response_time)
                result.errors.append(str(e))
            
            return False
    
    async def simulate_checkin_user(self, config: LoadTestConfig, user_id: int, result: LoadTestResult):
        """Simulate a user performing check-in operations"""
        client_config = self.config_manager.load_client_config(config.client_name)
        
        headers = {
            "Content-Type": "application/json",
            "User-Agent": f"LoadTest-{config.client_name}-User{user_id}",
            "X-Client-Name": config.client_name
        }
        
        # Ramp up - stagger user start times
        await asyncio.sleep(random.uniform(0, config.ramp_up_time))
        
        start_time = time.time()
        
        while (time.time() - start_time) < config.test_duration:
            # Validate reservation (most common operation)
            reservation_code = f"{config.client_name.upper()}{random.randint(100, 999)}"
            guest_name = random.choice(["John", "Jane", "Mike", "Sarah", "David", "Lisa"])
            
            validate_data = {
                "operation": "validate",
                "reservationCode": reservation_code,
                "guestFirstName": guest_name
            }
            
            await self.make_request(
                "POST", 
                f"{config.api_base_url}/checkin",
                headers,
                validate_data,
                result
            )
            
            # Think time
            await asyncio.sleep(random.uniform(config.think_time_min, config.think_time_max))
            
            # Occasionally submit check-in
            if random.random() < 0.3:  # 30% chance
                submit_data = {
                    "operation": "submit",
                    "reservationId": f"TEST_{config.client_name}_{random.randint(1000, 9999)}",
                    "guestName": guest_name,
                    "guestLastName": "TestUser",
                    "guestEmail": f"{guest_name.lower()}@{client_config['client']['domains']['primary']}",
                    "guestPhone": f"+1{random.randint(1000000000, 9999999999)}",
                    "estimatedArrival": f"{random.randint(10, 20)}:00"
                }
                
                await self.make_request(
                    "POST",
                    f"{config.api_base_url}/checkin",
                    headers,
                    submit_data,
                    result
                )
                
                await asyncio.sleep(random.uniform(config.think_time_min, config.think_time_max))
    
    async def simulate_listings_user(self, config: LoadTestConfig, user_id: int, result: LoadTestResult):
        """Simulate a user browsing listings"""
        headers = {
            "User-Agent": f"LoadTest-{config.client_name}-User{user_id}",
            "X-Client-Name": config.client_name
        }
        
        # Ramp up
        await asyncio.sleep(random.uniform(0, config.ramp_up_time))
        
        start_time = time.time()
        
        while (time.time() - start_time) < config.test_duration:
            # Get public listings (most common)
            await self.make_request(
                "GET",
                f"{config.api_base_url}/public/listings",
                headers,
                None,
                result
            )
            
            await asyncio.sleep(random.uniform(config.think_time_min, config.think_time_max))
            
            # Search listings
            if random.random() < 0.4:  # 40% chance
                search_params = f"?maxGuests={random.randint(1, 6)}&checkIn=2024-02-01&checkOut=2024-02-03"
                await self.make_request(
                    "GET",
                    f"{config.api_base_url}/public/listings/search{search_params}",
                    headers,
                    None,
                    result
                )
                
                await asyncio.sleep(random.uniform(config.think_time_min, config.think_time_max))
            
            # Get specific listing
            if random.random() < 0.2:  # 20% chance
                listing_id = f"LISTING_{random.randint(1, 100)}"
                await self.make_request(
                    "GET",
                    f"{config.api_base_url}/public/listings/{listing_id}",
                    headers,
                    None,
                    result
                )
                
                await asyncio.sleep(random.uniform(config.think_time_min, config.think_time_max))
    
    async def run_client_load_test(self, config: LoadTestConfig) -> LoadTestResult:
        """Run load test for a single client"""
        result = LoadTestResult(client_name=config.client_name)
        result.start_time = time.time()
        
        print(f"Starting load test for client: {config.client_name}")
        print(f"  Users: {config.concurrent_users}")
        print(f"  Duration: {config.test_duration}s")
        print(f"  API URL: {config.api_base_url}")
        
        # Create tasks for different user types
        tasks = []
        
        # 70% check-in users, 30% listings users
        checkin_users = int(config.concurrent_users * 0.7)
        listings_users = config.concurrent_users - checkin_users
        
        # Create check-in user tasks
        for i in range(checkin_users):
            task = asyncio.create_task(
                self.simulate_checkin_user(config, i, result)
            )
            tasks.append(task)
        
        # Create listings user tasks
        for i in range(listings_users):
            task = asyncio.create_task(
                self.simulate_listings_user(config, checkin_users + i, result)
            )
            tasks.append(task)
        
        # Wait for all tasks to complete
        await asyncio.gather(*tasks, return_exceptions=True)
        
        result.end_time = time.time()
        
        print(f"Completed load test for client: {config.client_name}")
        print(f"  Total requests: {result.total_requests}")
        print(f"  Success rate: {result.success_rate:.1f}%")
        print(f"  Avg response time: {result.avg_response_time:.1f}ms")
        
        return result
    
    async def run_multi_client_load_test(self, client_configs: List[LoadTestConfig]) -> Dict[str, LoadTestResult]:
        """Run load tests for multiple clients simultaneously"""
        print(f"Starting multi-client load test with {len(client_configs)} clients")
        
        # Run all client tests concurrently
        tasks = []
        for config in client_configs:
            task = asyncio.create_task(self.run_client_load_test(config))
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Collect results
        client_results = {}
        for i, result in enumerate(results):
            if isinstance(result, LoadTestResult):
                client_results[result.client_name] = result
            else:
                print(f"Error in client {client_configs[i].client_name}: {result}")
        
        return client_results
    
    def analyze_results(self, results: Dict[str, LoadTestResult]) -> Dict[str, Any]:
        """Analyze load test results for performance and isolation"""
        analysis = {
            "summary": {
                "total_clients": len(results),
                "total_requests": sum(r.total_requests for r in results.values()),
                "overall_success_rate": 0,
                "avg_response_time": 0,
                "requests_per_second": 0
            },
            "client_performance": {},
            "isolation_analysis": {},
            "performance_issues": []
        }
        
        if not results:
            return analysis
        
        # Calculate overall metrics
        total_requests = sum(r.total_requests for r in results.values())
        total_successful = sum(r.successful_requests for r in results.values())
        all_response_times = []
        
        for result in results.values():
            all_response_times.extend(result.response_times)
        
        if total_requests > 0:
            analysis["summary"]["overall_success_rate"] = (total_successful / total_requests) * 100
        
        if all_response_times:
            analysis["summary"]["avg_response_time"] = statistics.mean(all_response_times)
        
        total_duration = max(r.duration for r in results.values()) if results else 0
        if total_duration > 0:
            analysis["summary"]["requests_per_second"] = total_requests / total_duration
        
        # Analyze each client
        for client_name, result in results.items():
            client_analysis = {
                "requests": result.total_requests,
                "success_rate": result.success_rate,
                "avg_response_time": result.avg_response_time,
                "p95_response_time": result.p95_response_time,
                "p99_response_time": result.p99_response_time,
                "requests_per_second": result.requests_per_second,
                "errors": len(result.errors),
                "unique_errors": len(set(result.errors))
            }
            
            analysis["client_performance"][client_name] = client_analysis
            
            # Check for performance issues
            if result.success_rate < 95:
                analysis["performance_issues"].append(
                    f"Client {client_name}: Low success rate ({result.success_rate:.1f}%)"
                )
            
            if result.avg_response_time > 2000:
                analysis["performance_issues"].append(
                    f"Client {client_name}: High response time ({result.avg_response_time:.1f}ms)"
                )
        
        # Isolation analysis
        if len(results) > 1:
            response_times = [r.avg_response_time for r in results.values()]
            success_rates = [r.success_rate for r in results.values()]
            
            # Check for performance variance (isolation)
            rt_variance = statistics.variance(response_times) if len(response_times) > 1 else 0
            sr_variance = statistics.variance(success_rates) if len(success_rates) > 1 else 0
            
            analysis["isolation_analysis"] = {
                "response_time_variance": rt_variance,
                "success_rate_variance": sr_variance,
                "performance_isolation_score": max(0, 100 - (rt_variance / 100))  # Simple score
            }
            
            if rt_variance > 500:  # High variance in response times
                analysis["performance_issues"].append(
                    "High variance in response times between clients - possible isolation issues"
                )
        
        return analysis
    
    def generate_report(self, results: Dict[str, LoadTestResult], analysis: Dict[str, Any]) -> str:
        """Generate a comprehensive load test report"""
        report_lines = []
        
        report_lines.append("# Multi-Tenant Load Test Report")
        report_lines.append("")
        report_lines.append(f"**Test Date:** {time.strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("")
        
        # Summary
        summary = analysis["summary"]
        report_lines.append("## Summary")
        report_lines.append(f"- **Total Clients Tested:** {summary['total_clients']}")
        report_lines.append(f"- **Total Requests:** {summary['total_requests']:,}")
        report_lines.append(f"- **Overall Success Rate:** {summary['overall_success_rate']:.1f}%")
        report_lines.append(f"- **Average Response Time:** {summary['avg_response_time']:.1f}ms")
        report_lines.append(f"- **Requests per Second:** {summary['requests_per_second']:.1f}")
        report_lines.append("")
        
        # Client Performance
        report_lines.append("## Client Performance")
        report_lines.append("")
        report_lines.append("| Client | Requests | Success Rate | Avg RT (ms) | P95 RT (ms) | P99 RT (ms) | RPS |")
        report_lines.append("|--------|----------|--------------|-------------|-------------|-------------|-----|")
        
        for client_name, perf in analysis["client_performance"].items():
            report_lines.append(
                f"| {client_name} | {perf['requests']:,} | {perf['success_rate']:.1f}% | "
                f"{perf['avg_response_time']:.1f} | {perf['p95_response_time']:.1f} | "
                f"{perf['p99_response_time']:.1f} | {perf['requests_per_second']:.1f} |"
            )
        
        report_lines.append("")
        
        # Isolation Analysis
        if "isolation_analysis" in analysis:
            iso = analysis["isolation_analysis"]
            report_lines.append("## Tenant Isolation Analysis")
            report_lines.append(f"- **Response Time Variance:** {iso['response_time_variance']:.1f}")
            report_lines.append(f"- **Success Rate Variance:** {iso['success_rate_variance']:.1f}")
            report_lines.append(f"- **Performance Isolation Score:** {iso['performance_isolation_score']:.1f}/100")
            report_lines.append("")
        
        # Performance Issues
        if analysis["performance_issues"]:
            report_lines.append("## Performance Issues")
            for issue in analysis["performance_issues"]:
                report_lines.append(f"- ⚠️ {issue}")
            report_lines.append("")
        else:
            report_lines.append("## Performance Issues")
            report_lines.append("- ✅ No significant performance issues detected")
            report_lines.append("")
        
        # Detailed Results
        report_lines.append("## Detailed Results")
        report_lines.append("")
        
        for client_name, result in results.items():
            report_lines.append(f"### {client_name}")
            report_lines.append(f"- **Duration:** {result.duration:.1f}s")
            report_lines.append(f"- **Total Requests:** {result.total_requests:,}")
            report_lines.append(f"- **Successful:** {result.successful_requests:,}")
            report_lines.append(f"- **Failed:** {result.failed_requests:,}")
            report_lines.append(f"- **Success Rate:** {result.success_rate:.1f}%")
            report_lines.append(f"- **Average Response Time:** {result.avg_response_time:.1f}ms")
            report_lines.append(f"- **95th Percentile:** {result.p95_response_time:.1f}ms")
            report_lines.append(f"- **99th Percentile:** {result.p99_response_time:.1f}ms")
            report_lines.append(f"- **Requests per Second:** {result.requests_per_second:.1f}")
            
            if result.errors:
                unique_errors = list(set(result.errors))[:5]  # Show top 5 unique errors
                report_lines.append(f"- **Top Errors:** {', '.join(unique_errors)}")
            
            report_lines.append("")
        
        return "\n".join(report_lines)


async def main():
    """Main function for running multi-tenant load tests"""
    parser = argparse.ArgumentParser(description="Multi-Tenant Load Testing Framework")
    parser.add_argument("--clients", nargs="+", help="Specific clients to test")
    parser.add_argument("--users", type=int, default=10, help="Concurrent users per client")
    parser.add_argument("--duration", type=int, default=300, help="Test duration in seconds")
    parser.add_argument("--environment", default="prod", help="Environment to test")
    parser.add_argument("--output", default="load_test_report.md", help="Output report file")
    
    args = parser.parse_args()
    
    async with MultiTenantLoadTester() as tester:
        # Discover clients
        if args.clients:
            clients_to_test = args.clients
        else:
            clients_to_test = tester.discover_test_clients()
        
        if not clients_to_test:
            print("No clients found for testing")
            return
        
        # Create test configurations
        configs = []
        for client_name in clients_to_test:
            api_url = tester.get_client_api_url(client_name, args.environment)
            if api_url:
                config = LoadTestConfig(
                    client_name=client_name,
                    api_base_url=api_url,
                    concurrent_users=args.users,
                    test_duration=args.duration
                )
                configs.append(config)
            else:
                print(f"Warning: Skipping {client_name} - API URL not found")
        
        if not configs:
            print("No valid client configurations found")
            return
        
        # Run load tests
        results = await tester.run_multi_client_load_test(configs)
        
        # Analyze results
        analysis = tester.analyze_results(results)
        
        # Generate report
        report = tester.generate_report(results, analysis)
        
        # Save report
        with open(args.output, 'w') as f:
            f.write(report)
        
        print(f"\nLoad test completed!")
        print(f"Report saved to: {args.output}")
        
        # Print summary
        print(f"\nSummary:")
        print(f"  Clients tested: {len(results)}")
        print(f"  Total requests: {analysis['summary']['total_requests']:,}")
        print(f"  Overall success rate: {analysis['summary']['overall_success_rate']:.1f}%")
        print(f"  Average response time: {analysis['summary']['avg_response_time']:.1f}ms")
        
        if analysis["performance_issues"]:
            print(f"\nPerformance Issues:")
            for issue in analysis["performance_issues"]:
                print(f"  - {issue}")


if __name__ == "__main__":
    asyncio.run(main())
