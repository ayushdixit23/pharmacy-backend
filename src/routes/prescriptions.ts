import { Router } from 'express';
import { authenticateUser, requirePermission, requireAnyPermission } from '../middlewares/auth.js';
import { PrescriptionController } from '../controllers/prescriptionController.js';

const router = Router();
const prescriptionController = new PrescriptionController();

// ===== PRESCRIPTION MANAGEMENT ROUTES =====

// Upload prescription (Pharmacist and Admin)
router.post('/upload',
    authenticateUser,
    requireAnyPermission(['create:prescriptions']),
    (req, res) => prescriptionController.uploadPrescription(req, res)
);

// Process prescription with OCR (Pharmacist and Admin)
router.post('/:prescription_id/process-ocr',
    authenticateUser,
    requireAnyPermission(['update:prescriptions']),
    (req, res) => prescriptionController.processWithOCR(req, res)
);

// Get all prescriptions (Pharmacist and Admin)
router.get('/',
    authenticateUser,
    requireAnyPermission(['read:prescriptions']),
    (req, res) => prescriptionController.getPrescriptions(req, res)
);

// Get prescription by ID (Pharmacist and Admin)
router.get('/:id',
    authenticateUser,
    requireAnyPermission(['read:prescriptions']),
    (req, res) => prescriptionController.getPrescriptionById(req, res)
);

// Get prescription medications (Pharmacist and Admin)
router.get('/:id/medications',
    authenticateUser,
    requireAnyPermission(['read:prescriptions']),
    (req, res) => prescriptionController.getPrescriptionMedications(req, res)
);

// Update prescription (Pharmacist and Admin)
router.put('/:id',
    authenticateUser,
    requireAnyPermission(['update:prescriptions']),
    (req, res) => prescriptionController.updatePrescription(req, res)
);

// Validate prescription (Pharmacist and Admin)
router.post('/:id/validate',
    authenticateUser,
    requireAnyPermission(['update:prescriptions']),
    (req, res) => prescriptionController.validatePrescription(req, res)
);

// Dispense prescription (Pharmacist and Admin)
router.post('/:id/dispense',
    authenticateUser,
    requireAnyPermission(['update:prescriptions']),
    (req, res) => prescriptionController.dispensePrescription(req, res)
);

// Reject prescription (Pharmacist and Admin)
router.post('/:id/reject',
    authenticateUser,
    requireAnyPermission(['update:prescriptions']),
    (req, res) => prescriptionController.rejectPrescription(req, res)
);

// Link prescription to sale (Pharmacist and Admin)
router.post('/:id/link-sale',
    authenticateUser,
    requireAnyPermission(['update:prescriptions']),
    (req, res) => prescriptionController.linkToSale(req, res)
);

// Search products for medication matching (Pharmacist and Admin)
router.get('/search/products',
    authenticateUser,
    requireAnyPermission(['read:prescriptions', 'read:products']),
    (req, res) => prescriptionController.searchProductsForMedication(req, res)
);

// Get prescription statistics (Admin only - includes audit logs)
router.get('/stats/overview',
    authenticateUser,
    requirePermission('read:prescriptions'),
    (req, res) => prescriptionController.getPrescriptionStats(req, res)
);

export default router;
