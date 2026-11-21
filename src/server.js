const app = require('./app');

function startServer(host) {
  const port = process.env.PORT || 3000;
  const server = app.listen(port, host, error => {
    if (error) throw error;
    console.log(`Server is running on port ${server.address().port}`);
  });
}

if (require.main === module) startServer();

module.exports = startServer;
