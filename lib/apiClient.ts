/**
 * Secure API Client with Request/Response Middleware
 * Handles authentication, error handling, retry logic, and rate limiting
 */

import { sessionManager } from './sessionManager';
import { validation } from './validation';
import logger from './logger';

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ApiRequestConfig {
  method?: RequestMethod;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  shouldValidate?: boolean;
  responseType?: 'json' | 'text' | 'blob';
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
  timestamp: string;
}

export interface ApiError extends Error {
  status?: number;
  data?: any;
}

class ApiClient {
  private baseUrl = import.meta.env.VITE_API_URL || '/api';
  private defaultTimeout = 30000; // 30 seconds
  private rateLimitMap = new Map<string, number[]>(); // Track requests per endpoint
  private maxRequestsPerMinute = 60;

  /**
   * Make API request with all middleware
   */
  async request<T = any>(
    endpoint: string,
    config: ApiRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.defaultTimeout,
      retries = 3,
      shouldValidate = true,
      responseType = 'json',
    } = config;

    // Validate inputs
    if (shouldValidate) {
      if (body) {
        // Check for XSS patterns in request body
        const bodyStr = JSON.stringify(body);
        if (validation.hasXssPattern(bodyStr)) {
          return this.errorResponse('Invalid request data detected', 400);
        }
      }
    }

    // Check rate limiting
    if (!this.checkRateLimit(endpoint)) {
      return this.errorResponse('Rate limit exceeded. Please try again later.', 429);
    }

    // Add headers - authentication is handled via Supabase cookies
    const finalHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    const url = `${this.baseUrl}${endpoint}`;
    let lastError: ApiError | null = null;

    // Retry logic
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(
          url,
          {
            method,
            headers: finalHeaders,
            body: body ? JSON.stringify(body) : undefined,
          },
          timeout
        );

        // Handle authentication errors
        if (response.status === 401) {
          // Clear session metadata and redirect to login
          sessionManager.clearSession();
          // Note: Token invalidation is handled by Supabase on the server
          return this.errorResponse('Unauthorized. Please login again.', 401);
        }

        // Parse response
        let data: any;
        if (responseType === 'json') {
          data = response.ok ? await response.json() : null;
        } else if (responseType === 'text') {
          data = await response.text();
        } else {
          data = await response.blob();
        }

        // Handle error responses
        if (!response.ok) {
          throw new ApiClientError(
            data?.error || `API Error: ${response.status}`,
            response.status,
            data
          );
        }

        // Validate response structure
        if (shouldValidate && responseType === 'json') {
          // Ensure response is not malicious
          const responseStr = JSON.stringify(data);
          if (validation.hasXssPattern(responseStr)) {
            logger.warn('Suspicious response detected');
            return this.errorResponse('Invalid server response', 500);
          }
        }

        return {
          success: true,
          data,
          status: response.status,
          timestamp: new Date().toISOString(),
        };
      } catch (err: any) {
        lastError = err;

        // Don't retry on client errors (4xx)
        if (err.status && err.status >= 400 && err.status < 500) {
          break;
        }

        // Retry on server errors (5xx) and network errors
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await this.sleep(delay);
          continue;
        }
      }
    }

    // All retries exhausted
    const errorMessage = lastError?.message || 'Request failed. Please try again.';
    const status = lastError?.status || 500;
    return this.errorResponse(errorMessage, status);
  }

  /**
   * GET request helper
   */
  async get<T = any>(endpoint: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  /**
   * POST request helper
   */
  async post<T = any>(
    endpoint: string,
    body?: any,
    config?: ApiRequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'POST', body });
  }

  /**
   * PUT request helper
   */
  async put<T = any>(
    endpoint: string,
    body?: any,
    config?: ApiRequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PUT', body });
  }

  /**
   * DELETE request helper
   */
  async delete<T = any>(endpoint: string, config?: ApiRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  /**
   * PATCH request helper
   */
  async patch<T = any>(
    endpoint: string,
    body?: any,
    config?: ApiRequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PATCH', body });
  }

  /**
   * Private: Fetch with timeout
   */
  private fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    return Promise.race([
      fetch(url, init),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      ),
    ]);
  }

  /**
   * Private: Check rate limiting
   */
  private checkRateLimit(endpoint: string): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    if (!this.rateLimitMap.has(endpoint)) {
      this.rateLimitMap.set(endpoint, [now]);
      return true;
    }

    const requests = this.rateLimitMap.get(endpoint)!;
    const recentRequests = requests.filter((time) => time > oneMinuteAgo);

    if (recentRequests.length >= this.maxRequestsPerMinute) {
      return false;
    }

    recentRequests.push(now);
    this.rateLimitMap.set(endpoint, recentRequests);
    return true;
  }

  /**
   * Private: Error response helper
   */
  private errorResponse(message: string, status: number): ApiResponse {
    return {
      success: false,
      error: message,
      status,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Private: Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Set base URL
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Set rate limit
   */
  setRateLimit(requestsPerMinute: number): void {
    this.maxRequestsPerMinute = requestsPerMinute;
  }
}

/**
 * Custom error class for API errors
 */
class ApiClientError extends Error {
  status?: number;
  data?: any;

  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.data = data;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
