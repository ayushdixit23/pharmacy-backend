import { Request, Response } from 'express';
import { PrescriptionModel } from '../models/Prescription.js';
import { PrescriptionService } from '../services/PrescriptionService.js';
import ProductModel from '../models/Product.js';
import { StockManagementService } from '../services/StockManagementService.js';
import { CreatePrescriptionRequest, UpdatePrescriptionRequest, PrescriptionFilters, ValidatePrescriptionRequest, DispensePrescriptionRequest } from '../types.js';
import { AuthenticatedRequest } from '../types.js';
import db from '../db/knex.js';

export class PrescriptionController {
  private prescriptionService: PrescriptionService;

  constructor() {
    const prescriptionModel = new PrescriptionModel(db);
    
    this.prescriptionService = new PrescriptionService(prescriptionModel, ProductModel, StockManagementService);
  }

  /**
   * Upload prescription file and create prescription record
   */
  async uploadPrescription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        patient_name,
        patient_phone,
        patient_email,
        patient_dob,
        patient_address,
        doctor_name,
        doctor_license,
        doctor_phone,
        doctor_specialty,
        clinic_name,
        type,
        file_url,
        file_name,
        file_size,
        mime_type,
        medications
      } = req.body;

      if (!patient_name || !doctor_name || !type || !file_url) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: patient_name, doctor_name, type, file_url'
        });
        return;
      }

      const prescriptionData: CreatePrescriptionRequest = {
        patient_name,
        patient_phone,
        patient_email,
        patient_dob,
        patient_address,
        doctor_name,
        doctor_license,
        doctor_phone,
        doctor_specialty,
        clinic_name,
        type,
        file_url,
        file_name,
        file_size,
        mime_type,
        medications: medications || []
      };

      const prescription = await this.prescriptionService.prescriptionModel.create(
        prescriptionData,
        req.user!.id
      );

      res.status(201).json({
        success: true,
        message: 'Prescription uploaded successfully',
        data: prescription
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload prescription'
      });
    }
  }

  /**
   * Process prescription with OCR
   */
  async processWithOCR(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { prescription_id } = req.params;
      const { file_url, type } = req.body;

      if (!file_url || !type) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: file_url, type'
        });
        return;
      }

      const ocrResult = await this.prescriptionService.processPrescriptionWithOCR(file_url, type);

      // Update prescription with OCR results
      const updateData: UpdatePrescriptionRequest = {
        ocr_text: ocrResult.text,
        extracted_data: ocrResult,
        status: 'PENDING_VALIDATION'
      };
      await this.prescriptionService.prescriptionModel.update(prescription_id, updateData, req.user!.id);

      res.json({
        success: true,
        message: 'OCR processing completed',
        data: ocrResult
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'OCR processing failed'
      });
    }
  }

  /**
   * Get all prescriptions with filters
   */
  async getPrescriptions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const filters: PrescriptionFilters = {
        status: req.query.status as string,
        validation_status: req.query.validation_status as string,
        patient_name: req.query.patient_name as string,
        doctor_name: req.query.doctor_name as string,
        uploaded_by: req.query.uploaded_by as string,
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20
      };

      const result = await this.prescriptionService.prescriptionModel.findAll(filters);

      res.json({
        success: true,
        data: result.prescriptions,
        pagination: {
          current_page: filters.page || 1,
          per_page: filters.limit || 20,
          total: result.total,
          total_pages: Math.ceil(result.total / (filters.limit || 20))
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch prescriptions'
      });
    }
  }

  /**
   * Get prescription by ID
   */
  async getPrescriptionById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const prescription = await this.prescriptionService.prescriptionModel.findById(id);
      if (!prescription) {
        res.status(404).json({
          success: false,
          error: 'Prescription not found'
        });
        return;
      }

      // Get medications
      const medications = await this.prescriptionService.prescriptionModel.getMedications(id);

      // Get audit logs
      const auditLogs = await this.prescriptionService.prescriptionModel.getAuditLogs(id);

      res.json({
        success: true,
        data: {
          ...prescription,
          medications,
          audit_logs: auditLogs
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch prescription'
      });
    }
  }

  /**
   * Get prescription medications
   */
  async getPrescriptionMedications(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const medications = await this.prescriptionService.prescriptionModel.getMedications(id);

      res.json({
        success: true,
        data: medications
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch prescription medications'
      });
    }
  }

  /**
   * Update prescription
   */
  async updatePrescription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdatePrescriptionRequest = req.body;

      const prescription = await this.prescriptionService.prescriptionModel.update(
        id,
        updateData,
        req.user!.id
      );

      if (!prescription) {
        res.status(404).json({
          success: false,
          error: 'Prescription not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Prescription updated successfully',
        data: prescription
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update prescription'
      });
    }
  }

  /**
   * Validate prescription
   */
  async validatePrescription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { validation_status, validation_notes } = req.body;

      if (!validation_status || !validation_notes) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: validation_status, validation_notes'
        });
        return;
      }

      const prescription = await this.prescriptionService.validatePrescription(id, {
        validation_status,
        validation_notes,
        validatedBy: req.user!.id
      });

      res.json({
        success: true,
        message: 'Prescription validation completed',
        data: prescription
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate prescription'
      });
    }
  }

  /**
   * Dispense prescription
   */
  async dispensePrescription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { medications } = req.body;

      if (!medications || !Array.isArray(medications)) {
        res.status(400).json({
          success: false,
          error: 'Missing or invalid medications data'
        });
        return;
      }

      const prescription = await this.prescriptionService.dispensePrescription(id, {
        medications,
        dispensedBy: req.user!.id
      });

      res.json({
        success: true,
        message: 'Prescription dispensed successfully',
        data: prescription
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to dispense prescription'
      });
    }
  }

  /**
   * Reject prescription
   */
  async rejectPrescription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { rejection_reason } = req.body;

      if (!rejection_reason) {
        res.status(400).json({
          success: false,
          error: 'Missing required field: rejection_reason'
        });
        return;
      }

      const prescription = await this.prescriptionService.prescriptionModel.reject(
        id,
        rejection_reason,
        req.user!.id
      );

      if (!prescription) {
        res.status(404).json({
          success: false,
          error: 'Prescription not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Prescription rejected',
        data: prescription
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reject prescription'
      });
    }
  }

  /**
   * Link prescription to sale
   */
  async linkToSale(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { sale_id, total_amount } = req.body;

      if (!sale_id || !total_amount) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: sale_id, total_amount'
        });
        return;
      }

      const saleLink = await this.prescriptionService.linkPrescriptionToSale(
        id,
        sale_id,
        total_amount,
        req.user!.id
      );

      res.json({
        success: true,
        message: 'Prescription linked to sale successfully',
        data: saleLink
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to link prescription to sale'
      });
    }
  }

  /**
   * Search products for medication matching
   */
  async searchProductsForMedication(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { medication_name, dosage } = req.query;

      if (!medication_name) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameter: medication_name'
        });
        return;
      }

      const products = await this.prescriptionService.searchProductsForMedication(
        medication_name as string,
        dosage as string
      );

      res.json({
        success: true,
        data: products
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search products'
      });
    }
  }

  /**
   * Get prescription statistics
   */
  async getPrescriptionStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const filters = req.query;
      const stats = await this.prescriptionService.getPrescriptionStats(filters);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch prescription statistics'
      });
    }
  }
}
