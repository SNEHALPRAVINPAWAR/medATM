const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For password hashing

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/.+@.+\..+/, 'Please fill a valid email address'] // Basic email validation
    },
    password: {
        type: String,
        required: true
    },
    role: { // To differentiate between doctor, admin, etc. (for future expansion)
        type: String,
        enum: ['doctor', 'admin'],
        default: 'doctor'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Pre-save hook to hash password before saving a new user
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) { // Only hash if the password has been modified (or is new)
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Method to compare entered password with hashed password
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);