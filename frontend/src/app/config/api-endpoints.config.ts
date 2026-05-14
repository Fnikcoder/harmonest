import { Injectable } from '@angular/core';
import { ConfigService } from '../services/config.service';

// API Endpoints Configuration - now using centralized config

export interface ApiEndpoint {
  BASE_URL: string;
  OPERATIONS?: {
    [key: string]: string;
  };
}

export interface ApiEndpoints {
  CHECKIN: ApiEndpoint;
  EMAIL_VERIFICATION: ApiEndpoint;
  BOOKING: ApiEndpoint;
  PAYMENT: ApiEndpoint;
}

@Injectable({
  providedIn: 'root'
})
export class ApiEndpointsService {
  constructor(private configService: ConfigService) {}

  /**
   * Get all API endpoints from centralized config
   */
  getApiEndpoints(): ApiEndpoints | null {
    const config = this.configService.getConfig();
    if (!config?.technical?.apis) {
      console.warn('API configuration not found in master config');
      return null;
    }

    const apis = config.technical.apis;

    return {
      CHECKIN: {
        BASE_URL: apis.checkin?.baseUrl || '',
        OPERATIONS: {
          VALIDATE: 'validate',
          SUBMIT: 'submit',
          STATUS: 'status'
        }
      },
      EMAIL_VERIFICATION: {
        BASE_URL: apis.emailVerification?.baseUrl || '',
        OPERATIONS: {
          SEND_CODE: 'send-verification-email',
          VERIFY_CODE: 'verify-email-code'
        }
      },
      BOOKING: {
        BASE_URL: apis.booking?.baseUrl || ''
      },
      PAYMENT: {
        BASE_URL: apis.payment?.baseUrl || ''
      }
    };
  }

  /**
   * Get specific API endpoint
   */
  getApiEndpoint(service: keyof ApiEndpoints): ApiEndpoint | null {
    const endpoints = this.getApiEndpoints();
    return endpoints ? endpoints[service] : null;
  }

  /**
   * Get API URL for a specific service
   */
  getApiUrl(service: keyof ApiEndpoints): string | null {
    const endpoint = this.getApiEndpoint(service);
    return endpoint?.BASE_URL || null;
  }
}

// Legacy exports for backward compatibility
// Use ApiEndpointsService instead for new code
export function getApiEndpoint(service: string, environment: 'dev' | 'prod' = 'prod'): any {
  console.warn('getApiEndpoint() is deprecated. Use ApiEndpointsService instead.');
  return null;
}

// Legacy constant for backward compatibility
export const API_ENDPOINTS = {
  CHECKIN: {
    BASE_URL: '',
    OPERATIONS: {
      VALIDATE: 'validate',
      SUBMIT: 'submit',
      STATUS: 'status'
    }
  },
  EMAIL_VERIFICATION: {
    BASE_URL: '',
    OPERATIONS: {
      SEND_CODE: 'send-verification-email',
      VERIFY_CODE: 'verify-email-code'
    }
  },
  BOOKING: {
    BASE_URL: ''
  },
  PAYMENT: {
    BASE_URL: ''
  }
};
