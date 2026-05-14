import { Injectable } from '@angular/core';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fetchAuthSession } from 'aws-amplify/auth';
import { awsConfig } from '../config/aws.config';
import { canAccessS3Resource } from '../config/aws.config';

@Injectable({
  providedIn: 'root'
})
export class S3DocumentService {
  private s3Client: S3Client | null = null;

  constructor() {}

  private async initializeS3Client(): Promise<void> {
    if (this.s3Client) return;

    try {
      const session = await fetchAuthSession();
      if (session.credentials) {
        this.s3Client = new S3Client({
          region: awsConfig.region,
          credentials: session.credentials
        });
      }
    } catch (error) {
      console.error('Failed to initialize S3 client:', error);
      throw new Error('Unable to access documents. Please ensure you are logged in.');
    }
  }

  async getDocumentUrl(s3Key: string, reservationId?: string): Promise<string> {
    await this.initializeS3Client();

    if (!this.s3Client) {
      throw new Error('S3 client not initialized');
    }

    // Check permissions
    const hasAccess = await this.checkDocumentAccess(s3Key, reservationId);
    if (!hasAccess) {
      throw new Error('Access denied to this document');
    }

    try {
      // Parse S3 key to extract bucket and object key
      const { bucket, key } = this.parseS3Key(s3Key);

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      });

      // Generate presigned URL valid for 1 hour
      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600
      });

      return presignedUrl;
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw new Error('Failed to generate document access URL');
    }
  }

  private parseS3Key(s3Key: string): { bucket: string; key: string } {
    if (s3Key.startsWith('s3://')) {
      // Format: s3://bucket-name/path/to/file
      const withoutProtocol = s3Key.substring(5);
      const firstSlashIndex = withoutProtocol.indexOf('/');

      if (firstSlashIndex === -1) {
        throw new Error('Invalid S3 key format');
      }

      return {
        bucket: withoutProtocol.substring(0, firstSlashIndex),
        key: withoutProtocol.substring(firstSlashIndex + 1)
      };
    } else {
      // Assume it's already just the key and use default bucket
      return {
        bucket: 'harmonest-storage',
        key: s3Key
      };
    }
  }

  private async checkDocumentAccess(s3Key: string, reservationId?: string): Promise<boolean> {
    try {
      const session = await fetchAuthSession();
      if (!session.tokens?.idToken) return false;

      const payload = session.tokens.idToken.payload;
      const groups = (payload['cognito:groups'] as string[]) || [];
      const userId = payload.sub as string;
      const userRole = groups.length > 0 ? groups[0] : 'guest';

      // Extract resource path from S3 key
      const { key } = this.parseS3Key(s3Key);

      // Check S3 access permissions
      return canAccessS3Resource(userRole, 'read', key, userId);
    } catch (error) {
      console.error('Error checking document access:', error);
      return false;
    }
  }
}
