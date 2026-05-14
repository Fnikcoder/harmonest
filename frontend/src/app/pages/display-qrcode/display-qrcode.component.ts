import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { QrCodeComponent } from '../../components/qr-code/qr-code.component';
import {NavbarComponent} from '../../components/navbar/navbar.component';
import {FooterComponent} from '../../components/footer/footer.component';
import {SwitcherComponent} from '../../components/switcher/switcher.component';
import {takeUntil} from 'rxjs/operators';
import {Subject} from 'rxjs';

@Component({
  selector: 'app-display-qrcode',
  standalone: true,
  imports: [CommonModule, QrCodeComponent, NavbarComponent, FooterComponent, SwitcherComponent],
  templateUrl: './display-qrcode.component.html',
  styleUrls: ['./display-qrcode.component.css']
})
export class DisplayQrcodeComponent implements OnInit {
  qrCodeData: string | null = null;
  isValidQrCode = false;
  private destroy$ = new Subject<void>();

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Extract QR code from URL parameter
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.qrCodeData = params['qrcode'];
      this.isValidQrCode = !!this.qrCodeData && this.qrCodeData.length > 10;
    });
  }

  downloadQrCode(): void {
    if (!this.qrCodeData) return;
    // Create QR code as downloadable image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (ctx) {
      canvas.width = 300;
      canvas.height = 300;

      // Simple QR code placeholder - in real implementation, use QR code library
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 300, 300);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('QR CODE', 150, 150);
      ctx.fillText(this.qrCodeData.substring(0, 20), 150, 170);

      // Download the canvas as image
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'harmonest-door-access.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      });
    }
  }

  copyQrCode(): void {
    if (this.qrCodeData) {
      navigator.clipboard.writeText(this.qrCodeData).then(() => {
        // Could add a toast notification here
        console.log('QR code copied to clipboard');
      });
    }
  }
}
