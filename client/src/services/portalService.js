import api from './api';

/**
 * Fetches all invoices assigned to the currently logged-in customer.
 * @returns {Promise<Array>} A list of invoices.
 */
export const getMyInvoices = async () => {
  try {
    const response = await api.get('/portal/invoices');
    return response.data;
  } catch (error) {
    console.error('Error fetching customer invoices:', error);
    throw error;
  }
};