const { openDatabase, transaction } = require('../config/database');

const database = openDatabase();

const insertDonation = database.prepare(`
  INSERT INTO donations (donor_id, drug_name, serial_number, expiration_date, quantity, sealed, status)
  VALUES (?, ?, ?, ?, ?, 1, 'available') RETURNING *
`);
const selectAvailable = database.prepare(`
  SELECT * FROM donations WHERE status = 'available' AND expiration_date >= ? ORDER BY id
`);
const selectDonation = database.prepare('SELECT * FROM donations WHERE id = ?');
const selectClaim = database.prepare('SELECT * FROM claims WHERE donation_id = ?');
const insertClaim = database.prepare(`
  INSERT INTO claims (donation_id, clinic_id, claimed_at, status)
  VALUES (?, ?, ?, 'claimed') RETURNING *
`);
const markClaimed = database.prepare("UPDATE donations SET status = 'claimed' WHERE id = ? RETURNING *");
const deleteDonation = database.prepare('DELETE FROM donations WHERE id = ?');

function serializeDonation(row) {
  return { ...row, sealed: Boolean(row.sealed) };
}

function register(donorId, drugName, serialNumber, expirationDate, quantity) {
  return serializeDonation(insertDonation.get(donorId, drugName, serialNumber, expirationDate, quantity));
}

function listAvailable(today) {
  return selectAvailable.all(today).map(serializeDonation);
}

function claim(id, clinicId, claimedAt) {
  return transaction(database, () => {
    const donation = selectDonation.get(id);
    if (!donation) return { error: 'not-found' };

    const existingClaim = selectClaim.get(id);
    if (existingClaim?.clinic_id === clinicId) {
      return { donation: { ...serializeDonation(donation), claim: existingClaim } };
    }
    if (existingClaim || donation.expiration_date < claimedAt.slice(0, 10)) {
      return { error: 'unavailable' };
    }

    const newClaim = insertClaim.get(id, clinicId, claimedAt);
    return { donation: { ...serializeDonation(markClaimed.get(id)), claim: newClaim } };
  });
}

function remove(id, user) {
  return transaction(database, () => {
    const donation = selectDonation.get(id);
    if (!donation) return 'not-found';
    if (user.role === 'donor' && donation.donor_id !== user.id) return 'forbidden';

    deleteDonation.run(id);
  });
}

module.exports = { register, listAvailable, claim, remove };
