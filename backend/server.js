const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
}));
app.use(express.json());

// Routes
app.use('/api/agents', require('./routes/agents'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/sites', require('./routes/sites'));
app.use('/api/shifts', require('./routes/shifts'));
app.use('/api/absences', require('./routes/absences'));
app.use('/api/quotes', require('./routes/quotes'));
app.use('/api/pdf', require('./routes/pdf'));
app.use('/api/email', require('./routes/email'));
app.use('/api/settings', require('./routes/settings'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`SecuritySaaS API running on http://localhost:${PORT}`);
});
