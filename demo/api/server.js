import { app, writeToDatabase } from './app.js';
import { PORT } from './config.js';

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const errorWriteBack = async () => {
  console.log("Server writing back");
  await writeToDatabase();
  process.exit(1);
}

process.on('SIGINT', errorWriteBack);
process.on('SIGTERM', errorWriteBack);

server.on('error', (err) => {
  console.error('Server error:', err);
  errorWriteBack();
});

server.on('close', () => {
  console.log('Server closed');
  writeToDatabase();
  process.exit(0);
});
