import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { NavbarComponent } from '../../../../components/navbar/navbar.component';
import { FooterComponent } from '../../../../components/footer/footer.component';
import { SwitcherComponent } from '../../../../components/switcher/switcher.component';
import { TabAccountComponent } from '../../../../components/tab-account/tab-account.component';

import { AuthService } from '../../../../services/auth.service';
import { ModelService } from '../../../../services/model.service';
import {User, UserService} from '../../../../services/user.service';

interface SocialPlatform {
  icon: string;
  name: string;
  placeholder: string;
  desc: string;
  key: string;
  urlPrefix?: string;
}

@Component({
  selector: 'app-user-social',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NavbarComponent,
    FooterComponent,
    SwitcherComponent,
    TabAccountComponent
  ],
  templateUrl: './user-social.component.html',
  styleUrl: './user-social.component.scss'
})
export class UserSocialComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currentUser: User | null = null;
  loading = true;
  error: string | null = null;
  saving = false;

  socialForm: FormGroup;

  socialPlatforms: SocialPlatform[] = [
    {
      icon: 'twitter',
      name: 'Twitter',
      placeholder: 'Twitter username',
      desc: 'Add your Twitter username (without @)',
      key: 'twitter',
      urlPrefix: 'https://twitter.com/'
    },
    {
      icon: 'facebook',
      name: 'Facebook',
      placeholder: 'Facebook profile URL or username',
      desc: 'Add your Facebook profile URL or username',
      key: 'facebook',
      urlPrefix: 'https://facebook.com/'
    },
    {
      icon: 'instagram',
      name: 'Instagram',
      placeholder: 'Instagram username',
      desc: 'Add your Instagram username (without @)',
      key: 'instagram',
      urlPrefix: 'https://instagram.com/'
    },
    {
      icon: 'linkedin',
      name: 'LinkedIn',
      placeholder: 'LinkedIn profile URL',
      desc: 'Add your LinkedIn profile URL',
      key: 'linkedin'
    },
    {
      icon: 'youtube',
      name: 'YouTube',
      placeholder: 'YouTube channel URL',
      desc: 'Add your YouTube channel URL',
      key: 'youtube'
    }
  ];

  constructor(
    private authService: AuthService,
    private modelService: ModelService,
    private userService: UserService,
    private fb: FormBuilder
  ) {
    // Initialize form with social platform controls
    const formControls: { [key: string]: any } = {};
    this.socialPlatforms.forEach(platform => {
      formControls[platform.key] = [''];
    });

    this.socialForm = this.fb.group(formControls);
  }

  ngOnInit() {
    this.loadUserData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadUserData() {
    this.loading = true;
    this.error = null;

    // Get current authenticated user
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (authState) => {
          if (authState.isAuthenticated && authState.user) {
            this.loadUserProfile(authState.user.email);
          } else {
            this.loading = false;
            this.error = 'User not authenticated';
          }
        },
        error: (error) => {
          console.error('Error getting auth state:', error);
          this.loading = false;
          this.error = 'Failed to load user data';
        }
      });
  }

  private loadUserProfile(email: string) {
    this.userService.getUserByEmail(email)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user) => {
          this.currentUser = user;
          this.populateForm();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading user profile:', error);
          this.loading = false;
          this.error = 'Failed to load user profile';
        }
      });
  }

  private populateForm() {
    if (!this.currentUser) return;

    // Populate form with existing social media data
    // Note: The User interface doesn't currently have social media fields,
    // so we'll need to extend it or store this in a separate field
    const socialData = (this.currentUser as any).socialMedia || {};

    this.socialPlatforms.forEach(platform => {
      const value = socialData[platform.key] || '';
      this.socialForm.get(platform.key)?.setValue(value);
    });
  }

  onSaveSocial(platform: SocialPlatform) {
    if (!this.currentUser) return;

    this.saving = true;
    const value = this.socialForm.get(platform.key)?.value || '';

    // Update user's social media information
    const updates = {
      [`socialMedia.${platform.key}`]: value,
      updatedAt: new Date().toISOString()
    };

    // this.userService.updateUser(this.currentUser.email, updates)
    //   .pipe(takeUntil(this.destroy$))
    //   .subscribe({
    //     next: (updatedUser) => {
    //       this.currentUser = updatedUser;
    //       this.saving = false;
    //       // Show success message
    //     },
    //     error: (error) => {
    //       console.error('Error updating social media:', error);
    //       this.saving = false;
    //       this.error = 'Failed to update social media information';
    //     }
    //   });
  }

  getSocialValue(platform: SocialPlatform): string {
    return this.socialForm.get(platform.key)?.value || '';
  }

  getFullSocialUrl(platform: SocialPlatform): string {
    const value = this.getSocialValue(platform);
    if (!value) return '';

    if (platform.urlPrefix && !value.startsWith('http')) {
      return platform.urlPrefix + value;
    }

    return value.startsWith('http') ? value : `https://${value}`;
  }

  removeSocial(platform: SocialPlatform) {
    this.socialForm.get(platform.key)?.setValue('');
    this.onSaveSocial(platform);
  }
}
