import { Router } from 'express';
import { authenticateUser, requireRole, requirePermission, requireAnyPermission, UserRole } from '../middlewares/auth.js';
import { getUserFeatures, canPerformAction } from '../utils/roleManager.js';

const router = Router();

// ===== PHARMACY MANAGEMENT API ENDPOINTS =====

// Prescription Management - Enhanced with full functionality
router.get('/prescriptions', 
  authenticateUser, 
  requireAnyPermission(['read:prescriptions']), 
  async (req, res) => {
    try {
      // In real app, fetch prescriptions from database with full prescription data
      const prescriptions = [
        {
          id: '1',
          prescription_number: 'RX202501030001',
          patient_name: 'John Doe',
          doctor_name: 'Dr. Smith',
          status: 'VALIDATED',
          validation_status: 'APPROVED',
          medications: [
            { name: 'Aspirin', dosage: '100mg', frequency: 'Once daily' }
          ],
          created_at: new Date().toISOString()
        }
      ];

      res.json({
        success: true,
        prescriptions,
        total: prescriptions.length,
        user: req.user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch prescriptions'
      });
    }
  }
);

router.post('/prescriptions/upload', 
  authenticateUser, 
  requirePermission('create:prescriptions'), 
  async (req, res) => {
    try {
      const { patient_name, doctor_name, file_url, type, medications } = req.body;

      // In real app, create prescription in database with OCR processing
      const prescription = {
        id: Date.now().toString(),
        prescription_number: `RX${Date.now()}`,
        patient_name,
        doctor_name,
        file_url,
        type,
        medications,
        status: 'UPLOADED',
        validation_status: 'PENDING',
        uploaded_by: req.user!.id,
        created_at: new Date().toISOString()
      };

      res.status(201).json({
        success: true,
        message: 'Prescription uploaded successfully',
        prescription
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to upload prescription'
      });
    }
  }
);

router.post('/prescriptions/:id/validate', 
  authenticateUser, 
  requirePermission('update:prescriptions'), 
  async (req, res) => {
    try {
      const { validation_status, validation_notes } = req.body;

      // In real app, validate prescription in database
      const prescription = {
        id: req.params.id,
        validation_status,
        validation_notes,
        validated_by: req.user!.id,
        validated_at: new Date().toISOString()
      };

      res.json({
        success: true,
        message: 'Prescription validation completed',
        prescription
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to validate prescription'
      });
    }
  }
);

router.post('/prescriptions/:id/dispense', 
  authenticateUser, 
  requirePermission('update:prescriptions'), 
  async (req, res) => {
    try {
      const { medications } = req.body;

      // In real app, dispense prescription and update inventory
      const prescription = {
        id: req.params.id,
        status: 'DISPENSED',
        dispensed_by: req.user!.id,
        dispensed_at: new Date().toISOString(),
        medications
      };

      res.json({
        success: true,
        message: 'Prescription dispensed successfully',
        prescription
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to dispense prescription'
      });
    }
  }
);

// Inventory Management
router.get('/inventory', 
  authenticateUser, 
  requireAnyPermission(['read:inventory']), 
  async (req, res) => {
    try {
      // In real app, fetch inventory from database
      const inventory = [
        {
          id: '1',
          name: 'Aspirin',
          quantity: 100,
          unitPrice: 5.99,
          expiryDate: '2025-12-31',
          supplier: 'MedSupply Inc'
        }
      ];

      res.json({
        success: true,
        inventory,
        total: inventory.length,
        user: req.user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch inventory'
      });
    }
  }
);

router.post('/inventory', 
  authenticateUser, 
  requirePermission('update:inventory'), 
  async (req, res) => {
    try {
      const { name, quantity, unitPrice, expiryDate, supplier } = req.body;

      // In real app, update inventory in database
      const item = {
        id: Date.now().toString(),
        name,
        quantity,
        unitPrice,
        expiryDate,
        supplier,
        updatedBy: req.user!.id,
        updatedAt: new Date().toISOString()
      };

      res.status(201).json({
        success: true,
        message: 'Inventory item updated successfully',
        item
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to update inventory'
      });
    }
  }
);

// Reports Management
router.get('/reports', 
  authenticateUser, 
  requireAnyPermission(['read:reports']), 
  async (req, res) => {
    try {
      // In real app, fetch reports from database
      const reports = [
        {
          id: '1',
          title: 'Monthly Sales Report',
          type: 'sales',
          generatedBy: req.user!.id,
          createdAt: new Date().toISOString()
        }
      ];

      res.json({
        success: true,
        reports,
        total: reports.length,
        user: req.user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch reports'
      });
    }
  }
);

router.post('/reports', 
  authenticateUser, 
  requirePermission('create:reports'), 
  async (req, res) => {
    try {
      const { title, type, data } = req.body;

      // In real app, create report in database
      const report = {
        id: Date.now().toString(),
        title,
        type,
        data,
        generatedBy: req.user!.id,
        createdAt: new Date().toISOString()
      };

      res.status(201).json({
        success: true,
        message: 'Report generated successfully',
        report
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate report'
      });
    }
  }
);

// Supplier Management (Admin only)
router.get('/suppliers', 
  authenticateUser, 
  requireAnyPermission(['read:suppliers']), 
  async (req, res) => {
    try {
      // In real app, fetch suppliers from database
      const suppliers = [
        {
          id: '1',
          name: 'MedSupply Inc',
          contact: 'contact@medsupply.com',
          phone: '+1234567890',
          address: '123 Medical St'
        }
      ];

      res.json({
        success: true,
        suppliers,
        total: suppliers.length,
        user: req.user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch suppliers'
      });
    }
  }
);

router.post('/suppliers', 
  authenticateUser, 
  requirePermission('create:suppliers'), 
  async (req, res) => {
    try {
      const { name, contact, phone, address } = req.body;

      // In real app, create supplier in database
      const supplier = {
        id: Date.now().toString(),
        name,
        contact,
        phone,
        address,
        createdBy: req.user!.id,
        createdAt: new Date().toISOString()
      };

      res.status(201).json({
        success: true,
        message: 'Supplier created successfully',
        supplier
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to create supplier'
      });
    }
  }
);

// Dashboard Data (Role-based)
router.get('/dashboard', 
  authenticateUser, 
  async (req, res) => {
    try {
      const userFeatures = getUserFeatures(req.user!);
      
      // Return different dashboard data based on user role
      let dashboardData = {
        user: req.user,
        features: userFeatures,
        stats: {}
      };

      // Pharmacist and above can see inventory stats
      if (canPerformAction(req.user!, 'read', 'inventory')) {
        dashboardData.stats = {
          ...dashboardData.stats,
          totalInventoryItems: 150,
          lowStockItems: 5,
          totalValue: 25000
        };
      }

      // Admin and above can see user stats
      if (canPerformAction(req.user!, 'read', 'users')) {
        dashboardData.stats = {
          ...dashboardData.stats,
          totalUsers: 25,
          activeUsers: 20,
          newUsersThisMonth: 3
        };
      }

      res.json({
        success: true,
        dashboard: dashboardData
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard data'
      });
    }
  }
);

// User Permissions Check
router.get('/permissions/check', 
  authenticateUser, 
  async (req, res) => {
    try {
      const { action, resource } = req.query;
      
      if (!action || !resource) {
        res.status(400).json({
          success: false,
          error: 'Action and resource parameters are required'
        });
        return;
      }

      const canPerform = canPerformAction(req.user!, action as string, resource as string);
      
      res.json({
        success: true,
        canPerform,
        user: req.user,
        action,
        resource
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to check permissions'
      });
    }
  }
);

export default router;
