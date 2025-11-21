import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { uploadForOcr } from '../services/ocrService';
import Button from './Button';

const OcrUploader = ({ onOcrComplete, userRole = 'seller' }) => {
  const { theme } = useTheme();
  const [fileToUpload, setFileToUpload] = useState(null);
  const [uploadType, setUploadType] = useState(''); // 'receipt' or 'utility'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileToUpload(file);
    }
  };

  const triggerFileUpload = (type) => {
    setUploadType(type);
    fileInputRef.current.click();
  };

  useEffect(() => {
    const handleUpload = async () => {
      if (fileToUpload && uploadType) {
        setLoading(true);
        setError('');
        try {
          const result = await uploadForOcr(fileToUpload, uploadType);
          if (onOcrComplete) {
            onOcrComplete(result); // Pass the entire result object
          }
        } catch (err) {
          setError('Failed to analyze document. Please try again.');
          console.error(err);
        } finally {
          setLoading(false);
          setFileToUpload(null);
          setUploadType('');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      }
    };

    handleUpload();
  }, [fileToUpload, uploadType, onOcrComplete]);

  return (
    <div className={`my-4 p-4 border rounded-lg shadow-sm ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Scan a New Document</h3>
      <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        {userRole === 'customer' 
          ? 'Upload payment proofs or utility meter readings for verification.'
          : 'Upload any document type: photos, receipts, PDFs, Word docs, Excel sheets, or handwritten notes.'
        }
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Button onClick={() => triggerFileUpload('receipt')} variant="primary" className="flex-1" disabled={loading}>
          {loading && uploadType === 'receipt' ? 'Analyzing...' : '📄 Receipt / Invoice'}
        </Button>
        <Button onClick={() => triggerFileUpload('utility')} variant="secondary" className="flex-1" disabled={loading}>
          {loading && uploadType === 'utility' ? 'Analyzing...' : '💡 Utility Reading'}
        </Button>
        {userRole === 'seller' && (
          <>
            <Button onClick={() => triggerFileUpload('inventory')} variant="secondary" className="flex-1" disabled={loading}>
              {loading && uploadType === 'inventory' ? 'Analyzing...' : '📦 Inventory List'}
            </Button>
            <Button onClick={() => triggerFileUpload('customer-consumption')} variant="secondary" className="flex-1" disabled={loading}>
              {loading && uploadType === 'customer-consumption' ? 'Analyzing...' : '📊 Customer Records'}
            </Button>
          </>
        )}
      </div>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        accept="image/*,application/pdf,.docx,.xlsx,.pptx"
      />
      <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
        Supported: JPG, PNG, PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), handwritten notes
      </p>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default OcrUploader;