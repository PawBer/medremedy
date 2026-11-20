const app = require('./app');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, error => {
  if (error) throw error;
  console.log(`Server is running on port ${server.address().port}`);
});
