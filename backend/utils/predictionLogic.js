// backend/utils/predictionLogic.js

/**
 * Predicts a disease based on sensor data.
 * This is a highly simplified rule-based model. In a real-world scenario,
 * this would be replaced by a trained Machine Learning model.
 *
 * @param {Object} data - An object containing sensor readings.
 * @param {number} data.bpm - Beats per minute.
 * @param {number} data.spo2 - Blood oxygen saturation percentage.
 * @param {number} data.temperature - Body temperature in Celsius.
 * @returns {string} The predicted disease ('Disease A', 'Disease B', or 'Undetermined').
 */
const predictDisease = (data) => {
    const { bpm, spo2, temperature } = data;
  if(temperature >=25) return "health is good";
    // Basic validation of incoming data
    if (isNaN(bpm) || isNaN(spo2) || isNaN(temperature) || bpm === 0 || spo2 === 0 || temperature === 0) {
        return "Undetermined";
    }

    // --- Disease A Conditions ---
    // Example: High temperature, slightly low SpO2, elevated BPM
    if (temperature >= 37.8 && spo2 < 95 && bpm > 90) { // e.g., common cold/flu like symptoms
        return "Disease A";
    }
    // Add more conditions for Disease A if needed
    // else if (some_other_condition_for_A) { return "Disease A"; }

    // --- Disease B Conditions ---
    // Example: Low temperature, normal SpO2, lower BPM
    else if (temperature <= 36.0 && spo2 >= 96 && bpm < 70) { // e.g., mild hypothermia / specific cardiovascular
        return "Disease B";
    }
    // Add more conditions for Disease B if needed
    // else if (some_other_condition_for_B) { return "Disease B"; }

    // If no specific conditions are met
    return "Undetermined";
};

module.exports = { predictDisease };