const express = require('express');
const authorize = require('./middlewares/authorize');

const app = express();

app.use(express.json());

const donations = new Map();
const claimsByDonationId = new Map();
let nextDonationId = 1;
let nextClaimId = 1;

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
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

  const donation = {
    id: nextDonationId++,
    donor_id: req.user.id,
    drug_name: drug_name.trim(),
    serial_number: serial_number.trim(),
    expiration_date,
    quantity,
    sealed: true,
    status: 'available',
  };

  donations.set(String(donation.id), donation);
  res.status(201).json(donation);
});

app.get('/donations/available', authorize('clinic'), (req, res) => {
  const today = todayUtc();
  const available = Array.from(donations.values())
    .filter(donation => donation.status === 'available' && donation.expiration_date >= today);

  res.status(200).json(available);
});

app.put('/clinics/claim/:id', authorize('clinic'), (req, res) => {
  const donation = donations.get(req.params.id);
  if (!donation) {
    return res.status(404).json({ error: 'Donation not found.' });
  }

  const existingClaim = claimsByDonationId.get(donation.id);
  if (existingClaim?.clinic_id === req.user.id) {
    return res.status(200).json({ ...donation, claim: existingClaim });
  }

  if (existingClaim || donation.expiration_date < todayUtc()) {
    return res.status(409).json({ error: 'Donation is no longer available.' });
  }

  const claim = {
    id: nextClaimId++,
    donation_id: donation.id,
    clinic_id: req.user.id,
    claimed_at: new Date().toISOString(),
    status: 'claimed',
  };
  claimsByDonationId.set(donation.id, claim);
  donation.status = 'claimed';
  res.status(200).json({ ...donation, claim });
});

app.delete('/donations/:id', authorize('admin', 'donor'), (req, res) => {
  const donation = donations.get(req.params.id);
  if (!donation) {
    return res.status(404).json({ error: 'Donation not found.' });
  }

  if (req.user.role === 'donor' && donation.donor_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own donations.' });
  }

  claimsByDonationId.delete(donation.id);
  donations.delete(req.params.id);
  res.status(204).end();
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});

module.exports = app;
