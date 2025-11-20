import db from '../db';
import { createRecord, deleteRecord } from './recordService';
import { createInvoice, updateInvoice, deleteInvoice } from './invoiceService';
import { createCustomer, deleteCustomer } from './customerService';
import { createUtilityService, updateUtilityService, deleteUtilityService } from './utilityService';
import { sanitizeForDb, makeTempId } from './dbUtils';

// Helper: safe put that avoids unique-index ConstraintError by using existing primary key if present.
const safePut = async (tableName, obj) => {
  if (!obj || !obj._id) return;
  try {
    const table = db[tableName];
    if (!table) {
      console.warn('[Sync] safePut: unknown table', tableName);
      return;
    }
    const existing = await table.where('_id').equals(String(obj._id)).first();
    if (existing && existing.id !== undefined) {
      // Use the existing primary key to ensure this becomes an update, not an add
      try {
        await table.put({ ...obj, id: existing.id });
        return;
      } catch (e) {
        console.warn(`[Sync] safePut update failed for ${tableName} ${obj._id}, retrying without id`, e);
      }
    }
    // No existing row found - insert normally
    await table.put(obj);
  } catch (e) {
    console.error(`[Sync] safePut ERROR for ${tableName} ${obj._id}:`, e);
    throw e;
  }
};

/**
 * Processes the synchronization queue, sending pending changes to the server.
 */
export const syncWithServer = async () => {
  try {
    const pendingChanges = await db.syncQueue.toArray();
    if (pendingChanges.length === 0) {
      console.log('[Sync] No pending changes to sync.');
      return;
    }

    console.log(`[Sync] Starting sync for ${pendingChanges.length} items.`);

    for (const change of pendingChanges) {
      try {
        const { entity, action, payload, entityId, tempId } = change;
        let response;

        // Normalize entity names to singular form to handle pluralization mismatches
        const normalized = (entity || '').toString().toLowerCase().replace(/s$/,'');

        // Use a switch to determine which API service to call
        switch (normalized) {
          case 'record':
            if (action === 'create') {
              response = await createRecord(payload);
              try {
                await db.records.where('_id').equals(tempId).delete();
              } catch (delErr) {
                console.warn('[Sync] Failed to delete temp record before adding final record', delErr);
              }
              if (response) {
                const sanitized = sanitizeForDb(response);
                try {
                  await safePut('records', sanitized);
                  console.log(`[Sync] Successfully wrote created record to Dexie: ${sanitized._id}`);
                } catch (putErr) {
                  console.error('[Sync] ERROR putting created record to Dexie via safePut:', putErr);
                }
              }
            }
            if (action === 'delete') await deleteRecord(entityId);
            break;
          case 'invoice':
            if (action === 'create') {
              response = await createInvoice(payload);
              // Atomically replace the temporary local record with the final server record.
              try {
                await db.invoices.where('_id').equals(tempId).delete();
              } catch (delErr) {
                console.warn('[Sync] Failed to delete temp invoice before adding final invoice', delErr);
              }
              // Flatten server response to match Dexie schema and ensure _id exists
              if (response) {
                const finalInvoice = sanitizeForDb(response, { flattenCustomer: true });
                try {
                  await safePut('invoices', finalInvoice);
                  console.log(`[Sync] Successfully wrote created invoice to Dexie: ${finalInvoice._id}`);
                } catch (putErr) {
                  console.error('[Sync] ERROR putting created invoice to Dexie via safePut:', putErr);
                }
              }
            }
            if (action === 'update') {
              // Send update to server and persist the server's canonical response into local DB
              try {
                console.log(`[Sync] Updating invoice on server: ${entityId}`, payload);
                response = await updateInvoice(entityId, payload);
                console.log(`[Sync] Server response for invoice update:`, response);
                if (response) {
                  const sanitized = sanitizeForDb(response, { flattenCustomer: true });
                  console.log(`[Sync] Sanitized data for invoice:`, sanitized);
                  try {
                    await safePut('invoices', sanitized);
                    console.log(`[Sync] Successfully wrote invoice to Dexie: ${sanitized._id}`);
                  } catch (putErr) {
                    console.error('[Sync] ERROR putting invoice to Dexie via safePut:', putErr);
                  }
                } else {
                  console.warn('[Sync] No response from server for invoice update');
                }
              } catch (uErr) {
                console.error('[Sync] Failed to update invoice on server:', uErr);
              }
            }
            if (action === 'send') {
              // Handle 'send' action as an update with status change and persist server response
              try {
                console.log(`[Sync] Marking invoice as sent on server: ${entityId}`);
                response = await updateInvoice(entityId, { status: 'sent' });
                console.log(`[Sync] Server response for invoice send:`, response);
                console.log(`[Sync] Invoice ${entityId} marked as sent on server`);
                if (response) {
                  const sanitized = sanitizeForDb(response, { flattenCustomer: true });
                  console.log(`[Sync] Sanitized data for sent invoice:`, sanitized);
                  try {
                    await safePut('invoices', sanitized);
                    console.log(`[Sync] Successfully wrote sent invoice to Dexie: ${sanitized._id}`);
                  } catch (putErr) {
                    console.error('[Sync] ERROR putting sent invoice to Dexie via safePut:', putErr);
                  }
                } else {
                  console.warn('[Sync] No response from server for invoice send');
                }
              } catch (sErr) {
                console.error('[Sync] Failed to send invoice to server:', sErr);
              }
            }
            if (action === 'delete') {
              try {
                await deleteInvoice(entityId);
                // remove locally as well
                await db.invoices.where('_id').equals(entityId).delete();
              } catch (dErr) {
                console.error('[Sync] Failed to delete invoice on server/local:', dErr);
              }
            }
            break;
          case 'customer':
            if (action === 'create') {
              try {
                response = await createCustomer(payload);
                try {
                  await db.customers.where('_id').equals(tempId).delete();
                } catch (delErr) {
                  console.warn('[Sync] Failed to delete temp customer before adding final customer', delErr);
                }
                const sanitized = sanitizeForDb(response);
                console.log(`[Sync] Sanitized response for created customer:`, sanitized);
                try {
                  await safePut('customers', sanitized);
                  console.log(`[Sync] Successfully wrote created customer to Dexie: ${sanitized._id}`);
                } catch (putErr) {
                  console.error('[Sync] ERROR putting created customer to Dexie via safePut:', putErr);
                }
              } catch (cErr) {
                console.error('[Sync] Failed to create customer on server:', cErr);
              }
            }
            if (action === 'update') {
              // Add update handler for customers too
              try {
                console.log(`[Sync] Updating customer on server: ${entityId}`, payload);
                response = await updateCustomer(entityId, payload);
                console.log(`[Sync] Server response for customer update:`, response);
                if (response) {
                  const sanitized = sanitizeForDb(response);
                  console.log(`[Sync] Sanitized data for customer:`, sanitized);
                  try {
                    await safePut('customers', sanitized);
                    console.log(`[Sync] Successfully wrote customer to Dexie: ${sanitized._id}`);
                  } catch (putErr) {
                    console.error('[Sync] ERROR putting customer to Dexie via safePut:', putErr);
                  }
                } else {
                  console.warn('[Sync] No response from server for customer update');
                }
              } catch (uErr) {
                console.error('[Sync] Failed to update customer on server:', uErr);
              }
            }
            if (action === 'delete') {
              try {
                await deleteCustomer(entityId);
                await db.customers.where('_id').equals(entityId).delete();
              } catch (dErr) {
                console.error('[Sync] Failed to delete customer on server/local:', dErr);
              }
            }
            break;
          case 'utilityservice':
            if (action === 'create') {
              try {
                response = await createUtilityService(payload);
                try {
                  await db.utilityServices.where('_id').equals(tempId).delete();
                } catch (delErr) {
                  console.warn('[Sync] Failed to delete temp utility service before adding final:', delErr);
                }
                if (response) {
                  const sanitized = sanitizeForDb(response);
                  console.log(`[Sync] Sanitized response for created utility service:`, sanitized);
                  try {
                    await safePut('utilityServices', sanitized);
                    console.log(`[Sync] Successfully wrote created utility service to Dexie: ${sanitized._id}`);
                  } catch (putErr) {
                    console.error('[Sync] ERROR putting created utility service to Dexie via safePut:', putErr);
                  }
                } else {
                  console.warn('[Sync] No response from server for utility service create');
                }
              } catch (cErr) {
                console.error('[Sync] Failed to create utility service on server:', cErr);
              }
            }
            if (action === 'update') {
              try {
                console.log(`[Sync] Updating utility service on server: ${entityId}`, payload);
                response = await updateUtilityService(entityId, payload);
                console.log(`[Sync] Server response for utility service update:`, response);
                if (response) {
                  const sanitized = sanitizeForDb(response);
                  console.log(`[Sync] Sanitized data for utility service:`, sanitized);
                  try {
                    await safePut('utilityServices', sanitized);
                    console.log(`[Sync] Successfully wrote utility service to Dexie: ${sanitized._id}`);
                  } catch (putErr) {
                    console.error('[Sync] ERROR putting utility service to Dexie via safePut:', putErr);
                  }
                } else {
                  console.warn('[Sync] No response from server for utility service update');
                }
              } catch (uErr) {
                console.error('[Sync] Failed to update utility service on server:', uErr);
              }
            }
            if (action === 'delete') {
              try {
                await deleteUtilityService(entityId);
                await db.utilityServices.where('_id').equals(entityId).delete();
              } catch (dErr) {
                console.error('[Sync] Failed to delete utility service on server/local:', dErr);
              }
            }
            break;
          default:
            console.warn(`[Sync] Unknown entity type: ${entity}`);
            break;
        }

        // If the API call was successful, remove the item from the queue
        await db.syncQueue.delete(change.id);
        console.log(`[Sync] Successfully synced and removed item: ${entity} (${action})`);

      } catch (error) {
        console.error(`[Sync] Failed to sync item: ${change.entity} (${change.action})`, error);
        // Continue with next item instead of breaking - one failure shouldn't block others
      }
    }

    console.log('[Sync] Synchronization process finished.');
  } catch (error) {
    console.error('[Sync] Fatal sync error:', error);
    // Even if sync crashes, we shouldn't break the app
  }
};