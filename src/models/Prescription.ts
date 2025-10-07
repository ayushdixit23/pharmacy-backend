import { Knex } from 'knex';

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

export interface PrescriptionAuditLog {
  id: string;
  prescription_id: string;
  action: string;
  description?: string;
  changes?: any;
  performed_by?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  updated_at: string;
}

export interface PrescriptionSale {
  id: string;
  prescription_id: string;
  sale_id: string;
  total_amount: number;
  created_by?: string;
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

export class PrescriptionModel {
  constructor(private db: Knex) {}

  async create(data: CreatePrescriptionRequest, uploadedBy: string): Promise<Prescription> {
    const prescriptionNumber = await this.generatePrescriptionNumber();
    
    // Extract medications from data to avoid inserting them into prescriptions table
    const { medications, ...prescriptionData } = data;
    
    const [prescription] = await this.db('prescriptions')
      .insert({
        id: this.generateId(),
        prescription_number: prescriptionNumber,
        ...prescriptionData,
        uploaded_by: uploadedBy,
        status: 'UPLOADED',
        validation_status: 'PENDING',
        is_active: true
      })
      .returning('*');

    // Create medications in separate table
    if (medications && medications.length > 0) {
      await this.createMedications(prescription.id, medications);
    }

    // Create audit log
    await this.createAuditLog(prescription.id, 'UPLOADED', 'Prescription uploaded', uploadedBy);

    return prescription;
  }

  async findById(id: string): Promise<Prescription | null> {
    const prescription = await this.db('prescriptions')
      .where({ id, is_active: true })
      .first();
    
    return prescription || null;
  }

  async findByPrescriptionNumber(prescriptionNumber: string): Promise<Prescription | null> {
    const prescription = await this.db('prescriptions')
      .where({ prescription_number: prescriptionNumber, is_active: true })
      .first();
    
    return prescription || null;
  }

  async findAll(filters: PrescriptionFilters = {}): Promise<{ prescriptions: Prescription[]; total: number }> {
    const query = this.db('prescriptions').where({ is_active: true });

    if (filters.status) {
      query.where({ status: filters.status });
    }

    if (filters.validation_status) {
      query.where({ validation_status: filters.validation_status });
    }

    if (filters.patient_name) {
      query.whereILike('patient_name', `%${filters.patient_name}%`);
    }

    if (filters.doctor_name) {
      query.whereILike('doctor_name', `%${filters.doctor_name}%`);
    }

    if (filters.uploaded_by) {
      query.where({ uploaded_by: filters.uploaded_by });
    }

    if (filters.date_from) {
      query.where('created_at', '>=', filters.date_from);
    }

    if (filters.date_to) {
      query.where('created_at', '<=', filters.date_to);
    }

    const total = await query.clone().count('* as count').first();
    const prescriptions = await query
      .orderBy('created_at', 'desc')
      .limit(filters.limit || 20)
      .offset(((filters.page || 1) - 1) * (filters.limit || 20));

    return {
      prescriptions,
      total: parseInt(total?.count as string) || 0
    };
  }

  async update(id: string, data: UpdatePrescriptionRequest, updatedBy: string): Promise<Prescription | null> {
    const [prescription] = await this.db('prescriptions')
      .where({ id, is_active: true })
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .returning('*');

    if (prescription) {
      await this.createAuditLog(id, 'UPDATED', 'Prescription updated', updatedBy);
    }

    return prescription || null;
  }

  async validate(id: string, validationStatus: 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION', 
                 notes: string, validatedBy: string): Promise<Prescription | null> {
    const [prescription] = await this.db('prescriptions')
      .where({ id, is_active: true })
      .update({
        validation_status: validationStatus,
        validation_notes: notes,
        validated_by: validatedBy,
        validated_at: new Date().toISOString(),
        status: validationStatus === 'APPROVED' ? 'VALIDATED' : 'PENDING_VALIDATION',
        updated_at: new Date().toISOString()
      })
      .returning('*');

    if (prescription) {
      await this.createAuditLog(id, 'VALIDATED', `Prescription ${validationStatus.toLowerCase()}`, validatedBy);
    }

    return prescription || null;
  }

  async dispense(id: string, dispensedBy: string): Promise<Prescription | null> {
    const [prescription] = await this.db('prescriptions')
      .where({ id, is_active: true })
      .update({
        status: 'DISPENSED',
        dispensed_by: dispensedBy,
        dispensed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .returning('*');

    if (prescription) {
      await this.createAuditLog(id, 'DISPENSED', 'Prescription dispensed', dispensedBy);
    }

    return prescription || null;
  }

  async reject(id: string, reason: string, rejectedBy: string): Promise<Prescription | null> {
    const [prescription] = await this.db('prescriptions')
      .where({ id, is_active: true })
      .update({
        status: 'REJECTED',
        validation_status: 'REJECTED',
        rejection_reason: reason,
        rejected_by: rejectedBy,
        rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .returning('*');

    if (prescription) {
      await this.createAuditLog(id, 'REJECTED', `Prescription rejected: ${reason}`, rejectedBy);
    }

    return prescription || null;
  }

  async getMedications(prescriptionId: string): Promise<PrescriptionMedication[]> {
    return this.db('prescription_medications')
      .where({ prescription_id: prescriptionId });
  }

  async createMedications(prescriptionId: string, medications: CreatePrescriptionMedicationRequest[]): Promise<void> {
    const medicationData = medications.map(med => ({
      id: this.generateId(),
      prescription_id: prescriptionId,
      ...med,
      is_dispensed: false
    }));

    await this.db('prescription_medications').insert(medicationData);
  }

  async getAuditLogs(prescriptionId: string): Promise<PrescriptionAuditLog[]> {
    return this.db('prescription_audit_logs')
      .where({ prescription_id: prescriptionId })
      .orderBy('created_at', 'desc');
  }

  async createAuditLog(prescriptionId: string, action: string, description: string, performedBy: string, 
                      changes?: any, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.db('prescription_audit_logs').insert({
      id: this.generateId(),
      prescription_id: prescriptionId,
      action,
      description,
      changes,
      performed_by: performedBy,
      ip_address: ipAddress,
      user_agent: userAgent
    });
  }

  async linkToSale(prescriptionId: string, saleId: string, totalAmount: number, createdBy: string): Promise<PrescriptionSale> {
    const [saleLink] = await this.db('prescription_sales')
      .insert({
        id: this.generateId(),
        prescription_id: prescriptionId,
        sale_id: saleId,
        total_amount: totalAmount,
        created_by: createdBy
      })
      .returning('*');

    return saleLink;
  }

  private async generatePrescriptionNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    const prefix = `RX${year}${month}${day}`;
    
    const lastPrescription = await this.db('prescriptions')
      .where('prescription_number', 'like', `${prefix}%`)
      .orderBy('prescription_number', 'desc')
      .first();

    let sequence = 1;
    if (lastPrescription) {
      const lastSequence = parseInt(lastPrescription.prescription_number.replace(prefix, ''));
      sequence = lastSequence + 1;
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }
}
