import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';


export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Necessary to send and receive HttpOnly cookies (refresh_token)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to automatically attach JWT token and language if present in localStorage
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    const lang = localStorage.getItem('language') || 'es';
    // Get device locale (e.g. 'es-AR', 'es-ES', 'en-US') to determine region
    const deviceLocale = typeof navigator !== 'undefined' ? (navigator.language || '') : '';
    const localeParts = deviceLocale.split('-');
    const regionCode = localeParts.length > 1 ? localeParts[1].toUpperCase() : '';
    const fullLocale = regionCode ? `${lang}-${regionCode}` : lang;

    if (config.headers) {
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      config.headers['Accept-Language'] = fullLocale;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


// Response interceptor to handle token renewal automatically
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if the error is due to user suspension
    const isSuspendedError = 
      error.response?.status === 403 && (
        error.response?.headers?.['x-user-suspended'] === 'true' ||
        String(error.response?.data?.detail || '').toLowerCase().includes('suspendid')
      );

    if (isSuspendedError) {
      window.dispatchEvent(new CustomEvent('user-suspended', { detail: error.response?.data?.detail }));
      return Promise.reject(error);
    }

    // If 401 response and request has not retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to call the refresh endpoint to obtain a new access token via cookie
        const refreshResp = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const { access_token } = refreshResp.data;

        localStorage.setItem('access_token', access_token);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        originalRequest.headers['Authorization'] = `Bearer ${access_token}`;

        processQueue(null, access_token);
        isRefreshing = false;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        // Invalidation callback (session expired)
        localStorage.removeItem('access_token');
        window.dispatchEvent(new Event('auth-logout'));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Safely updates a library item's status using fetch with keepalive: true,
 * ensuring the HTTP request survives tab unloads, modal closures, and navigation.
 */
export async function updateLibraryStatusSafe(
  itemId: number | string,
  status: string,
  extraPayload: Record<string, any> = {}
): Promise<any> {
  const token = localStorage.getItem('access_token');
  const lang = localStorage.getItem('language') || 'es';
  const url = `${API_BASE_URL}/library/${itemId}`;
  const payload = { status, ...extraPayload };

  // Try fetch with keepalive: true first so tab unloads or background closes do not cancel the request
  if (typeof fetch !== 'undefined') {
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': lang,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        credentials: 'include',
        keepalive: true,
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (_) {
      // Fallback to apiClient if fetch with keepalive fails
    }
  }

  // Fallback to standard axios client instance
  const res = await apiClient.put(`/library/${itemId}`, payload);
  return res.data;
}
