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

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = 'Invoice-List';
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 100);
  };

  const handleDownloadCSV = () => {
    // Prepare CSV headers
    const headers = ['Invoice Number', 'Customer', 'Issue Date', 'Due Date', 'Total', 'Status'];
    
    // Prepare CSV rows
    const rows = invoices.map(invoice => [
      invoice.invoiceNumber || '',
      invoice.customerName || '',
      invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : new Date(invoice.createdAt).toLocaleDateString(),
      invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '',
      `KSH ${(Number(invoice.total) || 0).toFixed(2)}`,
      invoice.status || ''
    ]);
    
    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
    <div className="px-0 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className={`mb-4 sm:mb-6 md:mb-8 mx-3 sm:mx-0 p-4 sm:p-6 md:p-8 rounded-2xl shadow-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className={`text-4xl font-bold mb-2 ${textColor}`}>
              <span className="inline-flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Invoice Management
              </span>
            </h1>
            <p className={`text-lg ${secondaryTextColor}`}>
              Create, track, and manage your invoices
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!showAddForm && invoices.length > 0 && (
              <>
                <Button onClick={handlePrint} variant="secondary" size="md" className="print:hidden">
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print
                  </span>
                </Button>
                <Button onClick={handleDownloadCSV} variant="secondary" size="md" className="print:hidden">
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export CSV
                  </span>
                </Button>
              </>
            )}
            {!showAddForm && (
              <Button onClick={() => setShowAddForm(true)} variant="primary" className="whitespace-nowrap">
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Create Invoice
                </span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {!showAddForm && invoices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8">
          <div className={`p-6 rounded-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-blue-900/40' : 'bg-blue-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className={`text-sm ${secondaryTextColor}`}>Total Invoices</p>
                <p className={`text-3xl font-bold ${textColor}`}>{invoices.length}</p>
              </div>
            </div>
          </div>
          
          <div className={`p-6 rounded-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-green-900/40' : 'bg-green-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className={`text-sm ${secondaryTextColor}`}>Paid</p>
                <p className={`text-3xl font-bold ${textColor}`}>{invoices.filter(inv => inv.status === 'paid').length}</p>
              </div>
            </div>
          </div>
          
          <div className={`p-6 rounded-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-yellow-900/40' : 'bg-yellow-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className={`text-sm ${secondaryTextColor}`}>Pending</p>
                <p className={`text-3xl font-bold ${textColor}`}>{invoices.filter(inv => inv.status === 'sent').length}</p>
              </div>
            </div>
          </div>
          
          <div className={`p-6 rounded-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-purple-900/40' : 'bg-purple-100'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className={`text-sm ${secondaryTextColor}`}>Total Value</p>
                <p className={`text-3xl font-bold ${textColor}`}>KSH {invoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <AddInvoiceForm
          onSaveInvoice={handleAddInvoice}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Invoice Cards */}
      <div className="space-y-4">
        {invoices.length > 0 ? (
          <>
            <div className={`mb-4 px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100/80'}`}>
              <p className={`text-sm ${secondaryTextColor}`}>
                Showing <span className="font-semibold">{pagedInvoices.length}</span> of <span className="font-semibold">{invoices.length}</span> invoice{invoices.length !== 1 ? 's' : ''}
              </p>
            </div>
            {pagedInvoices.map((invoice) => {
              const statusConfig = {
                paid: { bg: 'bg-green-100 dark:bg-green-500', text: 'text-green-800 dark:text-white', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                sent: { bg: 'bg-blue-100 dark:bg-blue-500', text: 'text-blue-800 dark:text-white', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                overdue: { bg: 'bg-red-100 dark:bg-red-500', text: 'text-red-800 dark:text-white', icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                draft: { bg: 'bg-yellow-100 dark:bg-yellow-500', text: 'text-yellow-800 dark:text-gray-900', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' }
              };
              const status = invoice.status || 'draft';
              const config = statusConfig[status] || statusConfig.draft;
              
              return (
                <div key={invoice._id} className={`p-6 border rounded-xl shadow-md backdrop-blur-sm transition-all hover:shadow-lg ${theme === 'dark' ? 'bg-gray-800/80 border-gray-700/50' : 'bg-white/80 border-gray-200/50'}`}>
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-red-900/40' : 'bg-red-100'}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <Link to={`/invoices/${invoice._id}`} className={`font-bold text-2xl hover:underline ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                            #{invoice.invoiceNumber}
                          </Link>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className={`flex items-center gap-2 ${secondaryTextColor}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>{invoice.customerName || '[Deleted Customer]'}</span>
                        </div>
                        <div className={`flex items-center gap-2 ${textColor}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xl font-bold">KSH {(Number(invoice.total) || 0).toFixed(2)}</span>
                        </div>
                        {invoice.dueDate && (
                          <div className={`flex items-center gap-2 text-sm ${secondaryTextColor}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Due: {new Date(invoice.dueDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-3 items-end">
                      <div className={`px-4 py-2 rounded-full text-sm font-bold uppercase flex items-center gap-2 ${config.bg} ${config.text}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.icon} />
                        </svg>
                        {status === 'sent' ? 'Pending' : status}
                      </div>
                      <div className="flex gap-2">
                        <Link to={`/invoices/${invoice._id}`}>
                          <Button variant="secondary" size="sm">
                            <span className="flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View
                            </span>
                          </Button>
                        </Link>
                        {invoice.status === 'draft' && (
                          <Button onClick={() => handleDeleteInvoice(invoice._id)} variant="danger" size="sm">
                            <span className="flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div className={`text-center py-16 px-6 rounded-2xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50/80'}`}>
            <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${secondaryTextColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className={`text-2xl font-bold mb-2 ${textColor}`}>No Invoices Yet</h3>
            <p className={`mb-6 max-w-md mx-auto ${secondaryTextColor}`}>
              Create your first invoice to start tracking payments and managing customer billing.
            </p>
            {!showAddForm && (
              <Button onClick={() => setShowAddForm(true)} variant="primary">
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Create Your First Invoice
                </span>
              </Button>
            )}
          </div>
        )}
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
