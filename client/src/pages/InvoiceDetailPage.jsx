import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth, useUser } from '@clerk/clerk-react';
import Button from '../components/Button';
import { makePayment } from '../services/paymentService';
import { getInvoice, sendInvoice, updateInvoice } from '../services/invoiceService';
import api from '../services/api';
import PaymentForm from '../components/PaymentForm';
import AddInvoiceForm from '../components/AddInvoiceForm';
import db from '../db'; // Import the Dexie database instance
import { sanitizeForDb } from '../services/dbUtils';

const InvoiceDetailPage = () => {
  const { id } = useParams();
  const { theme } = useTheme();
  const { isLoaded } = useAuth();
  const { user } = useUser();
  const pollIntervalRef = useRef(null);

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    const userRole = user?.publicMetadata?.role;

    const fetchInvoice = async () => {
      try {
        setLoading(true);
        // 1. Get invoice from the local database first for instant UI.
        const localInvoice = await db.invoices.where('_id').equals(id).first();
        if (localInvoice) {
          const resolvedName = await (async () => {
            if (localInvoice.customerName) return localInvoice.customerName;
            const byId = await db.customers.where('_id').equals(String(localInvoice.customerId)).first();
            if (byId && byId.name) return byId.name;
            // Try numeric primary key lookup as a fallback
            try {
              const byPk = await db.customers.get(localInvoice.customerId);
              if (byPk && byPk.name) return byPk.name;
            } catch (e) { /* ignore */ }
            return '[Deleted Customer]';
          })();
          setInvoice({ ...localInvoice, customerName: resolvedName });
        }

        // 2. Try to sync with the server to get the latest data.
        // Use the appropriate endpoint based on user role: customers use portal endpoint.
        try {
          let serverInvoice;
          if (userRole === 'seller') {
            // Sellers fetch their own invoices from /invoices/{id}
            serverInvoice = await getInvoice(id);
          } else {
            // Customers fetch invoices from /portal/invoices/{id}
            const response = await api.get(`/portal/invoices/${id}`);
            serverInvoice = response.data;
          }
          // Sanitize `_id` and flatten customer before writing to Dexie
          const sanitized = sanitizeForDb(serverInvoice, { flattenCustomer: true });
          // Use an _id-aware update/put to avoid unique-index ConstraintError
          try {
            // Find existing by the unique `_id` index
            const existing = await db.invoices.where('_id').equals(String(sanitized._id)).first();
            if (sanitized.status === 'draft') {
              if (existing && existing.status === 'sent') {
                // Keep the sent status, only update other fields
                const { status, ...otherFields } = sanitized;
                if (existing.id !== undefined) {
                  await db.invoices.update(existing.id, { ...otherFields });
                } else {
                  await db.invoices.put({ ...existing, ...otherFields });
                }
              } else {
                if (existing && existing.id !== undefined) {
                  await db.invoices.put({ ...sanitized, id: existing.id });
                } else {
                  await db.invoices.put(sanitized);
                }
              }
            } else {
              if (existing && existing.id !== undefined) {
                await db.invoices.put({ ...sanitized, id: existing.id });
              } else {
                await db.invoices.put(sanitized);
              }
            }
          } catch (putErr) {
            console.warn('[InvoiceDetailPage] Constraint error writing invoice to Dexie (non-fatal):', putErr);
          }
          // Always use local DB state for UI (may have pending changes not yet synced to server)
          const latestInvoice = await db.invoices.where('_id').equals(id).first();
          if (latestInvoice) {
            const resolvedName = await (async () => {
              if (latestInvoice.customerName) return latestInvoice.customerName;
              const byId = await db.customers.where('_id').equals(String(latestInvoice.customerId)).first();
              if (byId && byId.name) return byId.name;
              try {
                const byPk = await db.customers.get(latestInvoice.customerId);
                if (byPk && byPk.name) return byPk.name;
              } catch (e) { /* ignore */ }
              return '[Deleted Customer]';
            })();
            setInvoice({ ...latestInvoice, customerName: resolvedName });
          }
        } catch (syncErr) {
          // 404 is expected for newly created invoices not yet synced to the server
          if (syncErr.response?.status === 404) {
            console.log('Invoice not yet synced to server, using local data');
          } else {
            console.error('Failed to sync invoice details:', syncErr);
          }
          // If sync fails, use the local data (no page-level error).
        }

      } catch (err) {
        setError('Failed to fetch invoice details.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [id, isLoaded, user]);

  const handlePayNow = () => {
    setShowPaymentForm(true);
  };

  const handlePaymentSubmit = async (paymentDetails) => {
    setPaymentLoading(true);
    try {
      await makePayment(id, paymentDetails);
      alert('Payment initiated successfully! We will update the status once payment is confirmed.');
      setShowPaymentForm(false);

      // Clear any existing polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      const pollInterval = 5000; // 5 seconds
      const maxAttempts = 24; // 24 attempts * 5 seconds = 120 seconds (2 minutes)
      let attempts = 0;

      const poll = setInterval(async () => {
        attempts++;
        try {
          const userRole = user?.publicMetadata?.role;
          const endpoint = userRole === 'seller' ? `/invoices/${id}` : `/portal/invoices/${id}`;
          const response = await api.get(endpoint);
          
          if (response.data.status === 'paid' || attempts >= maxAttempts) {
            setInvoice(response.data); // Update with latest data regardless
            clearInterval(poll);
            pollIntervalRef.current = null;
            if (response.data.status !== 'paid' && attempts >= maxAttempts) {
              setError('Payment status check timed out. Please refresh the page to see the latest status.');
            }
          }
        } catch (err) {
          clearInterval(poll);
          pollIntervalRef.current = null;
          console.error('Polling for invoice status failed:', err);
        }
      }, pollInterval);
      pollIntervalRef.current = poll;

    } catch (err) {
      setError('Failed to initiate payment. Please try again.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleSendInvoice = async () => {
    setSending(true);
      try {
      // Optimistically update the local database (lookup primary key by `_id`)
      const existing = await db.invoices.where('_id').equals(id).first();
      if (existing && existing.id !== undefined) {
        await db.invoices.update(existing.id, { status: 'sent', syncStatus: 'pending' });
      } else {
        // If not present, create a minimal placeholder that will be replaced by sync
        await db.invoices.put({ _id: id, status: 'sent', syncStatus: 'pending' });
      }

      // Add a job to the sync queue to call the 'send' endpoint
      await db.syncQueue.add({
        entity: 'invoices',
        action: 'send', // We can add a custom action type if needed, or treat as update
        entityId: id,
        payload: { action: 'send' }, // Payload indicates the action
        timestamp: new Date().toISOString(),
      });

      // Update UI immediately
      setInvoice({ ...invoice, status: 'sent' });

      // Wait for sync queue to process this item (up to 10 seconds)
      let attempts = 0;
      while (attempts < 20) {
        const pending = await db.syncQueue.where('entityId').equals(id).toArray();
        if (pending.length === 0) {
          console.log('[Send] Invoice sync completed successfully');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before checking again
        attempts++;
      }
    } catch (err) {
      setError('Failed to update invoice locally.');
      console.error('Send invoice error:', err);
    } finally {
      setSending(false);
    }
  };

  const handleUpdateInvoice = async (invoiceData) => {
    try {
      // Optimistically update the local database (lookup primary key by `_id`)
      const existing = await db.invoices.where('_id').equals(id).first();
      if (existing && existing.id !== undefined) {
        await db.invoices.update(existing.id, { ...invoiceData, syncStatus: 'pending' });
      } else {
        await db.invoices.put({ _id: id, ...invoiceData, syncStatus: 'pending' });
      }

      // Add a job to the sync queue
      await db.syncQueue.add({
        entity: 'invoices',
        action: 'update',
        entityId: id,
        payload: invoiceData,
        timestamp: new Date().toISOString(),
      });

      setInvoice({ ...invoice, ...invoiceData }); // Update the local state
      setShowEditForm(false); // Hide the form on success
    } catch (err) {
      setError('Failed to update invoice. Please try again.');
    }
  };

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const cardBg = theme === 'dark' ? 'bg-gray-800' : 'bg-white';

  if (loading) return <div className={`p-8 text-center ${textColor}`}>Loading invoice...</div>;
  if (error) return <div className={`p-8 text-center text-red-500`}>{error}</div>;
  if (!invoice) return <div className={`p-8 text-center ${textColor}`}>Invoice not found.</div>;

  // Determine if the logged-in user is the one who created the invoice
  const isInvoiceCreator = user && invoice && user.id === invoice.user;

  return (
    <div className={`p-4 sm:p-6 lg:p-8 ${textColor}`}>
      <div className="mb-4">
        <Link to={user?.publicMetadata?.role === 'seller' ? '/invoices' : '/customer-dashboard'} className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
          &larr; Back to Dashboard
        </Link>
      </div>
      {showPaymentForm && (
        <PaymentForm
          invoice={invoice}
          onPayment={handlePaymentSubmit}
          onCancel={() => setShowPaymentForm(false)}
          loading={paymentLoading}
        />
      )}

      {showEditForm ? (
        <div className={`p-6 rounded-lg shadow-md ${cardBg}`}>
          <AddInvoiceForm
            invoiceToEdit={invoice}
            onSaveInvoice={handleUpdateInvoice}
            onCancel={() => setShowEditForm(false)}
          />
        </div>
      ) : (
        <div className={`p-6 rounded-lg shadow-md ${cardBg}`}>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">Invoice {invoice.invoiceNumber}</h1>
              <p className="text-gray-500">To: {invoice.customerName}</p>
            </div>
            <div className={`text-right p-2 rounded-lg ${
              invoice.status === 'paid' ? 'bg-green-100 text-green-800' : 
              invoice.status === 'sent' ? 'bg-blue-100 text-blue-800' : 
              'bg-yellow-100 text-yellow-800'
            }`}>
              <span className="font-bold uppercase text-sm">
                {user?.publicMetadata?.role === 'seller'
                  ? (invoice.status === 'sent' ? 'sent, pending' : invoice.status)
                  : (invoice.status === 'sent' ? 'pending' : invoice.status)
                }
              </span>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-xl font-semibold">Total Amount: ${(Number(invoice.total) || 0).toFixed(2)}</h2>
            <p className="text-gray-500">Due Date: {new Date(invoice.dueDate).toLocaleDateString()}</p>
          </div>

          <div className="mt-8 flex justify-end gap-4">
            {isInvoiceCreator && invoice.status === 'draft' && (
              <Button onClick={handleSendInvoice} disabled={sending} variant="secondary">
                {sending ? 'Sending...' : 'Send Invoice'}
              </Button>
            )}
            {isInvoiceCreator && ['draft', 'sent'].includes(invoice.status) && (
              <Button onClick={() => setShowEditForm(true)} variant="secondary">Edit</Button>
            )}
            {user?.publicMetadata?.role !== 'seller' && invoice.status !== 'paid' && (
              <Button onClick={handlePayNow} disabled={paymentLoading} variant="primary">
                {paymentLoading ? 'Processing...' : 'Pay Now'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceDetailPage;
