# 🔒 BACKUP STRATEGY — PMS2 Production

**Criticidad:** 🔴 MÁXIMA  
**Timeline:** Implementar PRIMERO (antes de cualquier otra cosa)  
**Objetivo:** Proteger datos del hotel de pérdida total

---

## ⚠️ Why This Is First

```
Sin Backups:
├─ Crash de MongoDB → Pérdida TOTAL de reservas
├─ Ransomware → Datos encriptados
├─ Accidente de usuario → Eliminación accidental
└─ Resultado: Hotel cerrado + demanda legal

Con Backups:
├─ Crash → Restore 15 minutos, pérdida < 1 hora de datos
├─ Ransomware → Restore desde backup limpio

├─ Accidente → Rollback a versión anterior
└─ Resultado: Hotel sigue funcionando
```

---

## 📋 RTO/RPO (Recovery Targets)

```
RTO (Recovery Time Objective):
  Cuánto tiempo para volver online
  TARGET: 1 hora

RPO (Recovery Point Objective):
  Cuánta data podemos perder
  TARGET: 15 minutos
  
Traducción:
  Si crash a las 14:00
  → Estamos online a las 15:00 (RTO)
  → Máximo perdemos datos hasta las 13:45 (RPO)
```

---

## 🗄️ Backup Architecture

```
┌─────────────────────────────────────┐
│    MongoDB Production (LIVE)        │
├─────────────────────────────────────┤
│ ├─ Reservations (real-time)         │
│ ├─ Rooms (config)                   │
│ ├─ Clients (profiles)               │
│ ├─ Users (staff)                    │
│ └─ AuditLogs (histórico)            │
└────────────┬────────────────────────┘
             │
      ┌──────┴──────┐
      │             │
      ▼             ▼
┌──────────────┐  ┌──────────────┐
│  HOURLY      │  │  DAILY       │
│  Snapshots   │  │  Snapshots   │
│  (keep 48h)  │  │  (keep 30d)  │
└──────────────┘  └──────────────┘
      │                 │
      ▼                 ▼
┌─────────────────────────────────┐
│  Offsite Storage (S3/Azure)     │
│  (Geographically separate)       │
└─────────────────────────────────┘
```

---

## 📍 Implementation Steps

### PASO 1: Automated Hourly Backups (2 horas)

**File:** `backend/services/backupService.js`

```javascript
const mongoDb = require('mongoose');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

class BackupService {
  constructor() {
    this.backupDir = process.env.BACKUP_DIR || '/backups';
    this.startSchedules();
  }
  
  startSchedules() {
    // Hourly backup (every hour at :00)
    cron.schedule('0 * * * *', () => this.createHourlyBackup());
    
    // Daily backup (every day at 2 AM)
    cron.schedule('0 2 * * *', () => this.createDailyBackup());
    
    // Weekly backup (every Sunday at 3 AM)
    cron.schedule('0 3 * * 0', () => this.createWeeklyBackup());
  }
  
  async createHourlyBackup() {
    try {
      const timestamp = new Date().toISOString();
      const backupFile = `hourly_${timestamp}.dump`;
      
      // Export MongoDB
      await this.dumpMongoDB(backupFile);
      
      // Upload to S3/Azure (offsite)
      await this.uploadToOffsite(backupFile);
      
      // Keep only last 48 backups (48 hours)
      await this.cleanupOldBackups('hourly', 48);
      
      console.log(`[BACKUP] ✅ Hourly backup created: ${backupFile}`);
    } catch (error) {
      console.error(`[BACKUP] ❌ Hourly backup failed:`, error);
      // Send alert to admin
      await this.notifyAdmin(`Backup failed at ${new Date()}`);
    }
  }
  
  async createDailyBackup() {
    try {
      const date = new Date().toISOString().split('T')[0];
      const backupFile = `daily_${date}.dump`;
      
      // Export MongoDB
      await this.dumpMongoDB(backupFile);
      
      // Upload to S3/Azure
      await this.uploadToOffsite(backupFile);
      
      // Keep only last 30 backups (30 days)
      await this.cleanupOldBackups('daily', 30);
      
      console.log(`[BACKUP] ✅ Daily backup created: ${backupFile}`);
    } catch (error) {
      console.error(`[BACKUP] ❌ Daily backup failed:`, error);
      await this.notifyAdmin(`Daily backup failed`);
    }
  }
  
  async dumpMongoDB(filename) {
    // Use mongodump to create backup
    // $ mongodump --uri "mongodb://..." --out /backups/hourly_xxx.dump
    const cmd = `mongodump --uri "${process.env.MONGO_URI}" --out ${this.backupDir}/${filename}`;
    // Execute and wait
    return new Promise((resolve, reject) => {
      require('child_process').exec(cmd, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });
  }
  
  async uploadToOffsite(filename) {
    // Upload to S3 or Azure Blob Storage
    const filePath = path.join(this.backupDir, filename);
    
    if (process.env.BACKUP_S3_BUCKET) {
      // AWS S3
      const AWS = require('aws-sdk');
      const s3 = new AWS.S3();
      const fileStream = fs.createReadStream(filePath);
      
      await s3.upload({
        Bucket: process.env.BACKUP_S3_BUCKET,
        Key: `backups/${filename}`,
        Body: fileStream
      }).promise();
    }
    
    if (process.env.BACKUP_AZURE_CONTAINER) {
      // Azure Blob Storage
      const { BlobServiceClient } = require('@azure/storage-blob');
      const client = BlobServiceClient.fromConnectionString(
        process.env.AZURE_STORAGE_CONNECTION_STRING
      );
      const container = client.getContainerClient(process.env.BACKUP_AZURE_CONTAINER);
      
      await container.uploadBlockBlob(filename, fs.createReadStream(filePath));
    }
  }
  
  async cleanupOldBackups(type, keepCount) {
    // List backups by type
    const files = fs.readdirSync(this.backupDir)
      .filter(f => f.startsWith(type))
      .sort()
      .reverse();
    
    // Delete old ones
    for (let i = keepCount; i < files.length; i++) {
      fs.rmSync(path.join(this.backupDir, files[i]), { recursive: true });
    }
  }
  
  async restoreFromBackup(backupFile) {
    console.log(`[RESTORE] Starting restore from ${backupFile}...`);
    
    try {
      // Verify backup exists
      const filePath = path.join(this.backupDir, backupFile);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Backup file not found: ${backupFile}`);
      }
      
      // Restore MongoDB
      const cmd = `mongorestore --uri "${process.env.MONGO_URI}" --drop ${filePath}`;
      await new Promise((resolve, reject) => {
        require('child_process').exec(cmd, (error, stdout, stderr) => {
          if (error) reject(error);
          else resolve(stdout);
        });
      });
      
      console.log(`[RESTORE] ✅ Restore complete`);
    } catch (error) {
      console.error(`[RESTORE] ❌ Restore failed:`, error);
      throw error;
    }
  }
  
  async notifyAdmin(message) {
    // Send email to admin, Slack, etc.
    // TODO: Implement notification
  }
}

module.exports = new BackupService();
```

### PASO 2: Restore Procedure Documentation (1 hora)

**File:** `backend/docs/RESTORE-PROCEDURE.md`

```markdown
# MongoDB Restore Procedure

## Emergency Restore (if crash)

### Step 1: List Available Backups
\`\`\`bash
ls -lah /backups/
# Or check S3
aws s3 ls s3://your-bucket/backups/
\`\`\`

### Step 2: Verify Backup Integrity
\`\`\`bash
# List contents of backup
mongorestore --archive=/backups/hourly_2026-06-16T14:00:00Z.dump --nsInclude="*" --dryRun
\`\`\`

### Step 3: Restore to MongoDB
\`\`\`bash
# STOP the application first
pm2 stop pms2

# Restore from backup (WARNING: This overwrites current data)
mongorestore --uri "mongodb://localhost:27017/pms2" \
  --archive=/backups/hourly_2026-06-16T14:00:00Z.dump \
  --drop

# Verify restore
mongosh --eval "db.reservations.countDocuments()"

# START the application
pm2 start pms2
\`\`\`

### Step 4: Verification Checklist
- [ ] Reservation count matches backup time
- [ ] Latest reservation date is correct
- [ ] No duplicate records
- [ ] Audit logs restored
- [ ] Users can login
- [ ] Dashboard loads
```

### PASO 3: Backup Verification Endpoint (1 hora)

**File:** Update `backend/controllers/systemController.js`

```javascript
// Add to systemController.js

const backupService = require('../services/backupService');

exports.listBackups = async (req, res) => {
  try {
    const backupDir = process.env.BACKUP_DIR || '/backups';
    const fs = require('fs');
    
    const backups = fs.readdirSync(backupDir)
      .map(file => ({
        name: file,
        size: fs.statSync(`${backupDir}/${file}`).size,
        created: fs.statSync(`${backupDir}/${file}`).birthtime
      }))
      .sort((a, b) => b.created - a.created)
      .slice(0, 50); // Last 50
    
    res.json({
      status: 'ok',
      backups,
      count: backups.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.verifyBackup = async (req, res) => {
  try {
    const { backupName } = req.params;
    
    // Check if file exists
    const fs = require('fs');
    const path = require('path');
    const backupDir = process.env.BACKUP_DIR || '/backups';
    const backupPath = path.join(backupDir, backupName);
    
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    
    const stats = fs.statSync(backupPath);
    
    res.json({
      status: 'ok',
      backup: {
        name: backupName,
        size: stats.size,
        created: stats.birthtime,
        canRestore: true
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.manualBackupNow = async (req, res) => {
  try {
    await backupService.createHourlyBackup();
    res.json({ status: 'ok', message: 'Backup created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

**Routes:** Add to `backend/app.js`

```javascript
// Admin only - BACKUP endpoints
app.get('/api/system/backups', adminAuth, systemController.listBackups);
app.get('/api/system/backups/:backupName/verify', adminAuth, systemController.verifyBackup);
app.post('/api/system/backups/now', adminAuth, systemController.manualBackupNow);
```

### PASO 4: Environment Variables (30 mins)

**File:** `.env` (production)

```bash
# Backup Configuration
BACKUP_DIR=/data/backups
BACKUP_S3_BUCKET=pms2-backups
BACKUP_AZURE_CONTAINER=pms2-backups
AZURE_STORAGE_CONNECTION_STRING=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# MongoDB
MONGO_URI=mongodb://localhost:27017/pms2
```

### PASO 5: Test Backup → Restore Cycle (1 hora)

**File:** `backend/tests/backup.test.js`

```javascript
const backupService = require('../../services/backupService');

describe('Backup/Restore Cycle', () => {
  it('should create hourly backup', async () => {
    // Create a test document
    const Reservation = require('../../models/Reservation');
    const testRes = await Reservation.create({
      client: 'test',
      room: 'test-room',
      checkIn: new Date(),
      checkOut: new Date()
    });
    
    // Create backup
    await backupService.createHourlyBackup();
    
    // Verify backup file exists
    const backups = require('fs').readdirSync(process.env.BACKUP_DIR);
    expect(backups.length).toBeGreaterThan(0);
  });
  
  it('should list available backups', async () => {
    const backups = await backupService.listBackups();
    expect(Array.isArray(backups)).toBe(true);
  });
});
```

---

## 📊 Backup Retention Policy

```
Hourly Backups:
├─ Keep: 48 backups (2 days)
├─ Size: ~100 MB each (4.8 GB total)
├─ Usage: Quick recovery, recent crashes
└─ Cost: Low

Daily Backups:
├─ Keep: 30 backups (1 month)
├─ Size: ~100 MB each (3 GB total)
├─ Usage: Monthly restore, data audits
└─ Cost: Medium

Weekly Backups:
├─ Keep: 52 backups (1 year)
├─ Size: ~100 MB each (5.2 GB total)
├─ Usage: Yearly archive, compliance
└─ Cost: Medium

TOTAL STORAGE: ~13 GB (local) + offsite copies
```

---

## ✅ Checklist

- [ ] Create `backupService.js`
- [ ] Create cron schedule (hourly/daily/weekly)
- [ ] Implement `dumpMongoDB()`
- [ ] Implement `uploadToOffsite()`
- [ ] Add backup endpoints to API
- [ ] Test backup creation
- [ ] Test restore procedure
- [ ] Document restore steps
- [ ] Configure environment variables
- [ ] Test S3/Azure upload
- [ ] Create monitoring for backup failures
- [ ] Notify admin on backup failure
- [ ] Run full restore test (non-prod)
- [ ] Document RTO/RPO (1h / 15min)

---

## 🎯 Success Criteria

```
✅ Hourly backups working
✅ Daily backups working
✅ Offsite storage configured
✅ Restore test passed (data integrity verified)
✅ RTO met: Can restore in < 1 hour
✅ RPO met: Data loss < 15 minutes
✅ Admin notified on failures
✅ Monitoring dashboard shows backup status
```

---

## Timeline

```
Hoy:     PASO 1-2 (3 horas) → Backups automated + docs
Mañana:  PASO 3-4 (1 hora) → Endpoints + env vars
Día 3:   PASO 5 (1 hora) → Testing + verification
Total:   5 horas de implementación
Result:  Hotel protegido 100%
```

---

**Status:** 🔴 CRÍTICO - Implementar PRIMERO  
**Impact:** Sin esto, cualquier crash = datos perdidos  
**Value:** Invaluable (hotel puede sobrevivir crash)

**Next:** Confirmar que empezamos con esto HOY antes de Health Endpoint
