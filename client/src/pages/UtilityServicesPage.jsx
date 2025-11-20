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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className={`text-3xl font-bold ${textColor}`}>My Utility Services</h1>
        <Button onClick={() => handleOpenModal()} variant="primary">
          Add New Service
        </Button>
      </div>

      {error && (
        <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-200 dark:text-red-800" role="alert">
          <span className="font-medium">Error:</span> {error}
          <Button onClick={() => setError(null)} variant="secondary" size="sm" className="ml-4">Close</Button>
        </div>
      )}

      <div className="space-y-4">
        {pagedServices.length > 0 ? (
          pagedServices.map(service => (
            <div key={service._id} className={`p-4 border rounded-lg shadow-sm ${cardBg}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className={`text-xl font-bold ${textColor}`}>{service.name}</h3>
                  <p className={secondaryTextColor}>Unit Price: ${(Number(service.unitPrice) || 0).toFixed(2)}</p>
                  {service.fees && service.fees.length > 0 && (
                    <div className="mt-2">
                      <p className={`text-sm font-semibold ${textColor}`}>Additional Fees:</p>
                      <ul className="list-disc list-inside">
                        {service.fees.map((fee, index) => (
                          <li key={index} className={secondaryTextColor}>
                            {fee.description}: ${(Number(fee.amount) || 0).toFixed(2)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleOpenModal(service)} variant="secondary" size="sm">Edit</Button>
                  <Button onClick={() => handleDeleteService(service._id)} variant="danger" size="sm">Delete</Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className={`text-center py-8 ${secondaryTextColor}`}>
            No utility services found. Click "Add New Service" to create one.
          </p>
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