import axios from 'axios';

// Smart API URL selection based on environment
// Priority: VITE_API_BASE_URL > DEV/PROD based on mode > fallback to /api
const getBaseURL = () => {
  // If explicitly set, use it (for manual override)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Auto-select based on build mode
  if (import.meta.env.MODE === 'production') {
    return import.meta.env.VITE_API_BASE_URL_PROD || '/api';
  }
  
  // Development mode
  return import.meta.env.VITE_API_BASE_URL_DEV || '/api';
};

const baseURL = getBaseURL();

console.log('API Base URL:', baseURL, '| Mode:', import.meta.env.MODE);

// Helper function to get the Clerk token. This assumes Clerk is initialized.
export const getAuthToken = async () => {
  if (window.Clerk?.session) {
    return window.Clerk.session.getToken({ template: 'roles-claims' });
  }
  return null;
};

// Helper function to get full URL for uploaded files, handling multiple images
export const getFullImageUrl = (imagePaths, index = 0) => {
  if (!imagePaths || imagePaths.length === 0 || index < 0 || index >= imagePaths.length) {
    return ''; // Return empty string if no images or invalid index
  }
  const imagePath = imagePaths[index];
  if (typeof imagePath !== 'string' || imagePath.trim() === '') return ''; // Ensure it's a non-empty string
  if (imagePath.startsWith('http')) return imagePath; // Already a full URL

  // Return a relative path. The browser will request it from the same origin.
  // In development, Vite's proxy will forward it. In production, a reverse proxy (like Netlify's) will.
  return imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
};

const api = axios.create({
  baseURL,
  headers: {
    // This header is used to bypass the ngrok browser warning page.
    // Set to any value, e.g., "true".
    'ngrok-skip-browser-warning': 'true',
  },
});

// Add a request interceptor to include the token
api.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
  