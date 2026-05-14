import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { BackToHomeComponent } from '../../../components/back-to-home/back-to-home.component';
import { SwitcherComponent } from '../../../components/switcher/switcher.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-signup-success',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    BackToHomeComponent,
    SwitcherComponent
  ],
  templateUrl: './signup-success.component.html',
  styleUrl: './signup-success.component.scss'
})
export class SignupSuccessComponent implements OnInit {
  date: any;
  emailVerificationEnabled = environment.emailVerificationEnabled.signup;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.date = new Date().getFullYear();

    // If email verification is disabled for signup, redirect to login
    if (!this.emailVerificationEnabled) {
      setTimeout(() => {
        this.router.navigate(['/login'], {
          queryParams: {
            message: 'Account created successfully! Please sign in.'
          }
        });
      }, 2000); // Show success message for 2 seconds then redirect
    }
  }
}
