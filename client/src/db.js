import Dexie from 'dexie';

// Create the Dexie database instance
const db = new Dexie('Recordiq');

// Define the database schema
db.version(1).stores({
  records: '++id, type, amount, recordDate, customerId, syncStatus',
  invoices: '++id, invoiceNumber, customerId, status, dueDate, syncStatus',
  customers: '++id, name, phone, email, syncStatus',
  payments: '++id, invoiceId, transactionId, status, syncStatus',
  syncQueue: '++id, entity, entityId, action, payload, timestamp',
});

// Version 2: Aligning with backend models after extensive changes.
// We add new fields and a new table for utility services.
db.version(2).stores({
  // ++id is an auto-incrementing primary key
  // syncStatus: 'synced' | 'pending' | 'failed'
  records: '++id, type, recordType, amount, description, recordDate, customerId, syncStatus, imagePath, ocrData, modelSpecs',
  
  // status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void'
  invoices: '++id, invoiceNumber, customerId, status, dueDate, issueDate, items, total, syncStatus',
  
  customers: '++id, name, phone, email, isActive, syncStatus',
  
  // status: 'pending' | 'completed' | 'failed'
  payments: '++id, invoiceId, transactionId, status, amount, provider, paymentDate, syncStatus',

  utilityServices: '++id, name, user, syncStatus',
  
  syncQueue: '++id, entity, entityId, action, payload, timestamp',
});

// Version 3: Use MongoDB's _id as the primary key for all tables.
// This is the correct approach for syncing with a MongoDB backend.
// The '&' prefix indicates that the property must be unique.
// FIX: We keep '++id' as the primary key and add '&_id' as a unique index.
db.version(3).stores({
  records: '++id, &_id, type, recordType, amount, description, recordDate, customerId, syncStatus, imagePath, ocrData, modelSpecs',
  
  invoices: '++id, &_id, invoiceNumber, customerId, status, dueDate, issueDate, items, total, syncStatus',
  
  customers: '++id, &_id, name, phone, email, isActive, syncStatus',
  
  payments: '++id, &_id, invoiceId, transactionId, status, amount, provider, paymentDate, syncStatus',

  utilityServices: '++id, &_id, name, user, syncStatus',
  
  // The syncQueue can keep its auto-incrementing key as it's purely client-side.
  syncQueue: '++id, entity, entityId, action, payload, timestamp',
});

// Migrate existing records that don't have an `_id` to avoid unique-index violations.
db.version(3).upgrade(async (trans) => {
  try {
    // Use crypto.randomUUID when available; fallback to timestamp-based id.
    const makeId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `client_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;

    // Assign `_id` for each affected table if missing, using the transaction-scoped table handles.
    try { await trans.table('records').toCollection().modify(item => { if (item && (item._id === undefined || item._id === null)) item._id = makeId(); }); } catch (e) { /* table may not exist in some installs */ }
    try { await trans.table('invoices').toCollection().modify(item => { if (item && (item._id === undefined || item._id === null)) item._id = makeId(); }); } catch (e) { }
    try { await trans.table('customers').toCollection().modify(item => { if (item && (item._id === undefined || item._id === null)) item._id = makeId(); }); } catch (e) { }
    try { await trans.table('payments').toCollection().modify(item => { if (item && (item._id === undefined || item._id === null)) item._id = makeId(); }); } catch (e) { }
    try { await trans.table('utilityServices').toCollection().modify(item => { if (item && (item._id === undefined || item._id === null)) item._id = makeId(); }); } catch (e) { }
  } catch (e) {
    console.warn('DB upgrade (v3) migration warning:', e);
  }
});

// Version 4: Add missing fields to the invoices table to match the server model.
// This is the definitive fix for the ConstraintError on the InvoicesPage.
db.version(4).stores({
  // No changes to other tables
  records: '++id, &_id, type, recordType, amount, description, recordDate, customerId, syncStatus, imagePath, ocrData, modelSpecs',
  customers: '++id, &_id, name, phone, email, isActive, syncStatus',
  payments: '++id, &_id, invoiceId, transactionId, status, amount, provider, paymentDate, syncStatus',
  utilityServices: '++id, &_id, name, user, syncStatus',
  syncQueue: '++id, entity, entityId, action, payload, timestamp',

  // Add customerName, subTotal, and tax to the invoices schema.
  invoices: '++id, &_id, invoiceNumber, customerId, customerName, status, dueDate, issueDate, items, subTotal, tax, total, syncStatus',
});

// Ensure any new fields exist and `_id` uniqueness is preserved when upgrading to v4.
db.version(4).upgrade(async (trans) => {
  try {
    const makeId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `client_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;

    // Populate missing invoice fields and ensure `_id` exists.
    await trans.table('invoices').toCollection().modify(item => {
      if (item) {
        if (item._id === undefined || item._id === null) item._id = makeId();
        if (item.customerName === undefined) item.customerName = item.customer ? item.customer.name : item.customerName || '';
        if (item.subTotal === undefined) item.subTotal = item.total || 0;
        if (item.tax === undefined) item.tax = 0;
      }
    });
  } catch (e) {
    console.warn('DB upgrade (v4) migration warning:', e);
  }
});

// Make the db instance available throughout the app
export default db;

// Version 5: Ensure all `_id` values are strings to avoid IndexedDB key-type issues.
db.version(5).stores({
  records: '++id, &_id, type, recordType, amount, description, recordDate, customerId, syncStatus, imagePath, ocrData, modelSpecs',
  invoices: '++id, &_id, invoiceNumber, customerId, customerName, status, dueDate, issueDate, items, subTotal, tax, total, syncStatus',
  customers: '++id, &_id, name, phone, email, isActive, syncStatus',
  payments: '++id, &_id, invoiceId, transactionId, status, amount, provider, paymentDate, syncStatus',
  utilityServices: '++id, &_id, name, user, syncStatus',
  syncQueue: '++id, entity, entityId, action, payload, timestamp',
});

// Upgrade: convert existing `_id` values to string and ensure missing `_id` are populated.
db.version(5).upgrade(async (trans) => {
  try {
    const makeId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `client_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;

    const tables = ['records','invoices','customers','payments','utilityServices'];
    for (const t of tables) {
      try {
        await trans.table(t).toCollection().modify(item => {
          if (!item) return;
          // Ensure an _id exists
          if (item._id === undefined || item._id === null) item._id = makeId();
          // Convert the _id to string to avoid key-type conflicts
          try { item._id = String(item._id); } catch (e) { item._id = makeId(); }
        });
      } catch (e) {
        // Ignore individual table errors to allow upgrade to continue for other tables
        console.warn(`v5 upgrade: table ${t} modify warning`, e);
      }
    }
  } catch (e) {
    console.warn('DB upgrade (v5) migration warning:', e);
  }
});
