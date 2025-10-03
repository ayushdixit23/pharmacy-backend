import Alert from '../models/Alert.js';
import Product from '../models/Product.js';
import Batch from '../models/Batch.js';
import { v4 as uuidv4 } from 'uuid';
import { 
  AuthenticatedRequest, 
  ApiResponse, 
  Alert as AlertType, 
  CreateAlertRequest,
  AlertFilters 
} from '../types.js';

// Get all alerts for a user
export const getAlerts = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { status = 'ACTIVE', alert_type } = req.query as AlertFilters;
    const userId = req.user?.id;

    let alerts: AlertType[];
    if (alert_type === 'LOW_STOCK') {
      alerts = await Alert.getLowStockAlerts();
    } else if (alert_type === 'EXPIRY') {
      alerts = await Alert.getExpiryAlerts();
    } else {
      alerts = await Alert.findByUserId(userId, status);
    }

    const response: ApiResponse<AlertType[]> = {
      success: true,
      data: alerts
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching alerts:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch alerts',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Get alert by ID
export const getAlertById = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { id } = req.params;
    const alert = await Alert.findById(id);

    if (!alert) {
      const response: ApiResponse = {
        success: false,
        error: 'Alert not found'
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<AlertType> = {
      success: true,
      data: alert
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching alert:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch alert',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Acknowledge alert
export const acknowledgeAlert = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const alert = await Alert.findById(id);
    if (!alert) {
      const response: ApiResponse = {
        success: false,
        error: 'Alert not found'
      };
      res.status(404).json(response);
      return;
    }

    const updatedAlert = await Alert.updateStatus(id, 'ACKNOWLEDGED', userId as any);

    const response: ApiResponse<AlertType> = {
      success: true,
      data: updatedAlert,
      message: 'Alert acknowledged successfully'
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error acknowledging alert:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to acknowledge alert',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Resolve alert
export const resolveAlert = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const alert = await Alert.findById(id);
    if (!alert) {
      const response: ApiResponse = {
        success: false,
        error: 'Alert not found'
      };
      res.status(404).json(response);
      return;
    }

    const updatedAlert = await Alert.updateStatus(id, 'RESOLVED', userId as any);

    const response: ApiResponse<AlertType> = {
      success: true,
      data: updatedAlert,
      message: 'Alert resolved successfully'
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error resolving alert:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to resolve alert',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Delete alert
export const deleteAlert = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { id } = req.params;

    const alert = await Alert.findById(id);
    if (!alert) {
      const response: ApiResponse = {
        success: false,
        error: 'Alert not found'
      };
      res.status(404).json(response);
      return;
    }

    await Alert.delete(id);

    const response: ApiResponse = {
      success: true,
      message: 'Alert deleted successfully'
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error deleting alert:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to delete alert',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Get low stock alerts
export const getLowStockAlerts = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const alerts = await Alert.getLowStockAlerts();

    const response: ApiResponse<AlertType[]> = {
      success: true,
      data: alerts
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching low stock alerts:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch low stock alerts',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Get expiry alerts
export const getExpiryAlerts = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const { days = 30 } = req.query;
    const alerts = await Alert.getExpiryAlerts(parseInt(days as string));

    const response: ApiResponse<AlertType[]> = {
      success: true,
      data: alerts
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching expiry alerts:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch expiry alerts',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Create manual alert
export const createAlert = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const {
      product_id,
      batch_id,
      alert_type,
      message,
      priority = 1
    } = req.body as CreateAlertRequest;

    // Verify product exists
    if (product_id) {
      const product = await Product.findById(product_id);
      if (!product) {
        const response: ApiResponse = {
          success: false,
          error: 'Product not found'
        };
        res.status(404).json(response);
        return;
      }
    }

    // Verify batch exists
    if (batch_id) {
      const batch = await Batch.findById(batch_id);
      if (!batch) {
        const response: ApiResponse = {
          success: false,
          error: 'Batch not found'
        };
        res.status(404).json(response);
        return;
      }
    }

    const alertData = {
      id: uuidv4(),
      product_id,
      batch_id,
      alert_type,
      message,
      priority,
      status: 'ACTIVE' as const,
      user_id: req.user?.id
    };

    const alert = await Alert.create(alertData);

    const response: ApiResponse<AlertType> = {
      success: true,
      data: alert,
      message: 'Alert created successfully'
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error('Error creating alert:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to create alert',
      details: error.message
    };
    res.status(500).json(response);
  }
};

// Get alert statistics
export const getAlertStats = async (req: AuthenticatedRequest, res: any): Promise<void> => {
  try {
    const db = require('../db/knex');
    
    const stats = await db('alerts')
      .select('alert_type', 'status')
      .count('* as count')
      .groupBy('alert_type', 'status');

    const formattedStats = stats.reduce((acc: any, stat: any) => {
      if (!acc[stat.alert_type]) {
        acc[stat.alert_type] = {};
      }
      acc[stat.alert_type][stat.status] = parseInt(stat.count);
      return acc;
    }, {});

    const response: ApiResponse = {
      success: true,
      data: formattedStats
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching alert statistics:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch alert statistics',
      details: error.message
    };
    res.status(500).json(response);
  }
};
