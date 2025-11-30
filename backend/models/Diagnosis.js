const mongoose = require('mongoose');

const DiagnosisSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true
    },
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    kioskId: { // The kiosk that sent the data
        type: String,
        required: true
    },
    sensorData: [{ // Array to store multiple sensor readings over time for a single session
        timestamp: { type: Date, default: Date.now },
        bpm: { type: Number, default: 0 },
        spo2: { type: Number, default: 0 },
        temperature: { type: Number, default: 0 }
    }],
    predictedDisease: {
        type: String,
        enum: ['Disease A', 'Disease B', 'Undetermined', 'N/A'], // Add N/A for cases where no prediction yet
        default: 'N/A'
    },
    approvedDisease: { // What the doctor actually approved
        type: String,
        enum: ['Disease A', 'Disease B', 'Undetermined', 'N/A'],
        default: 'N/A'
    },
    status: { // e.g., 'pending_doctor_review', 'approved', 'declined', 'medication_dispensed'
        type: String,
        enum: ['collecting_data', 'prediction_made', 'pending_approval', 'approved', 'declined', 'medication_dispensed', 'completed'],
        default: 'collecting_data'
    },
    motorCommand: { // Command to be sent to ESP32 (e.g., 'activate_motor_1')
        type: String,
        default: 'none' // 'none', 'activate_motor_1', 'activate_motor_2'
    },
    commandExecuted: { // Flag to confirm ESP32 executed the command
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update `updatedAt` field on save
DiagnosisSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Diagnosis', DiagnosisSchema);