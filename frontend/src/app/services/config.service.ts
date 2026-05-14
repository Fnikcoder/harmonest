import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';

export interface MasterConfig {
  client: {
    id: string;
    name: string;
    domain: string;
    subdomains: string[];
    deploymentRegion: string;
  };
  environment: {
    type: 'dev' | 'prod';
    resourcePrefix: string;
    debugMode: boolean;
    analyticsEnabled: boolean;
  };
  branding: {
    logo: any;
    colors: {
      light: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        surface: string;
        textPrimary: string;
        textSecondary: string;
        border: string;
      };
      dark?: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        surface: string;
        textPrimary: string;
        textSecondary: string;
        border: string;
      };
    };
    typography: {
      primaryFont: string;
      secondaryFont: string;
    };
    components: any;
    theme: {
      selectedTheme: string;
      darkModeEnabled: boolean;
    };
  };
  business: {
    name: string;
    description: string;
    contact: {
      email: string;
      phone: string;
      address: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
      };
    };
    operatingHours: {
      timezone: string;
      checkInTime: string;
      checkOutTime: string;
    };
  };
  technical: {
    aws: {
      region: string;
      cognito: {
        userPoolId: string;
        userPoolWebClientId: string;
        identityPoolId: string;
        domain?: string;
        oauth?: {
          domain: string;
          scope: string[];
          redirectSignIn: string;
          redirectSignOut: string;
          responseType: string;
        };
      };
      dynamodb: {
        tableName: string;
        region: string;
        endpoint?: string;
      };
      s3: {
        bucketName: string;
        region: string;
      };
    };
    apis: {
      checkin: {
        baseUrl: string;
      };
      emailVerification: {
        baseUrl: string;
      };
      booking?: {
        baseUrl: string;
      };
      payment?: {
        baseUrl: string;
      };
      userManagement?: {
        baseUrl: string;
      };
    };
    payments: {
      stripe: {
        publishableKey: string;
        enabled: boolean;
      };
      paypal: {
        clientId: string;
        enabled: boolean;
      };
      currency: string;
      taxRate: number;
    };
    socialProviders?: {
      google?: {
        enabled: boolean;
        clientId?: string;
      };
      facebook?: {
        enabled: boolean;
        appId?: string;
      };
      apple?: {
        enabled: boolean;
        clientId?: string;
      };
    };
  };
  features: {
    authentication: {
      emailVerification: {
        signup: boolean;
        booking: boolean;
      };
      socialLogin: {
        enabled: boolean;
        providers: string[];
      };
      mfa?: {
        enabled: boolean;
        requiredForRoles: string[];
        methods: ('SMS' | 'TOTP' | 'EMAIL')[];
      };
      passwordPolicy?: {
        minLength: number;
        requireUppercase: boolean;
        requireLowercase: boolean;
        requireNumbers: boolean;
        requireSymbols: boolean;
        preventReuse: number;
      };
      session?: {
        timeout: number;
        extendOnActivity: boolean;
        rememberMeDuration: number;
      };
    };
    booking: {
      guestBooking: boolean;
      instantBooking: boolean;
      minimumStayNights: number;
      maximumStayNights: number;
    };
    checkin: {
      onlineCheckin: boolean;
      idVerification: boolean;
      documentTypes: string[];
      qrCodeAccess: boolean;
    };
  };
  content: {
    homepage: {
      hero: {
        title: string;
        subtitle: string;
        backgroundImage: string;
        ctaText: string;
        ctaLink: string;
      };
    };
    localization: {
      defaultLanguage: string;
      supportedLanguages: string[];
      currency: string;
      currencySymbol: string;
    };
  };
  deployment: {
    version: string;
    buildDate: string;
    deployedBy: string;
    healthChecks: {
      enabled: boolean;
      endpoints: string[];
    };
    monitoring: {
      enabled: boolean;
      logLevel: string;
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private configSubject = new BehaviorSubject<MasterConfig | null>(null);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  public config$ = this.configSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadConfig();
  }

  /**
   * Load configuration from master-config.json
   */
  private loadConfig(): void {
    this.loadingSubject.next(true);

    this.http.get<MasterConfig>('/assets/config/master-config.json').pipe(
      tap(config => {
        this.configSubject.next(config);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        console.error('❌ [ConfigService] Failed to load configuration:', error);
        this.loadingSubject.next(false);
        // Return default config on error
        return of(this.getDefaultConfig());
      })
    ).subscribe(config => {
      if (config) {
        this.configSubject.next(config);
      }
    });
  }

  /**
   * Get current configuration synchronously
   */
  getConfig(): MasterConfig | null {
    return this.configSubject.value;
  }

  /**
   * Get configuration as observable
   */
  getConfigObservable(): Observable<MasterConfig | null> {
    return this.config$;
  }

  /**
   * Get specific configuration section
   */
  getSection<K extends keyof MasterConfig>(section: K): MasterConfig[K] | null {
    const config = this.getConfig();
    return config ? config[section] : null;
  }

  /**
   * Get AWS configuration
   */
  getAwsConfig() {
    return this.getSection('technical')?.aws || null;
  }

  /**
   * Get API endpoints configuration
   */
  getApiConfig() {
    return this.getSection('technical')?.apis || null;
  }

  /**
   * Get payment configuration
   */
  getPaymentConfig() {
    return this.getSection('technical')?.payments || null;
  }

  /**
   * Get authentication configuration
   */
  getAuthConfig() {
    return this.getSection('features')?.authentication || null;
  }

  /**
   * Get environment-specific values
   */
  isProduction(): boolean {
    return this.getSection('environment')?.type === 'prod';
  }

  isDevelopment(): boolean {
    return this.getSection('environment')?.type === 'dev';
  }

  /**
   * Get environment-specific API URL
   */
  getApiUrl(service: string): string | null {
    const apis = this.getApiConfig();
    if (!apis) return null;

    const serviceConfig = apis[service as keyof typeof apis];
    if (!serviceConfig || typeof serviceConfig !== 'object' || !('baseUrl' in serviceConfig)) {
      return null;
    }

    return serviceConfig.baseUrl as string;
  }

  /**
   * Reload configuration
   */
  reloadConfig(): Observable<MasterConfig | null> {
    this.loadConfig();
    return this.config$;
  }

  /**
   * Default configuration fallback
   */
  private getDefaultConfig(): MasterConfig {
    return {
      client: {
        id: 'default-client',
        name: 'Default Client',
        domain: 'localhost',
        subdomains: [],
        deploymentRegion: 'eu-central-1'
      },
      environment: {
        type: 'dev',
        resourcePrefix: 'default-dev',
        debugMode: true,
        analyticsEnabled: false
      },
      branding: {
        logo: {},
        colors: {
          light: {
            primary: '#3b82f6',
            secondary: '#64748b',
            accent: '#10b981',
            background: '#ffffff',
            surface: '#f8fafc',
            textPrimary: '#0f172a',
            textSecondary: '#64748b',
            border: '#e2e8f0'
          }
        },
        typography: {
          primaryFont: '"Inter", sans-serif',
          secondaryFont: '"Inter", sans-serif'
        },
        components: {},
        theme: {
          selectedTheme: 'default',
          darkModeEnabled: false
        }
      },
      business: {
        name: 'Default Business',
        description: '',
        contact: {
          email: 'info@example.com',
          phone: '',
          address: {
            street: '',
            city: '',
            state: '',
            zipCode: '',
            country: ''
          }
        },
        operatingHours: {
          timezone: 'UTC',
          checkInTime: '15:00',
          checkOutTime: '11:00'
        }
      },
      technical: {
        aws: {
          region: 'eu-central-1',
          cognito: {
            userPoolId: '',
            userPoolWebClientId: '',
            identityPoolId: ''
          },
          dynamodb: {
            tableName: '',
            region: 'eu-central-1'
          },
          s3: {
            bucketName: '',
            region: 'eu-central-1'
          }
        },
        apis: {
          checkin: {
            baseUrl: ''
          },
          emailVerification: {
            baseUrl: ''
          },
          userManagement: {
            baseUrl: ''
          }
        },
        payments: {
          stripe: {
            publishableKey: '',
            enabled: false
          },
          paypal: {
            clientId: '',
            enabled: false
          },
          currency: 'EUR',
          taxRate: 0.19
        }
      },
      features: {
        authentication: {
          emailVerification: {
            signup: true,
            booking: true
          },
          socialLogin: {
            enabled: false,
            providers: []
          }
        },
        booking: {
          guestBooking: true,
          instantBooking: false,
          minimumStayNights: 1,
          maximumStayNights: 30
        },
        checkin: {
          onlineCheckin: true,
          idVerification: true,
          documentTypes: ['passport', 'national_id', 'drivers_license'],
          qrCodeAccess: true
        }
      },
      content: {
        homepage: {
          hero: {
            title: 'Welcome',
            subtitle: 'Default subtitle',
            backgroundImage: '',
            ctaText: 'Get Started',
            ctaLink: '/'
          }
        },
        localization: {
          defaultLanguage: 'en',
          supportedLanguages: ['en'],
          currency: 'EUR',
          currencySymbol: '€'
        }
      },
      deployment: {
        version: '1.0.0',
        buildDate: new Date().toISOString(),
        deployedBy: 'system',
        healthChecks: {
          enabled: false,
          endpoints: []
        },
        monitoring: {
          enabled: false,
          logLevel: 'info'
        }
      }
    };
  }
}
