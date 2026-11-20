const { mkdirSync } = require('node:fs');
const { dirname, resolve } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { donors, clinics } = require('./users');

const defaultPath = resolve(__dirname, '../../data/medremedy.sqlite');

function transaction(database, work) {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    if (database.isTransaction) database.exec('ROLLBACK');
    throw error;
  }
}

function checkRetainedProfileEmails(profiles, storedProfiles) {
  const configuredEmails = new Set(Array.from(profiles.values(), profile => profile.email.toLowerCase()));
  for (const { id, email } of storedProfiles) {
    if (!profiles.has(id) && configuredEmails.has(email.toLowerCase())) {
      throw new Error('Configured donor or clinic email is already assigned to a different profile in SQLite.');
    }
  }
}

function initialize(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS donors (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE
    ) STRICT;

    CREATE TABLE IF NOT EXISTS clinics (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      is_verified INTEGER NOT NULL CHECK (is_verified IN (0, 1))
    ) STRICT;

    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_id INTEGER NOT NULL REFERENCES donors(id),
      drug_name TEXT NOT NULL,
      serial_number TEXT NOT NULL,
      expiration_date TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 2147483647),
      sealed INTEGER NOT NULL CHECK (sealed IN (0, 1)),
      status TEXT NOT NULL CHECK (status IN ('available', 'claimed'))
    ) STRICT;

    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donation_id INTEGER NOT NULL UNIQUE REFERENCES donations(id) ON DELETE CASCADE,
      clinic_id INTEGER NOT NULL REFERENCES clinics(id),
      claimed_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status = 'claimed')
    ) STRICT;
  `);

  checkRetainedProfileEmails(donors, database.prepare('SELECT id, email FROM donors').all());
  checkRetainedProfileEmails(clinics, database.prepare('SELECT id, email FROM clinics').all());

  const saveDonor = database.prepare(`
    INSERT INTO donors (id, name, email) VALUES (?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET name = excluded.name, email = excluded.email
  `);
  const saveClinic = database.prepare(`
    INSERT INTO clinics (id, name, address, email, is_verified) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET name = excluded.name, address = excluded.address,
      email = excluded.email, is_verified = excluded.is_verified
  `);

  for (const donor of donors.values()) {
    saveDonor.run(donor.id, donor.name, donor.email);
  }
  for (const clinic of clinics.values()) {
    saveClinic.run(clinic.id, clinic.name, clinic.address, clinic.email, Number(clinic.is_verified));
  }
}

function openDatabase(path = process.env.MEDREMEDY_DB_PATH ?? defaultPath) {
  if (path !== ':memory:') {
    path = resolve(path);
    mkdirSync(dirname(path), { recursive: true });
  }

  const database = new DatabaseSync(path, { enableForeignKeyConstraints: true });
  try {
    database.exec('PRAGMA busy_timeout = 5000');
    transaction(database, () => initialize(database));
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

module.exports = { openDatabase, transaction };
