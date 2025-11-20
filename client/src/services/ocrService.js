import api from './api';

/**
 * Uploads a file for OCR analysis.
 * @param {File} file The file to analyze.
 * @param {string} documentType The type of document ('receipt' or 'utility').
 * @returns {Promise<any>} The response data from the server.
 */
export const uploadForOcr = async (file, documentType) => {
  const formData = new FormData();
  formData.append('document', file);
  formData.append('documentType', documentType);

  try {
    const response = await api.post('/ocr/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading for OCR:', error);
    throw error;
  }
};
