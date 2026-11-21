const { constants, copyFileSync, mkdirSync } = require('node:fs');
const { join, resolve } = require('node:path');

const dataDirectory = resolve(__dirname, '../data');
const databasePath = join(dataDirectory, 'medremedy-demo.sqlite');

mkdirSync(dataDirectory, { recursive: true });
try {
  copyFileSync(resolve(__dirname, '../documentation/demo.sqlite'), databasePath, constants.COPYFILE_EXCL);
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
}

process.env.MEDREMEDY_DB_PATH = databasePath;
process.env.MEDREMEDY_USERS = JSON.stringify([
  { id: 1, role: 'donor', token: 'local-donor', name: 'Example donor', email: 'donor@example.com' },
  {
    id: 1, role: 'clinic', token: 'local-clinic', name: 'Example clinic',
    email: 'clinic@example.com', address: '1 Example Street', is_verified: true,
  },
  { id: 'admin-1', role: 'admin', token: 'local-admin' },
]);

const startServer = require('./server');
startServer('127.0.0.1');
