const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
const db = require('./db'); // Reuses Mongoose connection and models

const JSON_DB_PATH = path.join(__dirname, 'data', 'db.json');

async function runMigration() {
  console.log('--- STARTING MIGRATION FROM JSON FILE TO MONGODB ---');
  
  // 1. Verify db.json exists
  try {
    await fs.access(JSON_DB_PATH);
  } catch (err) {
    console.log(`[Info] No db.json found at ${JSON_DB_PATH}. Nothing to migrate.`);
    process.exit(0);
  }

  // 2. Read json data
  let rawData;
  try {
    rawData = await fs.readFile(JSON_DB_PATH, 'utf8');
  } catch (err) {
    console.error('Error reading db.json:', err);
    process.exit(1);
  }

  let jsonData;
  try {
    jsonData = JSON.parse(rawData);
  } catch (err) {
    console.error('Error parsing db.json content:', err);
    process.exit(1);
  }

  // 3. Migrate Users
  if (jsonData.users && Array.isArray(jsonData.users)) {
    console.log(`Migrating ${jsonData.users.length} users...`);
    for (const u of jsonData.users) {
      await db.User.findOneAndUpdate({ id: u.id }, u, { upsert: true });
    }
    console.log('Users migrated successfully.');
  }

  // 4. Migrate Exams
  if (jsonData.exams && Array.isArray(jsonData.exams)) {
    console.log(`Migrating ${jsonData.exams.length} exams...`);
    for (const ex of jsonData.exams) {
      await db.Exam.findOneAndUpdate({ id: ex.id }, ex, { upsert: true });
    }
    console.log('Exams migrated successfully.');
  }

  // 5. Migrate Submissions
  if (jsonData.submissions && Array.isArray(jsonData.submissions)) {
    console.log(`Migrating ${jsonData.submissions.length} submissions...`);
    for (const sub of jsonData.submissions) {
      await db.Submission.findOneAndUpdate({ id: sub.id }, sub, { upsert: true });
    }
    console.log('Submissions migrated successfully.');
  }

  // 6. Migrate Classes
  if (jsonData.classes && Array.isArray(jsonData.classes)) {
    console.log(`Migrating ${jsonData.classes.length} classes...`);
    for (const cls of jsonData.classes) {
      await db.Class.findOneAndUpdate({ id: cls.id }, cls, { upsert: true });
    }
    console.log('Classes migrated successfully.');
  }

  console.log('--- MIGRATION COMPLETED SUCCESSFULLY ---');
  mongoose.connection.close();
  process.exit(0);
}

// Wait for mongoose to connect, then run
mongoose.connection.once('open', () => {
  runMigration();
});
