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
      const response = await makePayment(id, paymentDetails);
      
      // For card payments, redirect to payment URL
      if (paymentDetails.paymentMethod === 'card' && response.url) {
        window.location.href = response.url;
        return;
      }
      
      // For M-Pesa, show success message and poll for status
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
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';
  const cardBg = theme === 'dark' ? 'bg-gray-800' : 'bg-white';

  if (loading) return <div className={`p-8 text-center ${textColor}`}>Loading invoice...</div>;
  if (error) return <div className={`p-8 text-center text-red-500`}>{error}</div>;
  if (!invoice) return <div className={`p-8 text-center ${textColor}`}>Invoice not found.</div>;

  // Determine if the logged-in user is the one who created the invoice
  const isInvoiceCreator = user && invoice && user.id === invoice.user;

  // Get status badge styling
  const getStatusBadge = (status, role) => {
    const displayStatus = role === 'seller' && status === 'sent' ? 'sent, pending' : status === 'sent' ? 'pending' : status;
    
    let badgeClass = '';
    let icon = null;
    
    if (status === 'paid') {
      badgeClass = theme === 'dark' ? 'bg-green-900/40 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-200';
      icon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    } else if (status === 'sent') {
      badgeClass = theme === 'dark' ? 'bg-blue-900/40 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200';
      icon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    } else {
      badgeClass = theme === 'dark' ? 'bg-yellow-900/40 text-yellow-300 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-200';
      icon = (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    }
    
    return { badgeClass, displayStatus, icon };
  };

  const statusInfo = getStatusBadge(invoice.status, user?.publicMetadata?.role);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Back Navigation */}
      <div className="mb-6">
        <Link to={user?.publicMetadata?.role === 'seller' ? '/invoices' : '/customer-dashboard'} className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to {user?.publicMetadata?.role === 'seller' ? 'Invoices' : 'Dashboard'}
        </Link>
      </div>

      {/* Payment Form Modal */}
      {showPaymentForm && (
        <div className={`mb-6 p-6 rounded-xl shadow-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
          <PaymentForm
            invoice={invoice}
            onPayment={handlePaymentSubmit}
            onCancel={() => setShowPaymentForm(false)}
            loading={paymentLoading}
          />
        </div>
      )}

      {/* Edit Form */}
      {showEditForm ? (
        <div className={`p-8 rounded-2xl shadow-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
          <h2 className={`text-2xl font-bold ${textColor} mb-6 flex items-center gap-2`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Invoice
          </h2>
          <AddInvoiceForm
            invoiceToEdit={invoice}
            onSaveInvoice={handleUpdateInvoice}
            onCancel={() => setShowEditForm(false)}
          />
        </div>
      ) : (
        <div className={`p-8 rounded-2xl shadow-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 pb-6 border-b border-gray-700/50 dark:border-gray-600/50">
            <div className="flex items-start gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 ${
                theme === 'dark' ? 'bg-red-900/40' : 'bg-red-100'
              }`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className={`text-4xl font-bold ${textColor} mb-2`}>Invoice #{invoice.invoiceNumber}</h1>
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${secondaryTextColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <p className={`text-lg ${secondaryTextColor}`}>To: <span className={`font-semibold ${textColor}`}>{invoice.customerName}</span></p>
                </div>
              </div>
            </div>
            <div className="text-left md:text-right">
              <span className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-base font-semibold border-2 ${statusInfo.badgeClass}`}>
                {statusInfo.icon}
                {statusInfo.displayStatus.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Invoice Details Section */}
          <div className="py-8 border-b border-gray-700/50 dark:border-gray-600/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-gray-700/30 border-gray-600/50' : 'bg-gray-50/50 border-gray-200/50'}`}>
                <div className="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 mt-1 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className={`text-sm font-medium ${secondaryTextColor} mb-2`}>Issue Date</p>
                    <p className={`text-lg font-semibold ${textColor}`}>{new Date(invoice.issueDate || invoice.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  </div>
                </div>
              </div>
              <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-gray-700/30 border-gray-600/50' : 'bg-gray-50/50 border-gray-200/50'}`}>
                <div className="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 mt-1 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className={`text-sm font-medium ${secondaryTextColor} mb-2`}>Due Date</p>
                    <p className={`text-lg font-semibold ${textColor}`}>{new Date(invoice.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  </div>
                </div>
              </div>
              <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-gray-700/30 border-gray-600/50' : 'bg-gray-50/50 border-gray-200/50'}`}>
                <div className="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 mt-1 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className={`text-sm font-medium ${secondaryTextColor} mb-2`}>Issued By</p>
                    <p className={`text-lg font-semibold ${textColor}`}>{user?.fullName || user?.firstName || 'Seller'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            {invoice.items && invoice.items.length > 0 && (
              <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-gray-700/30 border-gray-600/50' : 'bg-gray-50/50 border-gray-200/50'}`}>
                <h3 className={`text-xl font-semibold ${textColor} mb-4 flex items-center gap-2`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  Items Charged
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={`border-b ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                        <th className={`text-left py-3 px-4 ${secondaryTextColor} font-semibold`}>Description</th>
                        <th className={`text-center py-3 px-4 ${secondaryTextColor} font-semibold`}>Quantity</th>
                        <th className={`text-right py-3 px-4 ${secondaryTextColor} font-semibold`}>Unit Price</th>
                        <th className={`text-right py-3 px-4 ${secondaryTextColor} font-semibold`}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item, index) => (
                        <tr key={index} className={`border-b ${theme === 'dark' ? 'border-gray-700/50' : 'border-gray-200'}`}>
                          <td className={`py-3 px-4 ${textColor}`}>{item.description}</td>
                          <td className={`py-3 px-4 text-center ${textColor}`}>{item.quantity}</td>
                          <td className={`py-3 px-4 text-right ${textColor}`}>KSH {(Number(item.unitPrice) || 0).toFixed(2)}</td>
                          <td className={`py-3 px-4 text-right font-semibold ${textColor}`}>KSH {(Number(item.total) || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className={`border-t-2 ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                        <td colSpan="3" className={`py-3 px-4 text-right font-semibold ${textColor}`}>Subtotal:</td>
                        <td className={`py-3 px-4 text-right font-semibold ${textColor}`}>KSH {(Number(invoice.subTotal) || 0).toFixed(2)}</td>
                      </tr>
                      {invoice.tax > 0 && (
                        <tr>
                          <td colSpan="3" className={`py-2 px-4 text-right ${secondaryTextColor}`}>Tax:</td>
                          <td className={`py-2 px-4 text-right ${secondaryTextColor}`}>KSH {(Number(invoice.tax) || 0).toFixed(2)}</td>
                        </tr>
                      )}
                      <tr className={`border-t ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                        <td colSpan="3" className={`py-3 px-4 text-right text-xl font-bold ${textColor}`}>Total:</td>
                        <td className={`py-3 px-4 text-right text-2xl font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>KSH {(Number(invoice.total) || 0).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Fallback if no line items */}
            {(!invoice.items || invoice.items.length === 0) && (
              <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-gray-700/30 border-gray-600/50' : 'bg-gray-50/50 border-gray-200/50'}`}>
                <div className="flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 mt-1 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className={`text-sm font-medium ${secondaryTextColor} mb-2`}>Total Amount</p>
                    <p className={`text-4xl font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>KSH {(Number(invoice.total) || 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions Section */}
          <div className="pt-8 flex flex-col sm:flex-row justify-end gap-4">
            {isInvoiceCreator && invoice.status === 'draft' && (
              <Button onClick={handleSendInvoice} disabled={sending} variant="secondary" size="lg">
                <span className="flex items-center gap-2">
                  {sending ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Invoice
                    </>
                  )}
                </span>
              </Button>
            )}
            {isInvoiceCreator && ['draft', 'sent'].includes(invoice.status) && (
              <Button onClick={() => setShowEditForm(true)} variant="secondary" size="lg">
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Edit Invoice
                </span>
              </Button>
            )}
            {user?.publicMetadata?.role !== 'seller' && invoice.status !== 'paid' && (
              <Button onClick={handlePayNow} disabled={paymentLoading} variant="primary" size="lg">
                <span className="flex items-center gap-2">
                  {paymentLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      Pay Now
                    </>
                  )}
                </span>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceDetailPage;
