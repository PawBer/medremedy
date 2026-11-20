const { createHash } = require('node:crypto');

const roles = ['donor', 'clinic', 'admin'];
const credentials = JSON.parse(process.env.MEDREMEDY_USERS ?? '[]');
const usersByToken = new Map();
const userIds = new Set();

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

if (!Array.isArray(credentials)) {
  throw new Error('MEDREMEDY_USERS must be a JSON array.');
}

for (const user of credentials) {
  if (!user || typeof user.id !== 'string' || !user.id.trim() ||
      !roles.includes(user.role) || typeof user.token !== 'string' ||
      !/^[a-zA-Z0-9._~+/-]+=*$/.test(user.token)) {
    throw new Error('Each MEDREMEDY_USERS entry needs an id, role and valid bearer token.');
  }

  const tokenHash = hashToken(user.token);
  if (usersByToken.has(tokenHash) || userIds.has(user.id)) {
    throw new Error('MEDREMEDY_USERS must contain unique ids and tokens.');
  }

  usersByToken.set(tokenHash, { id: user.id, role: user.role });
  userIds.add(user.id);
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

    req.user = user;
    next();
  };
};
