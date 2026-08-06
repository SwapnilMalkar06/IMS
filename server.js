const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/apiRoutes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve Static Frontend Assets
app.use(express.static(path.join(__dirname, 'public')));

// Mount Phase 2 REST API Routes
app.use('/api', apiRoutes);

// Fallback route for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express Server
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Inventory Management System Server Running!`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`⚙️ Phase 2: REST API & FEFO Logic Active`);
    console.log(`====================================================`);
});
