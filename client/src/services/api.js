import axios from 'axios';

// In development, the Vite proxy in `vite.config.js` will forward requests from /api to the backend.
// In production (on Netlify), the redirect rule in `netlify.toml` will do the same.
// Therefore, we can use a relative baseURL.
const baseURL = '/api';

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
  