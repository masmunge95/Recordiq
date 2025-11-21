import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '@clerk/clerk-react';
import { getUtilityServices } from '../services/utilityService';
import Button from '../components/Button';
import { useSearchParams } from 'react-router-dom';
import Modal from '../components/Modal';
import ServiceForm from '../components/ServiceForm';
import db from '../db'; // Import the Dexie database instance
import { sanitizeArrayForDb, sanitizeForDb } from '../services/dbUtils';

const UtilityServicesPage = () => {
  const { theme } = useTheme();
  const { isLoaded } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState(null);

  useEffect(() => {
    if (!isLoaded) {
      return; // Wait for Clerk to be ready
    }

    const fetchServices = async () => {
      setLoading(true);
      setError(null);

      // 1. Get services from the local database first for instant UI.
      const localServices = await db.utilityServices.toArray();
      setServices(localServices);

      // 2. Try to sync with the server to get the latest data.
      try {
        const serverServices = await getUtilityServices();
        // Check if exists, then update or insert
        const sanitized = sanitizeArrayForDb(serverServices);
        for (const service of sanitized) {
          try {
            const existing = await db.utilityServices.get(service._id);
            if (existing) {
              try {
                await db.utilityServices.update(service._id, service);
              } catch (updateErr) {
                // Suppress constraint errors on update - data is still valid
                if (updateErr.name === 'ConstraintError') {
                  console.debug(`[UtilityServicesPage] Constraint error updating service (ignorable): ${service._id}`);
                } else {
                  console.warn(`[UtilityServicesPage] Error updating service ${service._id}:`, updateErr);
                }
              }
            } else {
              try {
                await db.utilityServices.add(service);
              } catch (addErr) {
                // If add fails due to constraint, try update instead
                if (addErr.name === 'ConstraintError') {
                  console.debug(`[UtilityServicesPage] Service already exists, updating: ${service._id}`);
                  try {
                    await db.utilityServices.update(service._id, service);
                  } catch (fallbackErr) {
                    console.warn(`[UtilityServicesPage] Failed to add/update service ${service._id}:`, fallbackErr);
                  }
                } else {
                  console.warn(`[UtilityServicesPage] Failed to add service ${service._id}:`, addErr);
                }
              }
            }
          } catch (putErr) {
            console.warn(`[UtilityServicesPage] Failed to sync service ${service._id}:`, putErr);
          }
        }
        const updatedLocalServices = await db.utilityServices.toArray();
        setServices(updatedLocalServices);
      } catch (err) {
        setError('Could not connect to the server. Displaying offline data.');
        console.error('Failed to sync utility services:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, [isLoaded]);

  const handleOpenModal = (service = null) => {
    setServiceToEdit(service);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setServiceToEdit(null);
  };

  const handleSaveService = async (serviceData) => {
    try {
      if (serviceToEdit) {
        // Optimistically update in the local database
        await db.utilityServices.update(serviceToEdit._id, { ...serviceData, syncStatus: 'pending' });
        // Add a job to the sync queue
        await db.syncQueue.add({
          entity: 'utilityServices',
          action: 'update',
          entityId: serviceToEdit._id,
          payload: { _id: serviceToEdit._id, ...serviceData },
          timestamp: new Date().toISOString(),
        });
        
        // Wait for sync queue to process this item (up to 10 seconds)
        let attempts = 0;
        while (attempts < 20) {
          const pending = await db.syncQueue.where('entityId').equals(serviceToEdit._id).toArray();
          if (pending.length === 0) {
            console.log('[UtilityServices] Service sync completed successfully');
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before checking again
          attempts++;
        }
      } else {
        // Optimistically add to the local database
        const localId = crypto.randomUUID();
        await db.utilityServices.add(sanitizeForDb({
          _id: localId,
          ...serviceData,
          syncStatus: 'pending',
        }));
        // Add a job to the sync queue
        await db.syncQueue.add({
          entity: 'utilityServices',
          action: 'create',
          entityId: localId,
          payload: { _id: localId, ...serviceData },
          tempId: localId,
          timestamp: new Date().toISOString(),
        });
        
        // Wait for sync queue to process this item (up to 10 seconds)
        let attempts = 0;
        while (attempts < 20) {
          const pending = await db.syncQueue.where('entityId').equals(localId).toArray();
          if (pending.length === 0) {
            console.log('[UtilityServices] Service creation sync completed successfully');
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before checking again
          attempts++;
        }
      }
      // Update UI from local DB after sync completes
      const updatedServices = await db.utilityServices.toArray();
      setServices(updatedServices);
      handleCloseModal();
    } catch (err) {
      setError(serviceToEdit ? 'Failed to update service.' : 'Failed to create service.');
      console.error('Service save error:', err);
    }
  };

  const handleDeleteService = async (id) => {
    if (window.confirm('Are you sure you want to delete this service?')) {
      try {
        // Optimistically delete from the local database
        await db.utilityServices.delete(id);
        // Add a job to the sync queue
        await db.syncQueue.add({
          entity: 'utilityServices',
          entityId: id,
          action: 'delete',
          timestamp: new Date().toISOString(),
        });
        // Update UI
        setServices(services.filter(s => s._id !== id));
      } catch (err) {
        setError('Failed to delete service locally.');
      }
    }
  };

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';
  const cardBg = theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  // Pagination
  const [searchParams, setSearchParams] = useSearchParams();
  const PAGE_SIZE = 5;
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const currentPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const totalPages = Math.max(1, Math.ceil(services.length / PAGE_SIZE));
  const pagedServices = services.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) {
      setSearchParams({ page: String(totalPages) });
    }
  }, [currentPage, totalPages, setSearchParams]);

  if (loading) return <div className={`p-8 text-center ${textColor}`}>Loading services...</div>;

  return (
    <div className="px-0 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className={`mb-4 sm:mb-6 md:mb-8 mx-3 sm:mx-0 p-4 sm:p-6 md:p-8 rounded-2xl shadow-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className={`text-4xl font-bold mb-2 ${textColor}`}>Utility Services</h1>
            <p className={`text-lg ${secondaryTextColor}`}>
              Manage your service offerings, pricing, and fees in one place
            </p>
          </div>
          <Button onClick={() => handleOpenModal()} variant="primary" className="whitespace-nowrap">
            <span className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add New Service
            </span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-xl dark:bg-red-200 dark:text-red-800 flex items-center justify-between" role="alert">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span><span className="font-medium">Error:</span> {error}</span>
          </div>
          <Button onClick={() => setError(null)} variant="secondary" size="sm">Dismiss</Button>
        </div>
      )}

      {/* Info Cards - Show when no services */}
      {pagedServices.length === 0 && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className={`p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className={`w-12 h-12 rounded-full mb-4 flex items-center justify-center ${theme === 'dark' ? 'bg-blue-900/40' : 'bg-blue-100'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className={`text-lg font-semibold mb-2 ${textColor}`}>Create Services</h3>
            <p className={`text-sm ${secondaryTextColor}`}>Define your utility services like electricity, water, or gas with custom pricing.</p>
          </div>
          
          <div className={`p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className={`w-12 h-12 rounded-full mb-4 flex items-center justify-center ${theme === 'dark' ? 'bg-green-900/40' : 'bg-green-100'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className={`text-lg font-semibold mb-2 ${textColor}`}>Set Pricing</h3>
            <p className={`text-sm ${secondaryTextColor}`}>Configure unit prices and additional fees for accurate billing calculations.</p>
          </div>
          
          <div className={`p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-800/80 border border-gray-700/50' : 'bg-white/80 border border-gray-200/50'}`}>
            <div className={`w-12 h-12 rounded-full mb-4 flex items-center justify-center ${theme === 'dark' ? 'bg-purple-900/40' : 'bg-purple-100'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className={`text-lg font-semibold mb-2 ${textColor}`}>Use in Invoices</h3>
            <p className={`text-sm ${secondaryTextColor}`}>Reference these services when creating customer invoices for consistent billing.</p>
          </div>
        </div>
      )}

      {/* Services List */}
      <div className="space-y-4">
        {pagedServices.length > 0 ? (
          <>
            <div className={`mb-4 px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100/80'}`}>
              <p className={`text-sm ${secondaryTextColor}`}>
                Showing <span className="font-semibold">{pagedServices.length}</span> of <span className="font-semibold">{services.length}</span> services
              </p>
            </div>
            {pagedServices.map(service => (
              <div key={service._id} className={`p-6 border rounded-xl shadow-md backdrop-blur-sm transition-all hover:shadow-lg ${theme === 'dark' ? 'bg-gray-800/80 border-gray-700/50' : 'bg-white/80 border-gray-200/50'}`}>
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-red-900/40' : 'bg-red-100'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <h3 className={`text-2xl font-bold ${textColor}`}>{service.name}</h3>
                    </div>
                    
                    <div className={`flex items-center gap-2 mb-2 ${secondaryTextColor}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-lg">
                        Unit Price: <span className={`font-bold ${textColor}`}>KSH {(Number(service.unitPrice) || 0).toFixed(2)}</span> per unit
                      </span>
                    </div>
                    
                    {service.fees && service.fees.length > 0 && (
                      <div className={`mt-4 p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                        <p className={`text-sm font-semibold mb-2 flex items-center gap-2 ${textColor}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          Additional Fees
                        </p>
                        <ul className="space-y-2">
                          {service.fees.map((fee, index) => (
                            <li key={index} className={`flex items-center justify-between ${secondaryTextColor}`}>
                              <span>{fee.description}</span>
                              <span className="font-semibold">KSH {(Number(fee.amount) || 0).toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex md:flex-col gap-2">
                    <Button onClick={() => handleOpenModal(service)} variant="secondary" size="sm" className="flex-1 md:flex-none">
                      <span className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </span>
                    </Button>
                    <Button onClick={() => handleDeleteService(service._id)} variant="danger" size="sm" className="flex-1 md:flex-none">
                      <span className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className={`text-center py-16 px-6 rounded-2xl ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50/80'}`}>
            <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${secondaryTextColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className={`text-2xl font-bold mb-2 ${textColor}`}>No Services Yet</h3>
            <p className={`mb-6 max-w-md mx-auto ${secondaryTextColor}`}>
              Get started by creating your first utility service. Define your pricing structure and start generating professional invoices.
            </p>
            <Button onClick={() => handleOpenModal()} variant="primary">
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Create Your First Service
              </span>
            </Button>
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
            const page = i + 1;
            return (
              <button
                key={page}
                onClick={() => setSearchParams({ page: String(page) })}
                className={`px-3 py-1 rounded ${page === currentPage ? (theme === 'dark' ? 'bg-red-400 text-gray-900' : 'bg-red-500 text-white') : (theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200')}`}
              >
                {page}
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

      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
          <ServiceForm
            onSave={handleSaveService}
            onCancel={handleCloseModal}
            serviceToEdit={serviceToEdit}
          />
        </Modal>
      )}
    </div>
  );
};

export default UtilityServicesPage;