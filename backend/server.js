// Import Express framework
const express = require('express');
// Import dotenv to read environment variables
require('dotenv').config();

// Initialize the Express application
const app = express();

// Set the port (Render or local port 5000)
const PORT = process.env.PORT || 5000;

// Middleware to let our server accept JSON data
app.use(express.json());

// A simple test route to check if the server is running
app.get('/', (req, res) => {
    res.json({ message: "Pocket Me backend is running successfully!" });
});

// Start the server and listen on the port
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});