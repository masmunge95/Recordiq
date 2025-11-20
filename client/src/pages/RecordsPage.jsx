import React, { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useTheme } from '../context/ThemeContext';
import { getRecords } from '../services/recordService'; // We only need getRecords for initial sync
import { Link, useSearchParams } from 'react-router-dom';
import { getFullImageUrl } from '../services/api';
import AddRecordForm from '../components/AddRecordForm';
import OcrUploader from '../components/OcrUploader';
import db from '../db'; // Import the Dexie database instance
import { sanitizeForDb, sanitizeArrayForDb } from '../services/dbUtils';
import Button from '../components/Button';


const RecordsPage = () => {
  const { isLoaded } = useAuth();
  const { user } = useUser();
  const { theme } = useTheme();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [ocrData, setOcrData] = useState({});
  // Pagination
  const [searchParams, setSearchParams] = useSearchParams();
  const PAGE_SIZE = 5;
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const currentPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  useEffect(() => {
    const fetchRecords = async () => {
      if (!isLoaded) return;
      setLoading(true);

      // 1. Get records from the local database first for instant UI.
      const localRecords = await db.records.orderBy('recordDate').reverse().toArray();
      setRecords(localRecords);

      // 2. Try to sync with the server to get the latest data.
      try {
        const serverRecords = await getRecords();
        // Check if exists, then update or insert
        const sanitized = sanitizeArrayForDb(serverRecords);
        for (const record of sanitized) {
          try {
            const existing = await db.records.get(record._id);
            if (existing) {
              try {
                await db.records.update(record._id, record);
              } catch (updateErr) {
                // Suppress constraint errors - data is still valid
                if (updateErr.name !== 'ConstraintError') {
                  console.warn(`[RecordsPage] Error updating record ${record._id}:`, updateErr);
                }
              }
            } else {
              try {
                await db.records.add(record);
              } catch (addErr) {
                // If add fails due to constraint, try update instead
                if (addErr.name === 'ConstraintError') {
                  try {
                    await db.records.update(record._id, record);
                  } catch (e) { /* swallow */ }
                } else {
                  console.warn(`[RecordsPage] Failed to add record ${record._id}:`, addErr);
                }
              }
            }
          } catch (putErr) {
            console.warn(`[RecordsPage] Failed to sync record ${record._id}:`, putErr);
          }
        }
        const updatedLocalRecords = await db.records.orderBy('recordDate').reverse().toArray();
        setRecords(updatedLocalRecords); // Re-render with fresh data
      } catch (err) {
        setError('Could not connect to the server. Displaying offline data.');
        console.error('Failed to sync records:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [isLoaded]);

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const pagedRecords = records.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Clamp page when records change
  useEffect(() => {
    if (currentPage > totalPages) {
      setSearchParams({ page: String(totalPages) });
    }
  }, [currentPage, totalPages, setSearchParams]);

  const handleAddRecord = async (formData) => {
    try {
      // Convert FormData to a plain object for Dexie and the sync queue
      const recordPayload = Object.fromEntries(formData.entries());
      const localId = crypto.randomUUID();
      
      // Optimistically add to the local database for instant UI update
      await db.records.add(sanitizeForDb({
        _id: localId,
        ...recordPayload,
        // Ensure correct types for Dexie
        amount: parseFloat(recordPayload.amount),
        recordDate: new Date(recordPayload.recordDate),
        syncStatus: 'pending', // Mark as needing sync
      }));

      // Add a job to the sync queue
      await db.syncQueue.add({
        entity: 'records',
        action: 'create',
        entityId: localId,
        payload: { _id: localId, ...recordPayload },
        tempId: localId,
        timestamp: new Date().toISOString(),
      });

      // Wait for sync queue to process this item (up to 10 seconds)
      let attempts = 0;
      while (attempts < 20) {
        const pending = await db.syncQueue.where('entityId').equals(localId).toArray();
        if (pending.length === 0) {
          console.log('[RecordsPage] Record sync completed successfully');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before checking again
        attempts++;
      }

      // Manually update the UI state
      const updatedRecords = await db.records.orderBy('recordDate').reverse().toArray();
      setRecords(updatedRecords);
      setShowAddForm(false);
      setOcrData({}); // Clear OCR data after submission
    } catch (err) {
      setError('Failed to save record locally.');
    }
  };

  const handleDeleteRecord = async (recordId) => {
    try {
      // Optimistically delete from the local database
      await db.records.delete(recordId);
      // Add a job to the sync queue
      await db.syncQueue.add({
        entity: 'records',
        entityId: recordId,
        action: 'delete',
        timestamp: new Date().toISOString(),
      });
      // Update UI
      setRecords(records.filter((record) => record._id !== recordId));
    } catch (err) {
      setError('Failed to delete record locally.');
    }
  };

  const handleOcrComplete = (result) => {
    // Pass both the data and the document type to the form
    setOcrData({ data: result.data, documentType: result.documentType });
    setShowAddForm(true);
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
    setOcrData({}); // Also clear OCR data on cancel
  };

  if (loading && !isLoaded) {
    return <div>Loading authentication...</div>;
  }
  
  if (loading) {
    return <div>Loading records...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className={`p-4 sm:p-6 lg:p-8 min-h-screen`}>
      <div className={`mb-8 p-6 rounded-lg shadow-md ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
        <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Welcome back, {user?.firstName || 'User'}!
        </h1>
        <h2 className={`text-2xl font-semibold mt-2 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>Manage Your Records</h2>
        <p className={`mt-2 text-md ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Here you can view, add, and manage all your sales and expense records. Use the OCR uploader below to quickly digitize your physical receipts.</p>
      </div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>All Records</h2>
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)} variant="primary" className="bg-blue-500 text-white px-4 py-2 rounded">
            Add Record Manually
          </Button>
        )}
      </div>

      {!showAddForm && <OcrUploader onOcrComplete={handleOcrComplete} />}

      {showAddForm && (
        <AddRecordForm
          onAddRecord={handleAddRecord}
          onCancel={handleCancelAdd}
          initialData={ocrData}
        />
      )}
      <ul>
        {pagedRecords.map((record) => (
          <li key={record._id} className={`flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 p-2 border rounded gap-2 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div>
              <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>{record.description} - ${record.amount}</span>
              {record.imagePath && (
                <img src={getFullImageUrl([record.imagePath])} alt={record.description} className="w-20 h-20 object-cover mt-2 sm:mt-0 rounded" />
              )}
            </div>
            <button onClick={() => handleDeleteRecord(record._id)} className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded self-end sm:self-center">
              Delete
            </button>
          </li>
        ))}
      </ul>

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
    </div>
  );
};

export default RecordsPage;
