import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

export type CollectorDocumentType = 'LICENSE' | 'ID';

@Injectable()
export class S3StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET') || '';
    this.publicBaseUrl =
      this.configService.get<string>('AWS_S3_PUBLIC_BASE_URL') || '';

    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey:
          this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
    });
  }

  async createCollectorDocumentUploadUrl(params: {
    userId: string;
    documentType: CollectorDocumentType;
    contentType: string;
    fileName: string;
  }) {
    if (!this.bucket) {
      throw new BadRequestException('AWS_S3_BUCKET is not configured');
    }

    if (!this.isAllowedContentType(params.contentType)) {
      throw new BadRequestException(
        'Only PDF, JPEG, PNG, and WebP documents are allowed',
      );
    }

    const extension = this.extensionFor(params.contentType, params.fileName);
    const key = [
      'collector-documents',
      params.userId,
      `${params.documentType.toLowerCase()}-${randomUUID()}${extension}`,
    ].join('/');

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: params.contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: 10 * 60,
    });

    return {
      key,
      uploadUrl,
      publicUrl: this.publicUrlFor(key),
      expiresInSeconds: 600,
    };
  }

  private publicUrlFor(key: string) {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  private isAllowedContentType(contentType: string) {
    return [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ].includes(contentType);
  }

  private extensionFor(contentType: string, fileName: string) {
    const fileExtension = fileName.match(/\.[a-zA-Z0-9]+$/)?.[0];
    if (fileExtension) return fileExtension.toLowerCase();
    if (contentType === 'application/pdf') return '.pdf';
    if (contentType === 'image/jpeg') return '.jpg';
    if (contentType === 'image/png') return '.png';
    return '.webp';
  }
}
