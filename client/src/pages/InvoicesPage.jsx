import React, { useEffect, useState, useRef } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { getInvoices } from '../services/invoiceService';
import AddInvoiceForm from '../components/AddInvoiceForm';
import { Link, useSearchParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import Button from '../components/Button';
import db from '../db'; // Import the Dexie database instance
import { sanitizeArrayForDb, sanitizeForDb } from '../services/dbUtils';

const InvoicesPage = () => {
  const { user } = useUser();
  const { theme } = useTheme();
  const { isLoaded } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const isFetchingRef = useRef(false); // Ref-based lock to prevent re-fetching without rerenders

  useEffect(() => {
    // Prevent the fetch function from running if it's already in progress.
    if (!isLoaded || isFetchingRef.current) return;

    const fetchInvoices = async () => {
      // Set the fetching lock to true to block subsequent calls.
      isFetchingRef.current = true;

      // **REFACTORED LOGIC: Network-First, Cache-Fallback**
      try {
        // 1. Prioritize fetching fresh data from the server.
        const serverInvoices = await getInvoices();

        // 2. Flatten and clean the server data before storing it.
        const validInvoices = serverInvoices.invoices
          .filter(inv => inv && (inv._id || inv.id)) // Ensure invoice has an ID
          .map(inv => {
            // Server now stores customer as a string (UUID), not a nested object
            const customerId = inv.customer || inv.customerId;
            const customerName = inv.customerName || '[Deleted Customer]';
            return {
              ...inv,
              customerId,
              customerName,
            };
          });

        // Sanitize `_id` values (ensure strings) and flatten customer fields before storing
        const sanitized = sanitizeArrayForDb(validInvoices, { flattenCustomer: true });

        // 3. Perform the database operation: delete existing, then add new ones
        // This avoids constraint errors when syncing invoices that already exist locally
        for (const invoice of sanitized) {
          try {
            // First check if it exists (search by unique _id index)
            const existing = await db.invoices.where('_id').equals(String(invoice._id)).first();
            if (existing && existing.id !== undefined) {
              // Update existing record by primary key
              try {
                await db.invoices.update(existing.id, invoice);
              } catch (updateErr) {
                if (updateErr.name !== 'ConstraintError') {
                  console.warn(`[InvoicesPage] Error updating invoice ${invoice._id}:`, updateErr);
                }
              }
            } else {
              // Add new record (invoice._id is used as unique index _id)
              try {
                await db.invoices.add(invoice);
              } catch (addErr) {
                // If add fails due to constraint, try to find and update by existing primary key
                if (addErr.name === 'ConstraintError') {
                  try {
                    const fallback = await db.invoices.where('_id').equals(String(invoice._id)).first();
                    if (fallback && fallback.id !== undefined) await db.invoices.update(fallback.id, invoice);
                  } catch (e) { /* swallow */ }
                } else {
                  console.warn(`[InvoicesPage] Failed to add invoice ${invoice._id}:`, addErr);
                }
              }
            }
          } catch (putErr) {
            console.warn(`[InvoicesPage] Failed to sync invoice ${invoice._id}:`, putErr);
            // Continue with next invoice even if one fails
          }
        }

        // 4. After all async operations are complete, read from the DB and update the state.
        try {
          const updatedLocalInvoices = await db.invoices.orderBy('dueDate').reverse().toArray();
          // Enrich invoices with resolved customerName when missing
          const enriched = await Promise.all(updatedLocalInvoices.map(async (inv) => {
            if (inv.customerName) return inv;
            const byId = await db.customers.where('_id').equals(String(inv.customerId)).first();
            if (byId && byId.name) return { ...inv, customerName: byId.name };
            try {
              const byPk = await db.customers.get(inv.customerId);
              if (byPk && byPk.name) return { ...inv, customerName: byPk.name };
            } catch (e) { /* ignore */ }
            return { ...inv, customerName: '[Deleted Customer]' };
          }));
          setInvoices(enriched);
          setError(null); // Clear any previous errors
        } catch (dbReadErr) {
          console.error('Dexie read failed after sync:', dbReadErr);
          // Try to reopen the DB once to recover from upgrade/closed state
          try { await db.open(); } catch (openErr) { console.warn('Failed to reopen DB after read error', openErr); }
          try {
            const updatedLocalInvoices = await db.invoices.orderBy('dueDate').reverse().toArray();
            const enriched = await Promise.all(updatedLocalInvoices.map(async (inv) => {
              if (inv.customerName) return inv;
              const byId = await db.customers.where('_id').equals(String(inv.customerId)).first();
              if (byId && byId.name) return { ...inv, customerName: byId.name };
              try {
                const byPk = await db.customers.get(inv.customerId);
                if (byPk && byPk.name) return { ...inv, customerName: byPk.name };
              } catch (e) { /* ignore */ }
              return { ...inv, customerName: '[Deleted Customer]' };
            }));
            setInvoices(enriched);
          } catch (finalDbErr) {
            console.error('Final attempt to read local invoices failed', finalDbErr);
            setInvoices([]);
            setError('Local database unavailable. Please reload the page.');
          }
        }

      } catch (err) {
        // 5. If the network fails, load data from the local database as a fallback.
        setError('You are offline. Displaying locally saved data.');
        console.log('Failed to sync invoices, loading from local DB:', err);

        // Attempt to read from local DB safely. If the DB is closed, try reopening once.
        try {
          const localInvoices = await db.invoices.orderBy('dueDate').reverse().toArray();
          setInvoices(localInvoices);
        } catch (localReadErr) {
          console.warn('Initial local DB read failed, attempting to reopen DB...', localReadErr);
          try {
            await db.open();
            const localInvoices = await db.invoices.orderBy('dueDate').reverse().toArray();
            setInvoices(localInvoices);
          } catch (finalLocalErr) {
            console.error('Failed to read local invoices after attempting to reopen DB', finalLocalErr);
            setInvoices([]);
            setError('Local database unavailable. Please reload the page.');
          }
        }
      } finally {
        // 6. Finally, update the loading and fetching states to allow future updates.
        setLoading(false);
        isFetchingRef.current = false; // Release the lock
      }
    };

      fetchInvoices();
    }, [isLoaded]);

  const handleAddInvoice = async (invoiceData) => {
    try {
      const localId = crypto.randomUUID();

      // Prepare payload and ensure numeric totals and string _id
      const payload = sanitizeForDb({ _id: localId, ...invoiceData, status: 'draft', syncStatus: 'pending' }, { flattenCustomer: true });
      // Optimistically add to the local database
      await db.invoices.add(payload);

      // Add a job to the sync queue (include _id in the payload sent to server)
      await db.syncQueue.add({
        entity: 'invoices',
        action: 'create',
        entityId: localId,
        payload: { _id: localId, ...invoiceData },
        tempId: localId, // Pass the UUID to the sync job
        timestamp: new Date().toISOString(),
      });

      // Wait for sync queue to process this item (up to 10 seconds)
      let attempts = 0;
      while (attempts < 20) {
        const pending = await db.syncQueue.where('entityId').equals(localId).toArray();
        if (pending.length === 0) {
          console.log('[InvoicesPage] Invoice sync completed successfully');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before checking again
        attempts++;
      }

      // Update UI
      const updatedInvoices = await db.invoices.orderBy('dueDate').reverse().toArray();
      setInvoices(updatedInvoices);
      setShowAddForm(false);
    } catch (err) {
      setError('Failed to save invoice locally.');
      console.error('Add invoice error:', err);
    }
  };

  const handleDeleteInvoice = async (invoiceId) => {
    try {
      // Optimistically delete from the local database (delete by _id index)
      await db.invoices.where('_id').equals(String(invoiceId)).delete();
      // Add a job to the sync queue
      await db.syncQueue.add({
        entity: 'invoices',
        entityId: invoiceId,
        action: 'delete',
        timestamp: new Date().toISOString(),
      });
      // Update UI
      setInvoices(invoices.filter((invoice) => invoice._id !== invoiceId));
    } catch (err) {
      setError('Failed to delete invoice locally.');
    }
  }

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';
  const cardBg = theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  // Pagination
  const [searchParams, setSearchParams] = useSearchParams();
  const PAGE_SIZE = 5;
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const currentPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const totalPages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  const pagedInvoices = invoices.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Clamp page when invoice list changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setSearchParams({ page: String(totalPages) });
    }
  }, [currentPage, totalPages, setSearchParams]);

  if (loading && invoices.length === 0) {
    return <div className={`p-8 text-center ${textColor}`}>Loading invoices...</div>;
  }

  if (error) {
    return (
      <div className={`p-8 text-center text-red-500`}>
        <p>{error}</p>
        <Button onClick={() => setError(null)} variant="secondary" className="mt-4">
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className={`mb-8 p-6 rounded-lg shadow-md ${cardBg}`}>
        <h1 className={`text-3xl font-bold ${textColor}`}>
          Welcome back, {user?.firstName || 'User'}!
        </h1>
        <h2 className={`text-2xl font-semibold mt-2 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
          Manage Your Invoices
        </h2>
        <p className={`mt-2 text-md ${secondaryTextColor}`}>
          Create new invoices, track their status, and manage payments. You can also generate invoices from scanned documents using the OCR tool on the Records page.
        </p>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className={`text-2xl font-bold ${textColor}`}>All Invoices</h2>
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)} variant="primary">
            Add Invoice
          </Button>
        )}
      </div>

      {showAddForm && (
        <AddInvoiceForm
          onSaveInvoice={handleAddInvoice}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <div className="space-y-4 mt-6">
        {invoices.length > 0 ? pagedInvoices.map((invoice) => (
          <div key={invoice._id} className={`p-4 border rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${cardBg}`}>
            <div className="flex-grow">
              <Link to={`/invoices/${invoice._id}`} className={`font-bold text-lg hover:underline ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                Invoice {invoice.invoiceNumber}
              </Link>
              <p className={secondaryTextColor}>To: {invoice.customerName || '[Deleted Customer]'} - <span className="font-medium">${(Number(invoice.total) || 0).toFixed(2)}</span></p>
            </div>
            <div className="flex items-center gap-4">
              <div className={`p-1 px-3 rounded-full text-xs font-bold uppercase ${
                  invoice.status === 'paid' ? 'bg-green-100 text-green-800' : 
                  invoice.status === 'sent' ? 'bg-blue-100 text-blue-800' : 
                  invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
              }`}>
                {invoice.status === 'sent' ? 'sent, pending' : invoice.status}
              </div>
              {invoice.status === 'draft' && (
                <Button onClick={() => handleDeleteInvoice(invoice._id)} variant="danger" size="sm">Delete</Button>
              )}
            </div>
          </div>
        )) : <p className={`text-center py-8 ${secondaryTextColor}`}>No invoices found. Click "Add Invoice" to get started.</p>}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setSearchParams({ page: String(Math.max(1, currentPage - 1)) })}
            disabled={currentPage === 1}
            className={`px-3 py-1 rounded ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : (theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300')}`}
          >
            Prev
          </button>

          {Array.from({ length: totalPages }).map((_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                onClick={() => setSearchParams({ page: String(p) })}
                className={`px-3 py-1 rounded ${p === currentPage ? (theme === 'dark' ? 'bg-red-400 text-gray-900' : 'bg-red-500 text-white') : (theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200')}`}
              >
                {p}
              </button>
            );
          })}

          <button
            onClick={() => setSearchParams({ page: String(Math.min(totalPages, currentPage + 1)) })}
            disabled={currentPage === totalPages}
            className={`px-3 py-1 rounded ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : (theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300')}`}
          >
            Next
          </button>
        </div>
      )}

    </div>
  );
};

export default InvoicesPage;
