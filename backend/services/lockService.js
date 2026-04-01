const { randomUUID } = require('crypto');
const Lock = require('../models/Lock');
const { logger } = require('./loggerService');

class LockBusyError extends Error {
  constructor(key) {
    super(`El lock '${key}' está ocupado`);
    this.name = 'LockBusyError';
    this.key = key;
  }
}

async function acquireLock(key, ttlMs, owner) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  const filter = {
    key,
    $or: [
      { expiresAt: { $lte: now } },
      { expiresAt: { $exists: false } }
    ]
  };
  const update = {
    key,
    owner,
    expiresAt
  };
  try {
    const lock = await Lock.findOneAndUpdate(filter, update, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    });
    return lock;
  } catch (error) {
    if (error.code === 11000) {
      return null;
    }
    throw error;
  }
}

async function releaseLock(key, owner) {
  await Lock.deleteOne({ key, owner });
}

async function withLock(key, ttlMs, callback) {
  const owner = `${process.pid}-${randomUUID()}`;
  const lock = await acquireLock(key, ttlMs, owner);
  if (!lock) {
    throw new LockBusyError(key);
  }
  try {
    return await callback(lock);
  } finally {
    try {
      await releaseLock(key, owner);
    } catch (error) {
      logger.error(`No se pudo liberar el lock ${key}:`, error);
    }
  }
}

module.exports = {
  acquireLock,
  releaseLock,
  withLock,
  LockBusyError
};
