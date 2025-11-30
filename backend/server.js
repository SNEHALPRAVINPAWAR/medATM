require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors()); // Enable CORS for all origins (for development, restrict in production)
app.use(bodyParser.json()); // Parse JSON request bodies

// --- Database Connection ---
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            // useCreateIndex: true, // Not needed in Mongoose 6+
            // useFindAndModify: false // Not needed in Mongoose 6+
        });
        console.log('MongoDB Connected Successfully!');
    } catch (err) {
        console.error('MongoDB Connection Error:', err.message);
        process.exit(1); // Exit process with failure
    }
};

// Connect to the database
connectDB();

// --- Import Routes ---
const authRoutes = require('./routes/auth');
const esp32Routes = require('./routes/esp32');
const doctorRoutes = require('./routes/doctor');

// --- Use Routes ---
// Base paths for different route modules
app.use('/api/auth', authRoutes); // Authentication routes (signup, login)
app.use('/api/esp32', esp32Routes); // Routes for ESP32 data interaction
app.use('/api/doctor', doctorRoutes); // Routes for doctor dashboard actions (patient, diagnosis, history)

// --- Simple Root Route ---
app.get('/', (req, res) => {
    res.send('Smart Medical Kiosk Backend API is Running!');
});

// --- Error Handling Middleware (Optional but good practice) ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the API at: http://localhost:${PORT}`);
});