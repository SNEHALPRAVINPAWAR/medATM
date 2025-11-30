const express = require('express');
const router = express.Router();
const { protect, doctor } = require('../utils/authMiddleware'); // Make sure this path is correct
const Patient = require('../models/Patient'); // Assuming you have a Patient model
const Diagnosis = require('../models/Diagnosis'); // Assuming you have a Diagnosis model

// @route   POST /api/doctor/patient/start
// @desc    Doctor initiates a new patient session and links to a kiosk
// @access  Private (Doctor)
router.post('/patient/start', protect, doctor, async (req, res) => {
    const { name, age, phoneNumber, kioskId } = req.body;
    const doctorId = req.user.id; // From authMiddleware

    if (!name || !age || !kioskId) {
        return res.status(400).json({ message: 'Patient name, age, and kiosk ID are required' });
    }

    try {
        // Deactivate any previous active sessions for this kiosk or doctor (optional, but good for cleanup)
        await Patient.updateMany({ kioskId: kioskId, isActive: true }, { $set: { isActive: false } });
        await Diagnosis.updateMany(
            { kioskId: kioskId, status: { $in: ['collecting_data', 'prediction_made', 'pending_approval'] } },
            { $set: { status: 'completed' } } // Mark as completed if left hanging
        );

        // Create new patient record
        const patient = new Patient({
            name,
            age,
            phoneNumber,
            doctorId,
            kioskId,
            isActive: true
        });
        await patient.save();

        // Create an initial diagnosis record for data collection
        const diagnosis = new Diagnosis({
            patientId: patient._id,
            doctorId: doctorId,
            kioskId: kioskId,
            status: 'collecting_data',
            predictedDisease: 'N/A'
        });
        await diagnosis.save();


        res.status(201).json({
            message: 'Patient session started successfully',
            patientId: patient._id,
            diagnosisId: diagnosis._id,
            kioskId: kioskId
        });

    } catch (err) {
        console.error('Start Patient Session Error:', err.message);
        res.status(500).json({ message: 'Server error starting patient session' });
    }
});

// @route   GET /api/doctor/patient/:diagnosisId/live_data
// @desc    Get live sensor data and current prediction for an active patient session
// @access  Private (Doctor)
router.get('/patient/:diagnosisId/live_data', protect, doctor, async (req, res) => {
    const { diagnosisId } = req.params;
    const doctorId = req.user.id;

    try {
        const diagnosis = await Diagnosis.findOne({
            _id: diagnosisId,
            doctorId: doctorId,
            status: { $in: ['collecting_data', 'prediction_made', 'pending_approval'] }
        }).populate('patientId', 'name age phoneNumber'); // Populate patient details

        if (!diagnosis) {
            return res.status(404).json({ message: 'Active diagnosis session not found or already completed.' });
        }

        // Get the latest sensor data point
        const latestSensorData = diagnosis.sensorData.length > 0
            ? diagnosis.sensorData[diagnosis.sensorData.length - 1]
            : { bpm: 0, spo2: 0, temperature: 0 }; // Default if no data yet

        res.status(200).json({
            patient: diagnosis.patientId,
            kioskId: diagnosis.kioskId,
            latestData: latestSensorData,
            predictedDisease: diagnosis.predictedDisease,
            status: diagnosis.status,
            diagnosisId: diagnosis._id
        });

    } catch (err) {
        console.error('Get Live Data Error:', err.message);
        res.status(500).json({ message: 'Server error fetching live data' });
    }
});

// @route   POST /api/doctor/diagnosis/approve
// @desc    Doctor approves a predicted diagnosis, setting motor command
// @access  Private (Doctor)
router.post('/diagnosis/approve', protect, doctor, async (req, res) => {
    const { diagnosisId, approvedDisease } = req.body;
    const doctorId = req.user.id;

    if (!diagnosisId || !approvedDisease) {
        return res.status(400).json({ message: 'Diagnosis ID and approved disease are required.' });
    }

    try {
        const diagnosis = await Diagnosis.findOne({ _id: diagnosisId, doctorId: doctorId });

        if (!diagnosis) {
            return res.status(404).json({ message: 'Diagnosis record not found or unauthorized.' });
        }
        if (diagnosis.status === 'approved' || diagnosis.status === 'medication_dispensed') {
             return res.status(400).json({ message: 'Diagnosis already approved or dispensed.' });
        }

        diagnosis.approvedDisease = approvedDisease;
        diagnosis.status = 'approved';

        // Set the motor command based on approved disease
        if (approvedDisease === 'Disease A') {
            diagnosis.motorCommand = 'activate_motor_1';
        } else if (approvedDisease === 'Disease B') {
            diagnosis.motorCommand = 'activate_motor_2';
        } else {
            diagnosis.motorCommand = 'none'; // No specific medication for undetermined/other
        }

        await diagnosis.save();

        // Also deactivate the patient's active session for this kiosk after approval
        await Patient.updateOne({ _id: diagnosis.patientId }, { $set: { isActive: false } });


        res.status(200).json({
            message: `Diagnosis "${approvedDisease}" approved. Motor command set for kiosk.`,
            diagnosisId: diagnosis._id,
            motorCommand: diagnosis.motorCommand
        });

    } catch (err) {
        console.error('Approve Diagnosis Error:', err.message);
        res.status(500).json({ message: 'Server error approving diagnosis' });
    }
});

// @route   GET /api/doctor/history
// @desc    Get all diagnosis history for the logged-in doctor, with optional search
// @access  Private (Doctor)
router.get('/history', protect, doctor, async (req, res) => {
    const doctorId = req.user.id;
    const { search } = req.query; // Get the search query from URL parameters

    try {
        let query = { doctorId: doctorId }; // Base query: filter by logged-in doctor

        if (search) {
            const searchRegex = new RegExp(search, 'i'); // Case-insensitive search
            query.$or = [
                // Search in patient's name (requires population)
                { 'patientId.name': searchRegex },
                { kioskId: searchRegex },
                { predictedDisease: searchRegex },
                { approvedDisease: searchRegex },
                { status: searchRegex },
            ];
        }

        // Fetch all diagnosis records for this doctor, populating patient details
        // and applying search filter if present
        const history = await Diagnosis.find(query)
                                      .populate('patientId', 'name age phoneNumber') // Get patient details
                                      .sort({ createdAt: -1 }); // Sort by newest first

        res.status(200).json(history);

    } catch (err) {
        console.error('Get History Error:', err.message);
        res.status(500).json({ message: 'Server error fetching history' });
    }
});

// @route   DELETE /api/doctor/history/:id
// @desc    Delete a specific diagnosis history record for the logged-in doctor
// @access  Private (Doctor)
router.delete('/history/:id', protect, doctor, async (req, res) => {
    const { id } = req.params; // Get the diagnosis ID from URL parameters
    const doctorId = req.user.id; // Get doctor ID from authenticated user

    try {
        // Find and delete the diagnosis record.
        // Important: Ensure the record belongs to the authenticated doctor.
        const deletedDiagnosis = await Diagnosis.findOneAndDelete({ _id: id, doctorId: doctorId });

        if (!deletedDiagnosis) {
            // If no record was found or the doctor isn't authorized to delete it
            return res.status(404).json({ message: 'Diagnosis record not found or unauthorized to delete.' });
        }

        res.status(200).json({ message: 'Diagnosis record deleted successfully.' });

    } catch (err) {
        console.error('Delete History Record Error:', err.message);
        // Handle CastError if ID format is invalid
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid diagnosis ID format.' });
        }
        res.status(500).json({ message: 'Server error deleting history record.' });
    }
});


module.exports = router;