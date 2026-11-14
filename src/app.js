const express = require('express');

const app = express();

app.use(express.json());

const donations = [];
let nextId = 1;

app.post('/donations/register', (req, res) => {
  const { drug_name, serial_number, expiration_date } = req.body || {};

  if (typeof drug_name !== 'string' || !drug_name.trim() ||
      typeof serial_number !== 'string' || !serial_number.trim()) {
    return res.status(400).json({ error: 'drug_name and serial_number are required.' });
  }

  if (typeof expiration_date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(expiration_date)) {
    return res.status(400).json({ error: 'expiration_date must use YYYY-MM-DD format.' });
  }

  const expiration = new Date(expiration_date);
  if (Number.isNaN(expiration.getTime()) ||
      expiration.toISOString().slice(0, 10) !== expiration_date) {
    return res.status(400).json({ error: 'expiration_date must be a valid date.' });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (expiration_date < today) {
    return res.status(400).json({ error: 'Medication has already expired.' });
  }

  const donation = {
    id: nextId++,
    drug_name: drug_name.trim(),
    serial_number: serial_number.trim(),
    expiration_date,
    sealed: true,
    status: 'available',
  };

  donations.push(donation);
  res.status(201).json(donation);
});

app.get('/donations/available', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const available = donations.filter(donation =>
    donation.status === 'available' && donation.expiration_date >= today
  );

  res.status(200).json(available);
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});

module.exports = app;
