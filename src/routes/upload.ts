import { Router } from 'express';
import { authenticateUser, requirePermission } from '../middlewares/auth.js';
import { UploadController, uploadMiddleware } from '../controllers/uploadController.js';

const router = Router();

// Upload single image (Admin and Manager only)
router.post('/image',
  authenticateUser,
  requirePermission('create:products'),
  uploadMiddleware,
  (req, res) => UploadController.uploadImage(req, res)
);

// Generate presigned URL for direct client upload (Admin and Manager only)
router.post('/presigned-url',
  authenticateUser,
  requirePermission('create:products'),
  (req, res) => UploadController.generatePresignedUrl(req, res)
);

// Delete uploaded file (Admin and Manager only)
router.delete('/:key',
  authenticateUser,
  requirePermission('delete:products'),
  (req, res) => UploadController.deleteFile(req, res)
);

export default router;
