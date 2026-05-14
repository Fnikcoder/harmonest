import { Injectable } from '@angular/core';
import { ConfigService } from '../services/config.service';

export interface CheckInApiConfig {
  baseUrl: string;
  endpoints: {
    validate: string;
    submit: string;
    status: string;
  };
  fileUpload: {
    maxSizeBytes: number;
    allowedFormats: string[];
    allowedMimeTypes: string[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class CheckInApiConfigService {
  constructor(private configService: ConfigService) {}

  /**
   * Get check-in API configuration from centralized config
   */
  getCheckInApiConfig(): CheckInApiConfig {
    const config = this.configService.getConfig();
    const baseUrl = config?.technical?.apis?.checkin?.baseUrl || 'https://fallback-api.amazonaws.com/dev/checkin';

    return {
      baseUrl,
      endpoints: {
        validate: '/checkin', // POST with operation: 'validate'
        submit: '/checkin',   // POST with operation: 'submit'
        status: '/checkin'    // GET with reservationCode query param
      },
      fileUpload: {
        maxSizeBytes: 5 * 1024 * 1024, // 5MB
        allowedFormats: ['JPEG', 'PNG', 'GIF', 'WebP'],
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      }
    };
  }
}

// Legacy export for backward compatibility
export function getCheckInApiConfig(): CheckInApiConfig {
  console.warn('getCheckInApiConfig() is deprecated. Use CheckInApiConfigService instead.');
  return {
    baseUrl: 'https://fallback-api.amazonaws.com/dev/checkin',
    endpoints: {
      validate: '/checkin',
      submit: '/checkin',
      status: '/checkin'
    },
    fileUpload: {
      maxSizeBytes: 5 * 1024 * 1024,
      allowedFormats: ['JPEG', 'PNG', 'GIF', 'WebP'],
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    }
  };
}
