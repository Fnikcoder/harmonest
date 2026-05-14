import { Routes } from '@angular/router';
import { IndexOneComponent } from './pages/index/index-one/index-one.component';
import { IndexTwoComponent } from './pages/index/index-two/index-two.component';
import { IndexThreeComponent } from './pages/index/index-three/index-three.component';
import { IndexFourComponent } from './pages/index/index-four/index-four.component';
import { IndexFiveComponent } from './pages/index/index-five/index-five.component';
import { GridComponent } from './pages/listing/tour-grid/grid/grid.component';
import { GridLeftSidebarComponent } from './pages/listing/tour-grid/grid-left-sidebar/grid-left-sidebar.component';
import { GridRightSidebarComponent } from './pages/listing/tour-grid/grid-right-sidebar/grid-right-sidebar.component';
import { ListComponent } from './pages/listing/tour-list/list/list.component';
import { ListLeftSidebarComponent } from './pages/listing/tour-list/list-left-sidebar/list-left-sidebar.component';
import { ListRightSidebarComponent } from './pages/listing/tour-list/list-right-sidebar/list-right-sidebar.component';
import { LocationDetailOneComponent } from './pages/listing/tour-detail/location-detail-one/location-detail-one.component';
import { LocationDetailTwoComponent } from './pages/listing/tour-detail/location-detail-two/location-detail-two.component';
import { AboutusComponent } from './pages/aboutus/aboutus.component';
import { UserProfileComponent } from './pages/account/guest/user-profile/user-profile.component';
import { UserPaymentComponent } from './pages/account/guest/user-payment/user-payment.component';
import { UserInvoiceComponent } from './pages/account/guest/user-invoice/user-invoice.component';
import { UserSocialComponent } from './pages/account/guest/user-social/user-social.component';
import { UserNotificationComponent } from './pages/account/guest/user-notification/user-notification.component';
import { UserSettingComponent } from './pages/account/guest/user-setting/user-setting.component';
import { HelpcenterComponent } from './pages/helpcenter/helpcenter/helpcenter.component';
import { HelpcenterFaqsComponent } from './pages/helpcenter/helpcenter-faqs/helpcenter-faqs.component';
import { HelpcenterGuidesComponent } from './pages/helpcenter/helpcenter-guides/helpcenter-guides.component';
import { HelpcenterSupportComponent } from './pages/helpcenter/helpcenter-support/helpcenter-support.component';
import { LoginComponent } from './pages/auth/login/login.component';
import { SignupComponent } from './pages/auth/signup/signup.component';
import { SignupSuccessComponent } from './pages/auth/signup-success/signup-success.component';
import { EmailVerificationComponent } from './pages/auth/email-verification/email-verification.component';
import { ForgotPasswordComponent } from './pages/auth/forgot-password/forgot-password.component';
import { LockScreenComponent } from './pages/auth/lock-screen/lock-screen.component';
import { TermsComponent } from './pages/legal/terms/terms.component';
import { PrivacyComponent } from './pages/legal/privacy/privacy.component';
import { ComingsoonComponent } from './pages/special/comingsoon/comingsoon.component';
import { MaintenanceComponent } from './pages/special/maintenance/maintenance.component';
import { ErrorComponent } from './pages/special/error/error.component';
import { BlogsComponent } from './pages/blog/blogs/blogs.component';
import { BlogStandardComponent } from './pages/blog/blog-standard/blog-standard.component';
import { BlogDetailComponent } from './pages/blog/blog-detail/blog-detail.component';
import { ContactComponent } from './pages/contact/contact.component';
import { UserBillingComponent } from './pages/account/guest/user-billing/user-billing.component';
import {SearchComponent} from './pages/search/search.component';
import { BookingComponent } from './pages/booking/booking.component';
import { CheckInComponent } from './pages/check-in/check-in.component';
import { DisplayQrcodeComponent } from './pages/display-qrcode/display-qrcode.component';
import { AccessDoorsComponent } from './pages/access-doors/access-doors.component';


export const routes: Routes = [
    // KEEP: Main homepage
    {path:'', component:IndexOneComponent},

    // DISABLED: Alternative homepage layouts
    // {path:'index-two', component:IndexTwoComponent},
    // {path:'index-three', component:IndexThreeComponent},
    // {path:'index-four', component:IndexFourComponent},
    // {path:'index-five', component:IndexFiveComponent},

    // DISABLED: Property listing pages
    // {path:'grid', component:GridComponent},
    // {path:'grid-left-sidebar', component:GridLeftSidebarComponent},
    // {path:'grid-right-sidebar', component:GridRightSidebarComponent},
    // {path:'list', component:ListComponent},
    // {path:'list-left-sidebar', component:ListLeftSidebarComponent},
    // {path:'list-right-sidebar', component:ListRightSidebarComponent},
    // {path:'location-detail-one', component:LocationDetailOneComponent},
    // {path:'location-detail-one/:id', component:LocationDetailOneComponent},
    // {path:'location-detail-two', component:LocationDetailTwoComponent},

    // DISABLED: About and info pages
    // {path:'aboutus', component:AboutusComponent},

    // KEEP: Essential user profile (basic only)
    {path:'user-profile', component:UserProfileComponent},

    // DISABLED: User account features
    // {path:'user-billing', component:UserBillingComponent},
    // {path:'user-payment', component:UserPaymentComponent},
    // {path:'user-invoice', component:UserInvoiceComponent},
    // {path:'user-social', component:UserSocialComponent},
    // {path:'user-notification', component:UserNotificationComponent},
    // {path:'user-setting', component:UserSettingComponent},

    // DISABLED: Help center
    // {path:'helpcenter', component:HelpcenterComponent},
    // {path:'helpcenter-faqs', component:HelpcenterFaqsComponent},
    // {path:'helpcenter-guides', component:HelpcenterGuidesComponent},
    // {path:'helpcenter-support', component:HelpcenterSupportComponent},

    // KEEP: Authentication routes
    {path:'login', component:LoginComponent},
    {path:'signup', component:SignupComponent},
    {path:'signup-success', component:SignupSuccessComponent},
    {path:'email-verification', component:EmailVerificationComponent},
    {path:'forgot-password', component:ForgotPasswordComponent},
    {path:'lock-screen', component:LockScreenComponent},

    // KEEP: Legal pages (may be required)
    {path:'terms', component:TermsComponent},
    {path:'privacy', component:PrivacyComponent},

    // KEEP: Special pages
    {path:'comingsoon', component:ComingsoonComponent},
    {path:'maintenance', component:MaintenanceComponent},
    {path:'404', component:ErrorComponent},

    // DISABLED: Blog
    // {path:'blogs',component:BlogsComponent},
    // {path:'blog-standard', component:BlogStandardComponent},
    // {path:'blog-detail', component:BlogDetailComponent},
    // {path:'blog-detail/:id', component:BlogDetailComponent},

    // KEEP: Contact (for support)
    {path:'contact',component:ContactComponent},

    // DISABLED: Search and booking (for now)
    // {path: 'search',component: SearchComponent},
    // {path: 'booking',component: BookingComponent},

    // KEEP: Check-in functionality
    {path: 'online-check-in', component: CheckInComponent},
    {path: 'check-in', component: CheckInComponent},
    {path: 'check-in/:bookingId', component: CheckInComponent},
    {path: 'activatedqrcode', component: DisplayQrcodeComponent},
    {path: 'accessedDoors', component: AccessDoorsComponent},

    // KEEP: Management routes
    {
        path: 'management',
        loadChildren: () => import('./pages/management/management.routes').then(m => m.managementRoutes)
    },
    { path: '**', redirectTo: '' } // fallback to avoid hard NG04002

];
