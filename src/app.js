const express = require('express');
const authorize = require('./middlewares/authorize');

const app = express();

app.use(express.json());

const donations = new Map();
let nextId = 1;

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

app.post('/donations/register', authorize('donor'), (req, res) => {
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

  if (expiration_date < todayUtc()) {
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

  donations.set(String(donation.id), { donation, donorId: req.user.id });
  res.status(201).json(donation);
});

app.get('/donations/available', authorize('clinic'), (req, res) => {
  const today = todayUtc();
  const available = Array.from(donations.values(), entry => entry.donation)
    .filter(donation => donation.status === 'available' && donation.expiration_date >= today);

  res.status(200).json(available);
});

app.put('/clinics/claim/:id', authorize('clinic'), (req, res) => {
  const entry = donations.get(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'Donation not found.' });
  }

  const { donation } = entry;
  if (entry.clinicId === req.user.id) {
    return res.status(200).json(donation);
  }

  if (donation.status !== 'available' || donation.expiration_date < todayUtc()) {
    return res.status(409).json({ error: 'Donation is no longer available.' });
  }

  entry.clinicId = req.user.id;
  donation.status = 'claimed';
  res.status(200).json(donation);
});

app.delete('/donations/:id', authorize('admin', 'donor'), (req, res) => {
  const entry = donations.get(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'Donation not found.' });
  }

  if (req.user.role === 'donor' && entry.donorId !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own donations.' });
  }

  donations.delete(req.params.id);
  res.status(204).end();
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});

module.exports = app;
