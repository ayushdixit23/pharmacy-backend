import { OCRResult, ExtractedMedication } from '../types.js';
import StockManagementService from './StockManagementService.js';
import Product from '../models/Product.js';
import { PrescriptionModel } from '../models/Prescription.js';

export class PrescriptionService {
  constructor(
    public prescriptionModel: PrescriptionModel,
    private productModel: Product,
    private stockService: StockManagementService
  ) {}

  /**
   * Process prescription file with OCR
   */
  async processPrescriptionWithOCR(fileUrl: string, fileType: 'IMAGE' | 'PDF' | 'SCANNED'): Promise<OCRResult> {
    try {
      // Simulate OCR processing - in real implementation, integrate with OCR service
      const ocrResult = await this.performOCR(fileUrl, fileType);
      
      // Extract structured data from OCR text
      const extractedData = this.extractPrescriptionData(ocrResult.text);
      
      return {
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        medications: extractedData.medications,
        patient_info: extractedData.patient_info,
        doctor_info: extractedData.doctor_info
      };
    } catch (error) {
      throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate prescription data
   */
  async validatePrescription(prescriptionId: string, validationData: {
    validation_status: 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION';
    validation_notes: string;
    validatedBy: string;
  }): Promise<any> {
    const prescription = await this.prescriptionModel.findById(prescriptionId);
    if (!prescription) {
      throw new Error('Prescription not found');
    }

    if (prescription.status !== 'PENDING_VALIDATION') {
      throw new Error('Prescription is not in pending validation status');
    }

    return await this.prescriptionModel.validate(
      prescriptionId,
      validationData.validation_status,
      validationData.validation_notes,
      validationData.validatedBy
    );
  }

  /**
   * Dispense prescription medications
   */
  async dispensePrescription(prescriptionId: string, dispenseData: {
    medications: {
      medication_id: string;
      product_id: string;
      batch_id: string;
      quantity: number;
      unit_price: number;
    }[];
    dispensedBy: string;
  }): Promise<any> {
    const prescription = await this.prescriptionModel.findById(prescriptionId);
    if (!prescription) {
      throw new Error('Prescription not found');
    }

    if (prescription.status !== 'VALIDATED') {
      throw new Error('Prescription must be validated before dispensing');
    }

    // Check stock availability for each medication
    for (const med of dispenseData.medications) {
      const stockAvailable = await StockManagementService.checkStockAvailability(med.product_id, med.batch_id, med.quantity);
      if (!stockAvailable) {
        throw new Error(`Insufficient stock for medication ${med.product_id}`);
      }
    }

    // Update stock movements
    for (const med of dispenseData.medications) {
      await StockManagementService.createStockMovement({
        product_id: med.product_id,
        batch_id: med.batch_id,
        movement_type: 'OUT',
        quantity: med.quantity,
        reason: `Prescription dispensed - ${prescription.prescription_number}`,
        reference_id: prescriptionId,
        reference_type: 'PRESCRIPTION'
      });
    }

    // Update prescription medications with dispensed info
    for (const med of dispenseData.medications) {
      await this.prescriptionModel.updateMedication(med.medication_id, {
        product_id: med.product_id,
        batch_id: med.batch_id,
        unit_price: med.unit_price,
        total_price: med.quantity * med.unit_price,
        is_dispensed: true,
        dispensed_by: dispenseData.dispensedBy,
        dispensed_at: new Date().toISOString()
      });
    }

    // Update prescription status
    return await this.prescriptionModel.dispense(prescriptionId, dispenseData.dispensedBy);
  }

  /**
   * Link prescription to sale
   */
  async linkPrescriptionToSale(prescriptionId: string, saleId: string, totalAmount: number, createdBy: string): Promise<any> {
    const prescription = await this.prescriptionModel.findById(prescriptionId);
    if (!prescription) {
      throw new Error('Prescription not found');
    }

    if (prescription.status !== 'DISPENSED') {
      throw new Error('Prescription must be dispensed before linking to sale');
    }

    return await this.prescriptionModel.linkToSale(prescriptionId, saleId, totalAmount, createdBy);
  }

  /**
   * Get prescription statistics
   */
  async getPrescriptionStats(filters: any = {}): Promise<any> {
    const stats = await this.prescriptionModel.getStats(filters);
    return stats;
  }

  /**
   * Search for products to match with prescription medications
   */
  async searchProductsForMedication(medicationName: string, dosage?: string): Promise<any[]> {
    const products = await Product.search({
      search: medicationName,
      category: 'PRESCRIPTION',
      limit: 10
    });

    return products.products.map((product: any) => ({
      id: product.id,
      name: product.name,
      generic_name: product.generic_name,
      dosage: dosage,
      unit_price: product.selling_price,
      stock_available: true // This would be calculated from actual stock
    }));
  }

  /**
   * Private method to perform OCR (simulated)
   */
  private async performOCR(fileUrl: string, fileType: 'IMAGE' | 'PDF' | 'SCANNED'): Promise<{ text: string; confidence: number }> {
    // In a real implementation, this would integrate with OCR services like:
    // - Google Cloud Vision API
    // - AWS Textract
    // - Azure Computer Vision
    // - Tesseract.js for local processing
    
    // Simulated OCR result
    const mockOCRText = `
      Dr. John Smith
      Medical License: MD12345
      Specialty: Internal Medicine
      Phone: (555) 123-4567
      
      Patient: Jane Doe
      DOB: 01/15/1985
      Phone: (555) 987-6543
      Address: 123 Main St, City, State 12345
      
      Prescription:
      1. Lisinopril 10mg - Take 1 tablet daily
      2. Metformin 500mg - Take 1 tablet twice daily with meals
      3. Aspirin 81mg - Take 1 tablet daily
      
      Duration: 30 days
      Refills: 2
    `;

    return {
      text: mockOCRText,
      confidence: 0.85
    };
  }

  /**
   * Private method to extract structured data from OCR text
   */
  private extractPrescriptionData(text: string): {
    medications: ExtractedMedication[];
    patient_info: any;
    doctor_info: any;
  } {
    // This is a simplified extraction - in real implementation, use NLP libraries
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    const medications: ExtractedMedication[] = [];
    const patient_info: any = {};
    const doctor_info: any = {};

    // Extract doctor information
    const doctorMatch = text.match(/Dr\.\s+([^\n]+)/);
    if (doctorMatch) {
      doctor_info.name = doctorMatch[1];
    }

    const licenseMatch = text.match(/License:\s*([^\n]+)/);
    if (licenseMatch) {
      doctor_info.license = licenseMatch[1];
    }

    // Extract patient information
    const patientMatch = text.match(/Patient:\s*([^\n]+)/);
    if (patientMatch) {
      patient_info.name = patientMatch[1];
    }

    const dobMatch = text.match(/DOB:\s*([^\n]+)/);
    if (dobMatch) {
      patient_info.dob = dobMatch[1];
    }

    // Extract medications (simplified)
    const medicationLines = lines.filter(line => 
      line.includes('mg') || line.includes('tablet') || line.includes('capsule')
    );

    medicationLines.forEach((line, index) => {
      const parts = line.split(' - ');
      if (parts.length >= 2) {
        const medicationName = parts[0].trim();
        const instructions = parts[1].trim();
        
        medications.push({
          name: medicationName,
          dosage: this.extractDosage(medicationName),
          frequency: this.extractFrequency(instructions),
          duration: '30 days',
          instructions: instructions,
          quantity: 30,
          unit: 'tablets',
          confidence: 0.8
        });
      }
    });

    return {
      medications,
      patient_info,
      doctor_info
    };
  }

  private extractDosage(medicationName: string): string {
    const dosageMatch = medicationName.match(/(\d+mg)/);
    return dosageMatch ? dosageMatch[1] : '';
  }

  private extractFrequency(instructions: string): string {
    if (instructions.includes('daily')) return 'Once daily';
    if (instructions.includes('twice')) return 'Twice daily';
    if (instructions.includes('three times')) return 'Three times daily';
    return 'As directed';
  }
}
