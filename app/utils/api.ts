/**
 * API utility functions with proper headers
 * All requests that send data include Content-Type: application/json
 */

const BASE_URL = "http://localhost:8080";

interface FetchOptions extends RequestInit {
  signal?: AbortSignal;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Generic fetch wrapper with proper error handling
 */
async function apiCall<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * GET request
 */
export async function apiGet<T = any>(
  endpoint: string,
  signal?: AbortSignal
): Promise<T> {
  return apiCall<T>(endpoint, {
    method: "GET",
    signal,
  });
}

/**
 * POST request with JSON body
 */
export async function apiPost<T = any>(
  endpoint: string,
  data: any,
  signal?: AbortSignal
): Promise<T> {
  return apiCall<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
    signal,
  });
}

/**
 * PUT request with JSON body
 */
export async function apiPut<T = any>(
  endpoint: string,
  data: any,
  signal?: AbortSignal
): Promise<T> {
  return apiCall<T>(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
    signal,
  });
}

/**
 * PATCH request with JSON body
 */
export async function apiPatch<T = any>(
  endpoint: string,
  data: any,
  signal?: AbortSignal
): Promise<T> {
  return apiCall<T>(endpoint, {
    method: "PATCH",
    body: JSON.stringify(data),
    signal,
  });
}

/**
 * DELETE request
 */
export async function apiDelete<T = any>(
  endpoint: string,
  signal?: AbortSignal
): Promise<T> {
  return apiCall<T>(endpoint, {
    method: "DELETE",
    signal,
  });
}

export default {
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
};
