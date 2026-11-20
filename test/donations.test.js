const assert = require('node:assert/strict');
const { once } = require('node:events');
const { after, before, test } = require('node:test');

const users = [
  { id: 'donor-1', role: 'donor', token: 'donor-one' },
  { id: 'donor-2', role: 'donor', token: 'donor-two' },
  { id: 'clinic-1', role: 'clinic', token: 'clinic-one' },
  { id: 'clinic-2', role: 'clinic', token: 'clinic-two' },
  { id: 'admin-1', role: 'admin', token: 'admin-one' },
];

let server;
let baseUrl;

before(async () => {
  process.env.MEDREMEDY_USERS = JSON.stringify(users);
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

function request(method, path, token, body) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  return fetch(`${baseUrl}${path}`, { method, headers, body: JSON.stringify(body) });
}

function register(token, expiration_date = '2099-12-31') {
  return request('POST', '/donations/register', token, {
    drug_name: 'Example medication',
    serial_number: 'ABC123',
    expiration_date,
  });
}

test('only donors can register and only clinics can list or claim donations', async () => {
  assert.equal((await register()).status, 401);
  assert.equal((await register('invalid-token')).status, 401);
  assert.equal((await register('clinic-one')).status, 403);
  assert.equal((await request('GET', '/donations/available', 'donor-one')).status, 403);
  assert.equal((await request('PUT', '/clinics/claim/1', 'donor-one')).status, 403);
});

test('a donation can be claimed by one clinic and disappears from the available list', async () => {
  const registration = await register('donor-one');
  assert.equal(registration.status, 201);
  const donation = await registration.json();
  const available = await request('GET', '/donations/available', 'clinic-one');
  assert.equal(available.status, 200);
  assert.ok((await available.json()).some(item => item.id === donation.id));

  const claimPath = `/clinics/claim/${donation.id}`;
  const clinicTokens = ['clinic-one', 'clinic-two'];
  const claims = await Promise.all(clinicTokens.map(token => request('PUT', claimPath, token)));
  assert.deepEqual(claims.map(claim => claim.status).sort(), [200, 409]);
  const winner = claims.findIndex(claim => claim.status === 200);
  const claimedDonation = await claims[winner].json();
  assert.equal(claimedDonation.status, 'claimed');

  const retry = await request('PUT', claimPath, clinicTokens[winner]);
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), claimedDonation);

  const remaining = await request('GET', '/donations/available', 'clinic-two');
  assert.ok(!(await remaining.json()).some(item => item.id === donation.id));
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
