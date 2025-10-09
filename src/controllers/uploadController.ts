import { Request, Response } from 'express';
import multer from 'multer';
import { S3Service } from '../services/s3Service.js';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

export class UploadController {
  /**
   * Upload single image file
   */
  static async uploadImage(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file provided'
        });
        return;
      }

      const result = await S3Service.uploadFile(req.file, 'productImages');

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: result.error || 'Upload failed'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          url: result.url,
          key: result.key
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      });
    }
  }

  /**
   * Generate presigned URL for direct client upload
   */
  static async generatePresignedUrl(req: Request, res: Response): Promise<void> {
    try {
      const { fileName, contentType } = req.body;

      if (!fileName || !contentType) {
        res.status(400).json({
          success: false,
          error: 'fileName and contentType are required'
        });
        return;
      }

      if (!contentType.startsWith('image/')) {
        res.status(400).json({
          success: false,
          error: 'Only image files are allowed'
        });
        return;
      }

      const result = await S3Service.generatePresignedUrl(fileName, contentType, 'productImages');

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to generate presigned URL'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          url: result.url,
          key: result.key,
          presignedUrl: result.presignedUrl
        }
      });
    } catch (error) {
      console.error('Presigned URL error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate presigned URL'
      });
    }
  }

  /**
   * Delete uploaded file
   */
  static async deleteFile(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;

      if (!key) {
        res.status(400).json({
          success: false,
          error: 'File key is required'
        });
        return;
      }

      const result = await S3Service.deleteFile(key);

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: result.error || 'Delete failed'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed'
      });
    }
  }
}

// Export multer middleware
export const uploadMiddleware = upload.single('image');
