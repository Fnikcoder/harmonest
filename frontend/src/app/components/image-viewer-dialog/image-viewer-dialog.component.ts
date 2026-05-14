// image-viewer-dialog.component.ts
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-image-viewer-dialog',
  standalone: true,
  templateUrl: './image-viewer-dialog.component.html',
  styleUrls: ['./image-viewer-dialog.component.scss']
})
export class ImageViewerDialogComponent {
  currentIndex: number;

  constructor(
    public dialogRef: MatDialogRef<ImageViewerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public images: string[]
  ) {
    this.currentIndex = 0;
  }

  next(): void {
    this.currentIndex = (this.currentIndex + 1) % this.images.length;
  }

  prev(): void {
    this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
  }

  close(): void {
    this.dialogRef.close();
  }
}
