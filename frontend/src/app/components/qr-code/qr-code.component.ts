import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as feather from 'feather-icons';
import QRCode from 'qrcode';

@Component({
  selector: 'app-qr-code',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="qr-code-container">
      <!-- QR Code Display -->
      <div class="qr-code-display bg-white border-2 border-gray-200 rounded-lg p-4 text-center">
        <div *ngIf="qrCodeData; else emptyState" class="space-y-4">
          <!-- QR Code Canvas -->
          <div class="flex justify-center">
            <canvas #qrCanvas
                    [width]="size"
                    [height]="size"
                    class="border border-gray-300 rounded-lg bg-white">
            </canvas>
          </div>

          <!-- QR Code Data (optional, for debugging) -->
          <div *ngIf="showData" class="text-xs text-gray-500 font-mono break-all max-w-xs mx-auto">
            {{ qrCodeData }}
          </div>
        </div>

        <ng-template #emptyState>
          <i data-feather="alert-circle" class="size-12 text-gray-400 mx-auto mb-4"></i>
          <p class="text-gray-500">{{ emptyMessage }}</p>
        </ng-template>
      </div>

      <!-- Action Buttons -->
      <div *ngIf="qrCodeData" class="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
        <button (click)="downloadQRCode()"
                class="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <i data-feather="download" class="size-4 mr-2"></i>
          Download QR Code
        </button>

      </div>

      <!-- Success/Error Messages -->
      <div *ngIf="message" class="mt-4 p-3 rounded-lg text-center text-sm"
           [class]="messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'">
        {{ message }}
      </div>
    </div>
  `,
  styles: [`
    .qr-code-container { max-width: 400px; margin: 0 auto; }
    .qr-code-display { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    canvas { max-width: 100%; height: auto; }
  `]
})
export class QrCodeComponent implements OnInit, OnDestroy {
  // ========= Canvas handling via ViewChild setter =========
  private _canvasEl?: ElementRef<HTMLCanvasElement>;
  private canvasReady = false;

  @ViewChild('qrCanvas', { static: false })
  set qrCanvasSetter(el: ElementRef<HTMLCanvasElement> | undefined) {
    if (el) {
      this._canvasEl = el;
      this.canvasReady = true;
      this.tryGenerate();
    } else {
      this.canvasReady = false;
      this._canvasEl = undefined;
    }
  }

  // ============================== Inputs ====================================
  private _qrCodeData: string | null = null;

  @Input() set qrCodeData(v: string | null) {
    this._qrCodeData = v;
    this.tryGenerate();
  }
  get qrCodeData() { return this._qrCodeData; }

  @Input() size = 256;
  @Input() showData = false;
  @Input() emptyMessage = 'No QR code available';
  @Input() filename = 'qr-code';

  // ============================== State =====================================
  copyButtonText = 'Copy Data';
  message: string | null = null;
  messageType: 'success' | 'error' = 'success';

  // ============================== Lifecycle =================================
  ngOnInit(): void {
    setTimeout(() => feather.replace(), 0);
  }
  ngOnDestroy(): void {
  }

  // ============================== Logic =====================================
  private async tryGenerate(): Promise<void> {
    if (!this.canvasReady) {
      return;
    }
    if (!this._qrCodeData) {
      return;
    }
    if (!this._canvasEl) {
      return;
    }
    await this.generateQRCode();
  }

  private async generateQRCode(): Promise<void> {
    try {
      await QRCode.toCanvas(this._canvasEl!.nativeElement, this._qrCodeData!, {
        width: this.size,
        margin: 1,
        errorCorrectionLevel: 'M'
      });
    } catch (err) {
      this.showMessage('Failed to render QR code', 'error');
    }
  }

  downloadQRCode(): void {
    if (!this._canvasEl) {
      console.warn('[QrCodeComponent] No canvas to download');
      return;
    }
    try {
      const canvas = this._canvasEl.nativeElement;
      const link = document.createElement('a');
      link.download = `${this.filename}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      this.showMessage('QR code downloaded successfully!', 'success');
    } catch (err) {
      console.error('[QrCodeComponent] downloadQRCode error', err);
      this.showMessage('Failed to download QR code', 'error');
    }
  }

  copyToClipboard(): void {
    if (!this._qrCodeData) {
      console.warn('[QrCodeComponent] No QR data to copy');
      return;
    }
    navigator.clipboard.writeText(this._qrCodeData).then(() => {
      this.copyButtonText = 'Copied!';
      this.showMessage('QR code data copied to clipboard!', 'success');
      setTimeout(() => { this.copyButtonText = 'Copy Data'; }, 2000);
    }).catch(err => {
      console.error('[QrCodeComponent] copyToClipboard error', err);
      this.showMessage('Failed to copy to clipboard', 'error');
    });
  }

  private showMessage(text: string, type: 'success' | 'error'): void {
    this.message = text;
    this.messageType = type;
    setTimeout(() => { this.message = null; }, 3000);
  }
}
