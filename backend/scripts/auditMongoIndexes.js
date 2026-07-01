const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: './config/.env' });

const Room = require('../models/Room');
const Reservation = require('../models/Reservation');
const Client = require('../models/Client');
const AuditLog = require('../models/AuditLog');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero';

async function printIndexes(model, label) {
  const indexes = await model.collection.indexes();
  console.log(`\n[${label}] indexes (${indexes.length})`);
  indexes.forEach((idx) => {
    console.log(`- ${idx.name}: ${JSON.stringify(idx.key)}`);
  });
}

async function auditMongoIndexes() {
  try {
    await mongoose.connect(MONGO_URI);

    const shouldSync = process.argv.includes('--sync');
    if (shouldSync) {
      const syncTargets = [
        ['Room', Room],
        ['Reservation', Reservation],
        ['Client', Client],
        ['AuditLog', AuditLog]
      ];
      for (const [label, model] of syncTargets) {
        try {
          await model.syncIndexes();
          console.log(`[${label}] syncIndexes OK`);
        } catch (syncError) {
          console.warn(`[${label}] syncIndexes warning: ${syncError.message}`);
        }
      }
    }

    await printIndexes(Room, 'Room');
    await printIndexes(Reservation, 'Reservation');
    await printIndexes(Client, 'Client');
    await printIndexes(AuditLog, 'AuditLog');

    console.log('\nIndex audit completed.');
  } catch (error) {
    console.error('Index audit failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

if (require.main === module) {
  auditMongoIndexes();
}

module.exports = { auditMongoIndexes };
