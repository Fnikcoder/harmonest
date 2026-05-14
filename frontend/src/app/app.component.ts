import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import * as feather from 'feather-icons';
import { Amplify } from 'aws-amplify';
import { ThemeService } from './services/theme.service';
import { ConfigService } from './services/config.service';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'harmonest';

  constructor(
    private themeService: ThemeService,
    private configService: ConfigService
  ) {
    // Configure Amplify using centralized configuration
    this.initializeAmplify();
  }

  private initializeAmplify() {
    // Wait for config to be loaded
    this.configService.getConfigObservable().subscribe(config => {
      if (config?.technical?.aws?.cognito) {
        this.configureAmplify(config);
      }
    });

    // Try to configure immediately if config is already loaded
    const config = this.configService.getConfig();
    if (config?.technical?.aws?.cognito) {
      this.configureAmplify(config);
    }
  }

  private configureAmplify(config: any) {
    const cognitoConfig = config.technical.aws.cognito;

    const amplifyConfig: any = {
      Auth: {
        Cognito: {
          userPoolId: cognitoConfig.userPoolId,
          userPoolClientId: cognitoConfig.userPoolWebClientId,
          identityPoolId: cognitoConfig.identityPoolId,
          loginWith: {
            email: true,
            phone: true
          }
        }
      }
    };

    // Identity Pool now included for direct AWS service access

    // Add OAuth configuration if available
    if (cognitoConfig.oauth && cognitoConfig.oauth.domain) {
      amplifyConfig.Auth.Cognito.loginWith.oauth = {
        domain: cognitoConfig.oauth.domain,
        scopes: cognitoConfig.oauth.scope,
        redirectSignIn: [cognitoConfig.oauth.redirectSignIn],
        redirectSignOut: [cognitoConfig.oauth.redirectSignOut],
        responseType: cognitoConfig.oauth.responseType as 'code'
      };
    }

    Amplify.configure(amplifyConfig);
  }

  ngAfterViewInit() {
    feather.replace();
  }
}
