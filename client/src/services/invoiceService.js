import api from './api';

export const getInvoices = async () => {
  try {
    // Add ?sync=true to fetch all invoices for offline synchronization.
    const response = await api.get('/invoices?sync=true');
    return response.data;
  } catch (error) {
    console.error('Error fetching invoices:', error);
    throw error;
  }
};

export const getInvoice = async (invoiceId) => {
  try {
    const response = await api.get(`/invoices/${invoiceId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching invoice ${invoiceId}:`, error);
    throw error;
  }
};

export const createInvoice = async (invoiceData) => {
  try {
    const response = await api.post('/invoices', invoiceData);
    return response.data;
  } catch (error) {
    console.error('Error creating invoice:', error);
    throw error;
  }
};

export const updateInvoice = async (invoiceId, invoiceData) => {
  try {
    const response = await api.put(`/invoices/${invoiceId}`, invoiceData);
    return response.data;
  } catch (error) {
    console.error(`Error updating invoice ${invoiceId}:`, error);
    throw error;
  }
};

export const sendInvoice = async (invoiceId) => {
  try {
    // The 'send' action is a specific type of update on the backend
    const response = await api.put(`/invoices/${invoiceId}/send`);
    return response.data;
  } catch (error) {
    console.error(`Error sending invoice ${invoiceId}:`, error);
    throw error;
  }
};

export const deleteInvoice = async (invoiceId) => {
  try {
    const response = await api.delete(`/invoices/${invoiceId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting invoice:', error);
    throw error;
  }
};
