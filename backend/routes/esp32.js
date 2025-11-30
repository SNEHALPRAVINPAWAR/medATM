const express = require('express');
const router = express.Router();
const Diagnosis = require('../models/Diagnosis');
const Patient = require('../models/Patient');
const { predictDisease } = require('../utils/predictionLogic');

// @route   POST /api/esp32/data_upload
// @desc    Receive sensor data from ESP32, update diagnosis, and predict disease
// @access  Public (ESP32 has no authentication for simplicity in this project)
router.post('/data_upload', async (req, res) => {
    const { bpm, spo2, temperature, kioskId } = req.body;

    if (!kioskId || isNaN(bpm) || isNaN(spo2) || isNaN(temperature)) {
        return res.status(400).json({ message: 'Invalid sensor data or missing kioskId' });
    }

    try {
        // Find the active patient session for this kiosk
        // This assumes a patient session is initiated by a doctor on the dashboard
        // and a kioskId is assigned to it.
        let activePatient = await Patient.findOne({ kioskId, isActive: true });

        if (!activePatient) {
            // If no active patient, maybe store as a general kiosk log or error
            console.warn(`Data received from unassigned kioskId: ${kioskId}`);
            return res.status(404).json({ message: 'No active patient session found for this kiosk.' });
        }

        // Find or create a Diagnosis record for this active patient
        // We'll consider a single `Diagnosis` entry for one patient's session.
        let diagnosisRecord = await Diagnosis.findOne({
            patientId: activePatient._id,
            kioskId: kioskId,
            status: { $in: ['collecting_data', 'prediction_made', 'pending_approval'] } // Only update if not yet completed
        }).sort({ createdAt: -1 }); // Get the latest one if multiple exist

        if (!diagnosisRecord) {
            // This should ideally not happen if Patient.isActive implies a Diagnosis record exists
            // But as a fallback, create a new one (though it implies an issue in workflow)
             console.warn(`No ongoing diagnosis record found for active patient ${activePatient._id}. Creating new.`);
            diagnosisRecord = new Diagnosis({
                patientId: activePatient._id,
                doctorId: activePatient.doctorId,
                kioskId: kioskId,
                status: 'collecting_data'
            });
        }

        // Add the current sensor data to the array
        diagnosisRecord.sensorData.push({ bpm, spo2, temperature });

        // Predict disease based on the latest data (or averaged data if you modify predictDisease)
        const prediction = predictDisease({ bpm, spo2, temperature });
        diagnosisRecord.predictedDisease = prediction;

        // Update status if it moves from collecting to prediction_made
        if (diagnosisRecord.status === 'collecting_data' && prediction !== 'Undetermined') {
            diagnosisRecord.status = 'prediction_made';
        }
        if (diagnosisRecord.status === 'prediction_made' && prediction !== 'Undetermined') {
            diagnosisRecord.status = 'pending_approval'; // Ready for doctor review
        }


        await diagnosisRecord.save();

        res.status(200).json({
            message: 'Sensor data received and diagnosis updated',
            currentPrediction: prediction
        });

    } catch (err) {
        console.error('Data Upload Error:', err.message);
        res.status(500).json({ message: 'Server error processing sensor data' });
    }
});


// @route   GET /api/esp32/get_motor_command?kioskId=ESP32_Kiosk_001
// @desc    ESP32 polls this endpoint to get pending motor commands
// @access  Public (ESP32)
router.get('/get_motor_command', async (req, res) => {
    const { kioskId } = req.query; // Get kioskId from query parameters
  
    if (!kioskId) {
        return res.status(400).json({ message: 'kioskId is required' });
    }

    try {
        // Find the latest approved diagnosis for this kiosk that hasn't had its command executed
        const diagnosis = await Diagnosis.findOne({
            kioskId: kioskId,
            commandExecuted: false,
            status: 'approved', // Only send command if doctor approved
            motorCommand: { $ne: 'none' } // And there's an actual command
        }).sort({ createdAt: -1 }); // Get the most recent one

        if (diagnosis) {
            // Send the command
            console.log(`Kiosk ${kioskId} requested command. No pending command.`);
            res.status(200).json({ command: diagnosis.motorCommand });
        } else {
            console.log(`Kiosk ${kioskId} requested command. No pending command.`);
            res.status(200).json({ command: 'none' }); // No command pending
        }

    } catch (err) {
        console.error('Get Motor Command Error:', err.message);
        res.status(500).json({ message: 'Server error checking motor command' });
    }
});


// @route   POST /api/esp32/command_executed
// @desc    ESP32 confirms motor command execution
// @access  Public (ESP32)
router.post('/command_executed', async (req, res) => {
    const { kioskId, status } = req.body; // Status might be "motor_1_activated" etc.

    if (!kioskId || !status) {
        return res.status(400).json({ message: 'kioskId and status are required' });
    }

    try {
        // Find the diagnosis record that corresponds to the executed command
        // This is a bit tricky, ideally you'd send a diagnosis ID from ESP32
        // For simplicity, we'll find the latest 'approved' diagnosis for this kiosk
        const diagnosis = await Diagnosis.findOne({
            kioskId: kioskId,
            status: 'approved',
            commandExecuted: false, // Find the one pending execution
            motorCommand: { $ne: 'none' } // Ensure it had a command
        }).sort({ createdAt: -1 });

        if (diagnosis) {
            console.log(`Kiosk ${kioskId} confirmed execution of command for diagnosis ${diagnosis._id}. Status: ${status}`);
            diagnosis.commandExecuted = true;
            diagnosis.status = 'medication_dispensed'; // Update status to reflect dispensing
            await diagnosis.save();
            return res.status(200).json({ message: 'Motor command execution confirmed.', diagnosisId: diagnosis._id });
        } else {
            console.warn(`Kiosk ${kioskId} sent execution confirmation, but no pending diagnosis found.`);
            console.warn(`No pending approved diagnosis found for kiosk ${kioskId} to confirm.`);
            return res.status(404).json({ message: 'No pending approved diagnosis found for this kiosk.' });
        }

    } catch (err) {
        console.error('Command Executed Confirmation Error:', err.message);
        res.status(500).json({ message: 'Server error confirming command execution' });
    }
});

module.exports = router;