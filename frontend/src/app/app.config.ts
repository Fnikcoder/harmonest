import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors, HTTP_INTERCEPTORS } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideClientHydration } from '@angular/platform-browser';

import { routes } from './app.routes';

import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

// Authentication imports
import { AuthInterceptor, BookingAccessInterceptor } from './interceptors/auth.interceptor';
import { AuthService } from './services/auth.service';
import { BookingAccessService } from './services/booking-access.service';
import { AuthGuard, RoleGuard, GuestGuard, BookingAccessGuard } from './guards/auth.guard';

// Factory function for loading translations
export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'top' })
    ),
    provideHttpClient(),
    provideAnimations(),
    provideClientHydration(),

    // Authentication services
    AuthService,
    BookingAccessService,
    AuthGuard,
    RoleGuard,
    GuestGuard,
    BookingAccessGuard,

    // HTTP Interceptors
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: BookingAccessInterceptor,
      multi: true
    },

    // Translation module
    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'en',
        loader: {
          provide: TranslateLoader,
          useFactory: HttpLoaderFactory,
          deps: [HttpClient],
        }
      })
    )
  ]
};
