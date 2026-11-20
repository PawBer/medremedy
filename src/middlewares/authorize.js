const { createHash } = require('node:crypto');

const roles = ['donor', 'clinic', 'admin'];
const credentials = JSON.parse(process.env.MEDREMEDY_USERS ?? '[]');
const usersByToken = new Map();
const donors = new Map();
const clinics = new Map();
const donorEmails = new Set();
const clinicEmails = new Set();
const adminIds = new Set();

function isNonBlankString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function registerProfile(user, profiles, emails) {
  const { id, name, email, address, is_verified } = user;
  if (!Number.isInteger(id) || id < 1 || id > 2147483647 ||
      !isNonBlankString(name) || !isNonBlankString(email)) {
    throw new Error('Donors and clinics need a positive integer id, name and email.');
  }

  const emailKey = email.trim().toLowerCase();
  if (profiles.has(id) || emails.has(emailKey)) {
    throw new Error('Donor and clinic ids and emails must be unique within each role.');
  }

  const profile = { id, name: name.trim(), email: email.trim() };
  if (user.role === 'clinic') {
    if (!isNonBlankString(address) || typeof is_verified !== 'boolean') {
      throw new Error('Clinics need an address and a boolean is_verified.');
    }
    profile.address = address.trim();
    profile.is_verified = is_verified;
  }

  profiles.set(id, profile);
  emails.add(emailKey);
  return profile;
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

if (!Array.isArray(credentials)) {
  throw new Error('MEDREMEDY_USERS must be a JSON array.');
}

for (const user of credentials) {
  if (!user || !roles.includes(user.role) || typeof user.token !== 'string' ||
      !/^[a-zA-Z0-9._~+/-]+=*$/.test(user.token)) {
    throw new Error('Each MEDREMEDY_USERS entry needs a role and valid bearer token.');
  }

  const tokenHash = hashToken(user.token);
  if (usersByToken.has(tokenHash)) {
    throw new Error('MEDREMEDY_USERS must contain unique tokens.');
  }

  let profile;
  switch (user.role) {
    case 'donor':
      profile = registerProfile(user, donors, donorEmails);
      break;
    case 'clinic':
      profile = registerProfile(user, clinics, clinicEmails);
      break;
    case 'admin':
      if (!isNonBlankString(user.id) || adminIds.has(user.id)) {
        throw new Error('Administrators need a unique string id.');
      }
      adminIds.add(user.id);
      profile = { id: user.id };
      break;
  }

  usersByToken.set(tokenHash, { profile, role: user.role });
}

module.exports = function authorize(...allowedRoles) {
  return (req, res, next) => {
    const token = /^Bearer (\S+)$/i.exec(req.get('Authorization') || '')?.[1];
    const user = token && usersByToken.get(hashToken(token));

    if (!user) {
      return res.set('WWW-Authenticate', 'Bearer').status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }

    req.user = { id: user.profile.id, role: user.role };
    next();
  };
};
