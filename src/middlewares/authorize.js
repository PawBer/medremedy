const { findUserByToken } = require('../config/users');

module.exports = function authorize(...allowedRoles) {
  return (req, res, next) => {
    const token = /^Bearer (\S+)$/i.exec(req.get('Authorization') || '')?.[1];
    const user = token && findUserByToken(token);

    if (!user) {
      return res.set('WWW-Authenticate', 'Bearer').status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }

    req.user = { ...user };
    next();
  };
};
