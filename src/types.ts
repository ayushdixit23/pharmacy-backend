import { Request } from 'express';

// Authentication and Request Types
export type AuthenticatedRequest = Request;

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: string;
  pagination?: {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface Product {
  id: string;
  name: string;
  generic_name?: string;
  description?: string;
  image_url?: string;
  category: 'OTC' | 'PRESCRIPTION' | 'SUPPLEMENTS' | 'MEDICAL_DEVICES' | 'COSMETICS' | 'OTHER';
  manufacturer?: string;
  barcode?: string;
  qr_code?: string;
  unit_price: number;
  selling_price: number;
  unit_of_measure: string;
  pack_size?: number;
  min_stock_level: number;
  max_stock_level?: number;
  requires_prescription: boolean;
  supplier_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}


export interface CreateProductRequest {
  name: string;
  description?: string;
  generic_name?: string;
  manufacturer?: string;
  barcode?: string;
  qr_code?: string;
  category: string;
  unit_price: number;
  selling_price: number;
  unit_of_measure: string;
  pack_size?: number;
  min_stock_level?: number;
  max_stock_level?: number;
  requires_prescription?: boolean;
  supplier_id?: string;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  generic_name?: string;
  manufacturer?: string;
  barcode?: string;
  qr_code?: string;
  category?: string;
  unit_price?: number;
  selling_price?: number;
  unit_of_measure?: string;
  pack_size?: number;
  min_stock_level?: number;
  max_stock_level?: number;
  requires_prescription?: boolean;
  supplier_id?: string;
}

export interface ProductFilters {
  category?: string;
  search?: string;
  supplier_id?: string;
  page?: number;
  limit?: number;
}

// Stock Types
export interface StockInfo {
  current_stock: number;
  reserved_stock: number;
  min_stock_level: number;
  max_stock_level: number;
}

// Batch Types
export interface Batch {
  id: string;
  batch_number: string;
  product_id: string;
  supplier_id: string;
  mfg_date: string;
  expiry_date: string;
  initial_quantity: number;
  current_quantity: number;
  cost_price: number;
  selling_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Stock Movement Types
export interface StockMovement {
  id: string;
  product_id: string;
  batch_id?: string;
  movement_type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';
  quantity: number;
  reason?: string;
  user_id?: string;
  reference_id?: string;
  reference_type?: string;
  created_at: string;
  updated_at: string;
}

// Supplier Types
export interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  gst_number: string;
  contact_person: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Alert Types
export interface Alert {
  id: string;
  product_id?: string;
  batch_id?: string;
  alert_type: 'LOW_STOCK' | 'EXPIRY_WARNING' | 'EXPIRED' | 'OUT_OF_STOCK';
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  message: string;
  priority: number;
  user_id?: string;
  acknowledged_at?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAlertRequest {
  product_id?: string;
  batch_id?: string;
  alert_type: 'LOW_STOCK' | 'EXPIRY_WARNING' | 'EXPIRED' | 'OUT_OF_STOCK';
  message: string;
  priority: number;
}

export interface AlertFilters {
  status?: string;
  alert_type?: string;
  page?: number;
  limit?: number;
}

// Barcode Types
export interface UpdateStockByBarcodeRequest {
  quantity: number;
  movement_type: 'IN' | 'OUT' | 'ADJUSTMENT';
  reason?: string;
}

export interface BulkScanRequest {
  barcodes: string[];
}

// Batch Request Types
export interface CreateBatchRequest {
  batch_number: string;
  product_id: string;
  supplier_id: string;
  mfg_date: string;
  expiry_date: string;
  initial_quantity: number;
  cost_price: number;
  selling_price: number;
}

export interface UpdateBatchRequest {
  batch_number?: string;
  mfg_date?: string;
  expiry_date?: string;
  cost_price?: number;
  selling_price?: number;
}

export interface UpdateBatchQuantityRequest {
  quantity: number;
  reason?: string;
}

export interface BatchFilters {
  product_id?: string;
  supplier_id?: string;
  status?: string;
  page?: number;
  limit?: number;
}

// Supplier Request Types
export interface CreateSupplierRequest {
  name: string;
  email: string;
  phone: string;
  address: string;
  gst_number: string;
  contact_person: string;
}

export interface UpdateSupplierRequest {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  gst_number?: string;
  contact_person?: string;
}

export interface SupplierFilters {
  search?: string;
  page?: number;
  limit?: number;
}

// Prescription Types
export interface Prescription {
  id: string;
  prescription_number: string;
  patient_name: string;
  patient_phone?: string;
  patient_email?: string;
  patient_dob?: string;
  patient_address?: string;
  doctor_name: string;
  doctor_license?: string;
  doctor_phone?: string;
  doctor_specialty?: string;
  clinic_name?: string;
  status: 'UPLOADED' | 'PENDING_VALIDATION' | 'VALIDATED' | 'DISPENSED' | 'REJECTED' | 'EXPIRED';
  type: 'IMAGE' | 'PDF' | 'SCANNED';
  file_url: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  ocr_text?: string;
  extracted_data?: any;
  validation_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION';
  validation_notes?: string;
  validated_by?: string;
  validated_at?: string;
  dispensed_by?: string;
  dispensed_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  rejection_reason?: string;
  uploaded_by?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PrescriptionMedication {
  id: string;
  prescription_id: string;
  medication_name: string;
  generic_name?: string;
  dosage: string;
  frequency: string;
  duration?: string;
  instructions?: string;
  quantity?: number;
  unit?: string;
  substitution_allowed: boolean;
  product_id?: string;
  batch_id?: string;
  unit_price?: number;
  total_price?: number;
  is_dispensed: boolean;
  dispensed_by?: string;
  dispensed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePrescriptionRequest {
  patient_name: string;
  patient_phone?: string;
  patient_email?: string;
  patient_dob?: string;
  patient_address?: string;
  doctor_name: string;
  doctor_license?: string;
  doctor_phone?: string;
  doctor_specialty?: string;
  clinic_name?: string;
  type: 'IMAGE' | 'PDF' | 'SCANNED';
  file_url: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  medications: CreatePrescriptionMedicationRequest[];
}

export interface CreatePrescriptionMedicationRequest {
  medication_name: string;
  generic_name?: string;
  dosage: string;
  frequency: string;
  duration?: string;
  instructions?: string;
  quantity?: number;
  unit?: string;
  substitution_allowed?: boolean;
}

export interface UpdatePrescriptionRequest {
  patient_name?: string;
  patient_phone?: string;
  patient_email?: string;
  patient_dob?: string;
  patient_address?: string;
  doctor_name?: string;
  doctor_license?: string;
  doctor_phone?: string;
  doctor_specialty?: string;
  clinic_name?: string;
  status?: 'UPLOADED' | 'PENDING_VALIDATION' | 'VALIDATED' | 'DISPENSED' | 'REJECTED' | 'EXPIRED';
  validation_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION';
  validation_notes?: string;
  rejection_reason?: string;
  ocr_text?: string;
  extracted_data?: any;
}

export interface PrescriptionFilters {
  status?: string;
  validation_status?: string;
  patient_name?: string;
  doctor_name?: string;
  uploaded_by?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface OCRResult {
  text: string;
  confidence: number;
  medications: ExtractedMedication[];
  patient_info: {
    name?: string;
    phone?: string;
    email?: string;
    dob?: string;
    address?: string;
  };
  doctor_info: {
    name?: string;
    license?: string;
    phone?: string;
    specialty?: string;
    clinic?: string;
  };
}

export interface ExtractedMedication {
  name: string;
  dosage: string;
  frequency: string;
  duration?: string;
  instructions?: string;
  quantity?: number;
  unit?: string;
  confidence: number;
}

export interface ValidatePrescriptionRequest {
  validation_status: 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION';
  validation_notes: string;
}

export interface DispensePrescriptionRequest {
  medications: {
    medication_id: string;
    product_id: string;
    batch_id: string;
    quantity: number;
    unit_price: number;
  }[];
}