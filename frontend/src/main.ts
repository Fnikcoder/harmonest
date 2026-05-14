/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// AG Grid module registration
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
ModuleRegistry.registerModules([AllCommunityModule]);

bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [
    ...appConfig.providers
  ]
}).catch((err) => {
  console.error(err);
  // Application bootstrap error - handle silently in production
});
