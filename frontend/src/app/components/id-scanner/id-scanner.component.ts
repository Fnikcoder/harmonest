import { Component, OnInit, OnDestroy, AfterViewChecked, ViewChild, ElementRef, Output, EventEmitter, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CheckInService, IdScanResult } from '../../services/check-in.service';
import * as feather from 'feather-icons';

@Component({
  selector: 'app-id-scanner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './id-scanner.component.html',
  styleUrl: './id-scanner.component.scss'
})
export class IdScannerComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('videoElement', { static: false }) videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement', { static: false }) canvasElement!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef<HTMLInputElement>;

  @Input() documentType: 'passport' | 'national_id' = 'passport';
  @Output() scanComplete = new EventEmitter<IdScanResult>();
  @Output() scanError = new EventEmitter<string>();

  private destroy$ = new Subject<void>();

  isCameraActive = false;
  isScanning = false;
  scanResult: IdScanResult | null = null;
  errorMessage = '';
  stream: MediaStream | null = null;

  // Scanner mode: 'camera' or 'upload'
  scannerMode: 'camera' | 'upload' = 'upload';

  // Flag to track if we need to setup video after view is ready
  private needsVideoSetup = false;

  // Camera constraints
  private constraints = {
    video: {
      width: { ideal: 1280, min: 640 },
      height: { ideal: 720, min: 480 },
      facingMode: { ideal: 'environment' }, // Prefer back camera on mobile
      aspectRatio: { ideal: 16/9 }
    },
    audio: false
  };

  constructor(
    private checkInService: CheckInService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.checkCameraSupport();

    // Initialize Feather icons
    setTimeout(() => {
      feather.replace();
    }, 100);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopCamera();
  }

  ngAfterViewChecked(): void {
    // If we need to setup video and the element is now available
    if (this.needsVideoSetup && this.videoElement && this.videoElement.nativeElement && this.stream) {
      this.needsVideoSetup = false;
      this.setupVideoElementDirectly();
    }

    // Initialize Feather icons after view is checked
    setTimeout(() => {
      feather.replace();
    }, 0);
  }

  private checkCameraSupport(): void {
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      // Camera is supported
      this.scannerMode = 'camera';
    } else {
      // Fallback to file upload
      this.scannerMode = 'upload';
    }
  }

  async startCamera(): Promise<void> {
    try {
      this.errorMessage = '';

      // Stop any existing stream first
      this.stopCamera();

      // Try with ideal constraints first, then fallback to basic constraints
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(this.constraints);
      } catch (idealError) {
        console.warn('Ideal camera constraints failed, trying basic constraints:', idealError);
        // Fallback to basic constraints
        const basicConstraints = {
          video: {
            width: { min: 320, ideal: 640 },
            height: { min: 240, ideal: 480 }
          },
          audio: false
        };
        stream = await navigator.mediaDevices.getUserMedia(basicConstraints);
      }

      this.stream = stream;

      // Set camera active first to trigger Angular to render the video element
      this.isCameraActive = true;
      this.needsVideoSetup = true;

      // Trigger change detection to render the video element
      this.cdr.detectChanges();

      // Use AfterViewChecked or setTimeout to ensure the video element is rendered
      this.setupVideoElement();

    } catch (error) {
      console.error('Error accessing camera:', error);
      this.errorMessage = 'Unable to access camera. Please use file upload instead.';
      this.scannerMode = 'upload';
    }
  }

  private setupVideoElement(): void {
    // Try multiple times with increasing delays to ensure the element is rendered
    const maxAttempts = 10;
    let attempts = 0;

    const trySetupVideo = () => {
      attempts++;

      if (this.videoElement && this.videoElement.nativeElement && this.stream) {
        const video = this.videoElement.nativeElement;
        video.srcObject = this.stream;

        // Set video attributes for better compatibility
        video.setAttribute('playsinline', 'true');
        video.setAttribute('autoplay', 'true');
        video.muted = true; // Mute to avoid autoplay issues

        // Handle video loading
        video.onloadedmetadata = () => {
          console.log('Video metadata loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
          video.play().then(() => {
            console.log('Camera started successfully');
          }).catch((playError) => {
            console.error('Error playing video:', playError);
            this.errorMessage = 'Unable to start camera preview. Please try again.';
            this.isCameraActive = false;
          });
        };

        video.onerror = (error) => {
          console.error('Video element error:', error);
          this.errorMessage = 'Camera preview error. Please try again.';
          this.isCameraActive = false;
        };

        // Additional event listeners for debugging
        video.oncanplay = () => {
          console.log('Video can play');
        };

        video.onplay = () => {
          console.log('Video started playing');
        };

      } else if (attempts < maxAttempts) {
        // Try again with exponential backoff
        setTimeout(trySetupVideo, attempts * 50);
      } else {
        console.error('Video element not found after', maxAttempts, 'attempts');
        this.errorMessage = 'Camera initialization failed. Please refresh and try again.';
        this.isCameraActive = false;
      }
    };

    // Start trying immediately
    trySetupVideo();
  }

  private setupVideoElementDirectly(): void {
    if (this.videoElement && this.videoElement.nativeElement && this.stream) {
      const video = this.videoElement.nativeElement;
      video.srcObject = this.stream;

      // Set video attributes for better compatibility
      video.setAttribute('playsinline', 'true');
      video.setAttribute('autoplay', 'true');
      video.muted = true;

      // Handle video loading
      video.onloadedmetadata = () => {
        console.log('Video metadata loaded (direct), dimensions:', video.videoWidth, 'x', video.videoHeight);
        video.play().then(() => {
          console.log('Camera started successfully (direct)');
        }).catch((playError) => {
          console.error('Error playing video (direct):', playError);
          this.errorMessage = 'Unable to start camera preview. Please try again.';
          this.isCameraActive = false;
        });
      };

      video.onerror = (error) => {
        console.error('Video element error (direct):', error);
        this.errorMessage = 'Camera preview error. Please try again.';
        this.isCameraActive = false;
      };
    }
  }

  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.isCameraActive = false;
  }

  capturePhoto(): void {
    if (!this.videoElement || !this.canvasElement) {
      console.error('Video or canvas element not found');
      this.errorMessage = 'Camera capture failed. Please try again.';
      return;
    }

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const context = canvas.getContext('2d');

    if (!context) {
      console.error('Canvas context not available');
      this.errorMessage = 'Camera capture failed. Please try again.';
      return;
    }

    // Check if video has valid dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('Video has no dimensions:', video.videoWidth, 'x', video.videoHeight);
      this.errorMessage = 'Camera not ready. Please wait and try again.';
      return;
    }

    console.log('Capturing photo with dimensions:', video.videoWidth, 'x', video.videoHeight);

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob and process
    canvas.toBlob((blob) => {
      if (blob) {
        console.log('Photo captured successfully, blob size:', blob.size);
        const file = new File([blob], 'captured-id.jpg', { type: 'image/jpeg' });
        this.processIdDocument(file);
      } else {
        console.error('Failed to create blob from canvas');
        this.errorMessage = 'Failed to capture photo. Please try again.';
      }
    }, 'image/jpeg', 0.8);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      console.log('File selected:', file.name, 'Size:', file.size, 'Type:', file.type);

      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.errorMessage = 'Please select a valid image file.';
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        this.errorMessage = 'File size must be less than 10MB.';
        return;
      }

      this.processIdDocument(file);
    } else {
      console.log('No file selected');
    }
  }

  private processIdDocument(file: File): void {
    console.log('Processing ID document:', file.name, 'Size:', file.size);

    this.isScanning = true;
    this.errorMessage = '';
    this.scanResult = null;

    this.checkInService.scanIdDocument(file, this.documentType)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result: IdScanResult) => {
          console.log('ID scan result received:', result);
          this.isScanning = false;
          this.scanResult = result;

          if (result.success) {
            // Include the actual captured file in the result
            const resultWithFile = {
              ...result,
              capturedFile: file
            };
            console.log('Emitting scan complete with file:', file.name);
            this.scanComplete.emit(resultWithFile);
            this.stopCamera(); // Stop camera after successful scan
          } else {
            this.errorMessage = result.message;
            this.scanError.emit(result.message);
          }

          // Refresh icons after scan result is displayed
          this.refreshFeatherIcons();
        },
        error: (error) => {
          console.error('ID scan error:', error);
          this.isScanning = false;
          this.errorMessage = 'Failed to process ID document. Please try again.';
          this.scanError.emit(this.errorMessage);
        }
      });
  }

  switchToCamera(): void {
    this.scannerMode = 'camera';
    this.errorMessage = '';
    this.startCamera();
    this.refreshFeatherIcons();
  }

  switchToUpload(): void {
    this.scannerMode = 'upload';
    this.stopCamera();
    this.errorMessage = '';
    this.refreshFeatherIcons();
  }

  retryScanning(): void {
    this.scanResult = null;
    this.errorMessage = '';

    if (this.scannerMode === 'camera' && !this.isCameraActive) {
      this.startCamera();
    }
  }

  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  debugCamera(): void {
    console.log('=== Camera Debug Info ===');
    console.log('Navigator mediaDevices available:', !!navigator.mediaDevices);
    console.log('getUserMedia available:', !!navigator.mediaDevices?.getUserMedia);
    console.log('Video element exists:', !!this.videoElement);
    console.log('Current scanner mode:', this.scannerMode);
    console.log('Camera active:', this.isCameraActive);
    console.log('Current stream:', this.stream);
    console.log('Error message:', this.errorMessage);

    // Test basic camera access
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
          console.log('Basic camera test successful:', stream);
          console.log('Video tracks:', stream.getVideoTracks());
          stream.getTracks().forEach(track => track.stop()); // Clean up test stream
        })
        .catch(error => {
          console.error('Basic camera test failed:', error);
        });
    }

    // List available devices
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          console.log('Available devices:', devices);
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          console.log('Video input devices:', videoDevices);
        })
        .catch(error => {
          console.error('Error enumerating devices:', error);
        });
    }
  }

  private refreshFeatherIcons(): void {
    // Use multiple timeouts to ensure icons are replaced properly
    setTimeout(() => {
      feather.replace();
    }, 50);

    setTimeout(() => {
      feather.replace();
    }, 200);

    setTimeout(() => {
      feather.replace();
    }, 500);
  }
}
