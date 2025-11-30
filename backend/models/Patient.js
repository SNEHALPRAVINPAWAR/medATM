const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    age: {
        type: Number,
        required: true,
        min: 0
    },
    phoneNumber: {
        type: String,
        trim: true,
        // Basic regex for phone number validation (optional)
        match: [/^\+?\d{1,3}?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/, 'Please fill a valid phone number']
    },
    doctorId: { // Links patient to the doctor who initiated the check
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    kioskId: { // To link to a specific ESP32 kiosk for live data
        type: String,
        trim: true,
        required: false // Not always required if patient data is just stored
    },
    isActive: { // A flag to denote if this patient is currently being monitored by a kiosk
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Patient', PatientSchema);