import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

// Configure AWS SDK
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION 
});

export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  presignedUrl?: string;
  error?: string;
}

export class S3Service {
  private static readonly BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'default-bucket' 

  /**
   * Upload file to S3
   */
  static async uploadFile(
    file: Express.Multer.File,
    folder: string = 'productImages'
  ): Promise<UploadResult> {
    try {
      // Generate unique filename
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `${uuidv4()}.${fileExtension}`;
      const key = `${folder}/${fileName}`;

      const uploadParams = {
        Bucket: this.BUCKET_NAME!,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype
      };

      const result = await s3.upload(uploadParams).promise();

      // Return public S3 URL
      const url = `https://${this.BUCKET_NAME}.s3.amazonaws.com/${key}`;

      return {
        success: true,
        url,
        key
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Delete file from S3
   */
  static async deleteFile(key: string): Promise<UploadResult> {
    try {
      await s3.deleteObject({
        Bucket: this.BUCKET_NAME!,
        Key: key
      }).promise();

      return {
        success: true
      };
    } catch (error) {
      console.error('S3 delete error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed'
      };
    }
  }

  /**
   * Generate presigned URL for direct client upload
   */
  static async generatePresignedUrl(
    fileName: string,
    contentType: string,
    folder: string = 'productImages'
  ): Promise<UploadResult> {
    try {
      const fileExtension = fileName.split('.').pop();
      const uniqueFileName = `${uuidv4()}.${fileExtension}`;
      const key = `${folder}/${uniqueFileName}`;

      const presignedUrl = await s3.getSignedUrlPromise('putObject', {
        Bucket: this.BUCKET_NAME,
        Key: key,
        ContentType: contentType,
        Expires: 300 // 5 minutes
      });

      const url = `https://${this.BUCKET_NAME}.s3.amazonaws.com/${key}`;

      return {
        success: true,
        url,
        key,
        presignedUrl
      };
    } catch (error) {
      console.error('S3 presigned URL error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate presigned URL'
      };
    }
  }
}
