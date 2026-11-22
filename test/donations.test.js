const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { copyFile, mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { after, before, test } = require('node:test');

const users = [
  { id: 1, role: 'donor', token: 'donor-one', name: 'First donor', email: 'donor-one@example.com' },
  { id: 2, role: 'donor', token: 'donor-two', name: 'Second donor', email: 'donor-two@example.com' },
  {
    id: 1, role: 'clinic', token: 'clinic-one', name: 'First clinic',
    email: 'clinic-one@example.com', address: '1 Example Street', is_verified: true,
  },
  {
    id: 2, role: 'clinic', token: 'clinic-two', name: 'Second clinic',
    email: 'clinic-two@example.com', address: '2 Example Street', is_verified: false,
  },
  { id: 'admin-1', role: 'admin', token: 'admin-one' },
];

let server;
let baseUrl;

before(async () => {
  process.env.MEDREMEDY_USERS = JSON.stringify(users);
  process.env.MEDREMEDY_DB_PATH = ':memory:';
  const app = require('../src/app');
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise(resolve => server.close(resolve));
  }
});

function request(method, path, token, body, url = baseUrl) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  return fetch(`${url}${path}`, { method, headers, body: JSON.stringify(body) });
}

function register(token, expiration_date = '2099-12-31', fields = {}) {
  return request('POST', '/donations/register', token, {
    drug_name: 'Example medication',
    serial_number: 'ABC123',
    expiration_date,
    ...fields,
  });
}

test('only donors can register and only clinics can list or claim donations', async () => {
  assert.equal((await register()).status, 401);
  assert.equal((await register('invalid-token')).status, 401);
  assert.equal((await register('clinic-one')).status, 403);
  assert.equal((await register('admin-one')).status, 403);
  assert.equal((await request('GET', '/donations/available', 'donor-one')).status, 403);
  assert.equal((await request('GET', '/donations/available', 'admin-one')).status, 403);
  assert.equal((await request('PUT', '/clinics/claim/1', 'donor-one')).status, 403);
  assert.equal((await request('PUT', '/clinics/claim/1', 'admin-one')).status, 403);
  assert.equal((await request('PUT', '/clinics/claim/abc', 'clinic-one')).status, 404);
  assert.equal((await request('DELETE', '/donations/abc', 'admin-one')).status, 404);
});

test('a donation can be claimed by one clinic and disappears from the available list', async t => {
  const claimedAt = '2030-01-01T12:00:00.000Z';
  t.mock.timers.enable({ apis: ['Date'], now: new Date(claimedAt) });
  const registration = await register('donor-one');
  assert.equal(registration.status, 201);
  const donation = await registration.json();
  assert.equal(donation.quantity, 1);
  const available = await request('GET', '/donations/available', 'clinic-one');
  assert.equal(available.status, 200);
  assert.ok((await available.json()).some(item => item.id === donation.id));

  const claimPath = `/clinics/claim/${donation.id}`;
  const clinics = users.filter(user => user.role === 'clinic');
  const claims = await Promise.all(clinics.map(clinic => request('PUT', claimPath, clinic.token)));
  assert.deepEqual(claims.map(claim => claim.status).sort(), [200, 409]);
  const winner = claims.findIndex(claim => claim.status === 200);
  const claimedDonation = await claims[winner].json();
  const { claim, ...claimedFields } = claimedDonation;
  assert.deepEqual(claimedFields, { ...donation, status: 'claimed' });
  assert.deepEqual(claim, {
    id: claim.id,
    donation_id: donation.id,
    clinic_id: clinics[winner].id,
    claimed_at: claimedAt,
    status: 'claimed',
  });
  assert.ok(Number.isInteger(claim.id));

  t.mock.timers.tick(1000);
  const retry = await request('PUT', claimPath, clinics[winner].token);
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), claimedDonation);

  const remaining = await request('GET', '/donations/available', 'clinic-two');
  assert.ok(!(await remaining.json()).some(item => item.id === donation.id));
});

test('registration stores quantity and uses the authenticated donor as the owner', async () => {
  for (const quantity of [0, -1, 1.5, '3', null, 2147483648]) {
    assert.equal((await register('donor-one', undefined, { quantity })).status, 400);
  }

  const registration = await register('donor-one', undefined, { quantity: 3, donor_id: 2 });
  assert.equal(registration.status, 201);
  const donation = await registration.json();
  assert.ok(Number.isInteger(donation.id));
  assert.deepEqual(donation, {
    id: donation.id,
    donor_id: 1,
    drug_name: 'Example medication',
    serial_number: 'ABC123',
    expiration_date: '2099-12-31',
    quantity: 3,
    sealed: true,
    status: 'available',
  });

  const available = await request('GET', '/donations/available', 'clinic-one');
  assert.deepEqual((await available.json()).find(item => item.id === donation.id), donation);
});

test('invalid donor and clinic profiles are rejected at startup', () => {
  const [donor, secondDonor, clinic] = users;
  const cases = [
    [[{ ...donor, id: '1' }], /positive integer id/],
    [[donor, { ...secondDonor, id: donor.id }], /ids and emails must be unique/],
    [[donor, { ...secondDonor, email: donor.email.toUpperCase() }], /ids and emails must be unique/],
    [[{ ...clinic, is_verified: 'true' }], /boolean is_verified/],
  ];

  for (const [profiles, error] of cases) {
    const result = spawnSync(process.execPath, ['-e', 'require(process.argv[1])',
      require.resolve('../src/middlewares/authorize')], {
      env: { ...process.env, MEDREMEDY_USERS: JSON.stringify(profiles) },
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, error);
  }
});

test('a clinic cannot list or claim a donation after its UTC expiration day', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2030-01-01T23:59:59Z') });
  assert.equal((await register('donor-one', '2029-12-31')).status, 400);
  const registration = await register('donor-one', '2030-01-01');
  assert.equal(registration.status, 201);
  const donation = await registration.json();

  t.mock.timers.tick(1000);
  const available = await request('GET', '/donations/available', 'clinic-one');
  assert.ok(!(await available.json()).some(item => item.id === donation.id));
  assert.equal((await request('PUT', `/clinics/claim/${donation.id}`, 'clinic-one')).status, 409);
});

test('a donor can remove their own listing and an admin can remove another donor’s listing', async () => {
  const registration = await register('donor-one');
  const { id } = await registration.json();
  const donationPath = `/donations/${id}`;
  assert.equal((await request('PUT', `/clinics/claim/${id}`, 'clinic-one')).status, 200);
  assert.equal((await request('DELETE', donationPath, 'clinic-one')).status, 403);
  assert.equal((await request('DELETE', donationPath, 'donor-two')).status, 403);

  const removal = await request('DELETE', donationPath, 'donor-one');
  assert.equal(removal.status, 204);
  assert.equal(await removal.text(), '');
  assert.equal((await request('DELETE', donationPath, 'admin-one')).status, 404);
  assert.equal((await request('PUT', `/clinics/claim/${id}`, 'clinic-one')).status, 404);

  const secondRegistration = await register('donor-two');
  const secondDonation = await secondRegistration.json();
  assert.equal((await request('DELETE', `/donations/${secondDonation.id}`, 'admin-one')).status, 204);
});

async function withServer(databasePath, run) {
  const child = spawn(process.execPath, [require.resolve('../src/server')], {
    env: { ...process.env, MEDREMEDY_DB_PATH: databasePath, PORT: '0' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const closed = once(child, 'close');
  try {
    const signal = AbortSignal.timeout(5000);
    const port = await Promise.race([
      once(child.stdout, 'data', { signal }).then(([data]) => /port (\d+)/.exec(data.toString())?.[1]),
      closed.then(([code]) => { throw new Error(`Server exited during startup (${code}).`); }),
    ]);
    assert.ok(port, 'Server reports its listening port');
    await run(`http://127.0.0.1:${port}`);
  } finally {
    child.kill();
    await closed;
  }
}

test('a copied SQLite file retains donations and claims, and deletion cascades to claims', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'medremedy-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const original = join(directory, 'original.sqlite');
  const copy = join(directory, 'copy.sqlite');
  const medication = { drug_name: 'Demo medication', serial_number: 'DEMO1', expiration_date: '2099-12-31' };
  let reserved;
  let available;

  await withServer(original, async url => {
    const registration = await request('POST', '/donations/register', 'donor-one', medication, url);
    assert.equal(registration.status, 201);
    const donation = await registration.json();
    const claim = await request('PUT', `/clinics/claim/${donation.id}`, 'clinic-one', undefined, url);
    assert.equal(claim.status, 200);
    reserved = await claim.json();

    const second = await request('POST', '/donations/register', 'donor-two', medication, url);
    assert.equal(second.status, 201);
    available = await second.json();
  });

  await copyFile(original, copy);
  await withServer(copy, async url => {
    const list = await request('GET', '/donations/available', 'clinic-one', undefined, url);
    assert.deepEqual(await list.json(), [available]);
    const path = `/clinics/claim/${reserved.id}`;
    const retry = await request('PUT', path, 'clinic-one', undefined, url);
    assert.equal(retry.status, 200);
    assert.deepEqual(await retry.json(), reserved);
    assert.equal((await request('PUT', path, 'clinic-two', undefined, url)).status, 409);
    assert.equal((await request('DELETE', `/donations/${reserved.id}`, 'donor-one', undefined, url)).status, 204);
  });

  const database = new DatabaseSync(copy, { readOnly: true });
  try {
    assert.equal(database.prepare('SELECT name FROM donors WHERE id = 1').get().name, 'First donor');
    assert.equal(database.prepare('SELECT is_verified FROM clinics WHERE id = 1').get().is_verified, 1);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM claims').get().count, 0);
    assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    database.close();
  }
});
