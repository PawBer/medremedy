const express = require('express');
const authorize = require('./middlewares/authorize');
const donations = require('./models/donations');

const app = express();

app.use(express.json());

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function donationId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 && String(id) === value ? id : null;
}

app.post('/donations/register', authorize('donor'), (req, res) => {
  const { drug_name, serial_number, expiration_date, quantity = 1 } = req.body || {};

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

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647) {
    return res.status(400).json({ error: 'quantity must be a positive 32-bit integer.' });
  }

  const donation = donations.register(
    req.user.id,
    drug_name.trim(),
    serial_number.trim(),
    expiration_date,
    quantity,
  );
  res.status(201).json(donation);
});

app.get('/donations/available', authorize('clinic'), (req, res) => {
  res.status(200).json(donations.listAvailable(todayUtc()));
});

app.put('/clinics/claim/:id', authorize('clinic'), (req, res) => {
  const result = donations.claim(donationId(req.params.id), req.user.id, new Date().toISOString());
  if (result.error === 'not-found') {
    return res.status(404).json({ error: 'Donation not found.' });
  }
  if (result.error === 'unavailable') {
    return res.status(409).json({ error: 'Donation is no longer available.' });
  }
  res.status(200).json(result.donation);
});

app.delete('/donations/:id', authorize('admin', 'donor'), (req, res) => {
  const error = donations.remove(donationId(req.params.id), req.user);
  if (error === 'not-found') {
    return res.status(404).json({ error: 'Donation not found.' });
  }
  if (error === 'forbidden') {
    return res.status(403).json({ error: 'You can only delete your own donations.' });
  }
  res.status(204).end();
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});

module.exports = app;
