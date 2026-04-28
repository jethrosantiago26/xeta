import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1',
  withCredentials: true,
})

let authTokenProvider = null

export function setApiAuthTokenProvider(provider) {
  authTokenProvider = provider
}

export function setApiAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`
    return
  }

  delete api.defaults.headers.common.Authorization
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status
    const originalRequest = error?.config

    if (status !== 401 || !originalRequest || originalRequest.__retriedWithFreshToken) {
      return Promise.reject(error)
    }

    if (!authTokenProvider) {
      console.warn('[API Interceptor] 401 received but no authTokenProvider set.')
      return Promise.reject(error)
    }

    originalRequest.__retriedWithFreshToken = true

    try {
      console.debug('[API Interceptor] 401 received. Refreshing token...')
      const freshToken = await authTokenProvider()

      if (!freshToken) {
        console.warn('[API Interceptor] Failed to refresh token. Clearing local auth.')
        setApiAuthToken(null)
        return Promise.reject(error)
      }

      console.debug('[API Interceptor] Token refreshed. Retrying request...')
      setApiAuthToken(freshToken)

      // Ensure compatibility with Axios 1.x AxiosHeaders object
      if (originalRequest.headers.set) {
        originalRequest.headers.set('Authorization', `Bearer ${freshToken}`)
      } else {
        originalRequest.headers.Authorization = `Bearer ${freshToken}`
      }

      return api.request(originalRequest)
    } catch (refreshError) {
      console.error('[API Interceptor] Error during token refresh/retry:', refreshError)
      setApiAuthToken(null)
      return Promise.reject(error)
    }
  },
)

export async function getProducts(params = {}, signal = undefined) {
  return api.get('/products', { params, signal })
}

export async function getProduct(slug) {
  return api.get(`/products/${slug}`)
}

export async function getCategories() {
  return api.get('/categories')
}

export async function getCart() {
  return api.get('/cart')
}

export async function addCartItem(payload) {
  return api.post('/cart', payload)
}

export async function updateCartItem(cartItemId, payload) {
  return api.put(`/cart/${cartItemId}`, payload)
}

export async function removeCartItem(cartItemId) {
  return api.delete(`/cart/${cartItemId}`)
}

export async function getWishlist() {
  return api.get('/wishlist')
}

export async function addWishlistItem(payload) {
  return api.post('/wishlist', payload)
}

export async function removeWishlistItem(wishlistItemId) {
  return api.delete(`/wishlist/${wishlistItemId}`)
}

export async function placeCashOnDeliveryOrder(payload) {
  return api.post('/checkout/place-order', payload)
}

export async function getOrders(params = {}) {
  return api.get('/orders', { params })
}

export async function getOrder(orderId) {
  return api.get(`/orders/${orderId}`)
}

export async function getMe() {
  return api.get('/auth/me')
}

export async function syncAuth() {
  return api.post('/auth/sync')
}

export async function updateProfile(payload) {
  return api.put('/auth/me', payload)
}

export async function getAdminDashboard() {
  return api.get('/admin/dashboard')
}

export async function createReview(productSlug, payload) {
  return api.post(`/products/${productSlug}/reviews`, payload)
}

export async function getSupportTickets(params = {}) {
  return api.get('/support/tickets', { params })
}

export async function getSupportTicket(ticketId) {
  return api.get(`/support/tickets/${ticketId}`)
}

export async function createSupportTicket(payload) {
  return api.post('/support/tickets', payload)
}

export async function createSupportMessage(ticketId, payload) {
  return api.post(`/support/tickets/${ticketId}/messages`, payload)
}

export async function reopenSupportTicket(ticketId) {
  return api.post(`/support/tickets/${ticketId}/reopen`)
}

export async function getAdminSupportTickets(params = {}) {
  return api.get('/admin/support/tickets', { params })
}

export async function getAdminSupportTicket(ticketId) {
  return api.get(`/admin/support/tickets/${ticketId}`)
}

export async function updateAdminSupportTicket(ticketId, payload) {
  return api.put(`/admin/support/tickets/${ticketId}`, payload)
}

export async function createAdminSupportMessage(ticketId, payload) {
  return api.post(`/admin/support/tickets/${ticketId}/messages`, payload)
}

export async function getAdminProducts(params = {}) {
  return api.get('/admin/products', { params })
}

export async function createAdminProduct(payload) {
  return api.post('/admin/products', payload)
}

export async function updateAdminProduct(productId, payload) {
  return api.put(`/admin/products/${productId}`, payload)
}

export async function deleteAdminProduct(productId) {
  return api.delete(`/admin/products/${productId}`)
}

export async function restoreAdminProduct(productId) {
  return api.post(`/admin/products/${productId}/restore`)
}

export async function deleteArchivedAdminProduct(productId) {
  return api.delete(`/admin/products/${productId}/force`)
}

export async function forceDeleteAdminProduct(productId) {
  return deleteArchivedAdminProduct(productId)
}

export async function createAdminProductVariant(productId, payload) {
  if (payload instanceof FormData) {
    // FormData uploads use POST directly - no method spoofing needed
    // CRITICAL: Do NOT set Content-Type header - let browser set it automatically for multipart/form-data
    return api.post(`/admin/products/${productId}/variants`, payload, {
      headers: {
        'Content-Type': undefined,
      },
    })
  }
  return api.post(`/admin/products/${productId}/variants`, payload)
}

export async function updateAdminProductVariant(productId, variantId, payload) {
  if (payload instanceof FormData) {
    // FormData uploads use POST directly (route accepts both PUT and POST)
    // CRITICAL: Do NOT set Content-Type header - let browser set it automatically for multipart/form-data
    return api.post(`/admin/products/${productId}/variants/${variantId}`, payload, {
      headers: {
        'Content-Type': undefined,
      },
    })
  }

  return api.put(`/admin/products/${productId}/variants/${variantId}`, payload)
}

export async function deleteAdminProductVariant(productId, variantId) {
  return api.delete(`/admin/products/${productId}/variants/${variantId}`)
}

export async function updateReview(productSlug, reviewId, payload) {
  return api.put(`/products/${productSlug}/reviews/${reviewId}`, payload)
}

export async function getAdminReviews(params = {}) {
  return api.get('/admin/reviews', { params })
}

export async function updateAdminReview(reviewId, payload) {
  return api.put(`/admin/reviews/${reviewId}`, payload)
}

export async function deleteAdminReview(reviewId) {
  return api.delete(`/admin/reviews/${reviewId}`)
}

export async function restoreAdminReview(reviewId) {
  return api.post(`/admin/reviews/${reviewId}/restore`)
}

export async function forceDeleteAdminReview(reviewId) {
  return api.delete(`/admin/reviews/${reviewId}/force`)
}

export async function getAdminOrders(params = {}) {
  return api.get('/admin/orders', { params })
}

export async function updateAdminOrder(orderId, payload) {
  return api.put(`/admin/orders/${orderId}`, payload)
}

export async function deleteAdminOrder(orderId) {
  return api.delete(`/admin/orders/${orderId}`)
}

export async function restoreAdminOrder(orderId) {
  return api.post(`/admin/orders/${orderId}/restore`)
}

export async function forceDeleteAdminOrder(orderId) {
  return api.delete(`/admin/orders/${orderId}/force`)
}

export async function bulkAdminOrdersAction(payload) {
  return api.post('/admin/orders/bulk', payload)
}

export async function getAdminCustomers(params = {}) {
  return api.get('/admin/customers', { params })
}

export async function updateAdminCustomer(customerId, payload) {
  return api.put(`/admin/customers/${customerId}`, payload)
}

export async function deleteAdminCustomer(customerId) {
  return api.delete(`/admin/customers/${customerId}`)
}

export async function restoreAdminCustomer(customerId) {
  return api.post(`/admin/customers/${customerId}/restore`)
}

export async function forceDeleteAdminCustomer(customerId) {
  return api.delete(`/admin/customers/${customerId}/force`)
}

export async function getAdminInventory(params = {}) {
  return api.get('/admin/inventory', { params })
}

export async function updateAdminInventoryStock(variantId, payload) {
  return api.put(`/admin/inventory/variants/${variantId}/stock`, payload)
}

export async function getAdminAnalytics(params = {}) {
  return api.get('/admin/analytics', { params })
}

export async function getAdminPromotions(params = {}) {
  return api.get('/admin/promotions', { params })
}

export async function createAdminPromotion(payload) {
  return api.post('/admin/promotions', payload)
}

export async function updateAdminPromotion(promotionId, payload) {
  return api.put(`/admin/promotions/${promotionId}`, payload)
}

export async function setAdminPromotionActive(promotionId, isActive) {
  return api.put(`/admin/promotions/${promotionId}/active`, { is_active: isActive })
}

export async function deleteAdminPromotion(promotionId) {
  return api.delete(`/admin/promotions/${promotionId}`)
}

export function readResource(response) {
  return response.data
}

function normalizeAssetPath(path) {
  const normalized = String(path)
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')

  if (!normalized) {
    return ''
  }

  if (normalized.startsWith('/')) {
    return normalized
  }

  return `/${normalized}`
}

function normalizeLegacyAssetPath(path) {
  let candidate = normalizeAssetPath(path)

  if (!candidate) {
    return ''
  }

  candidate = candidate.replace(/^\/public\/storage\//i, '/storage/')
  candidate = candidate.replace(/^\/storage\/app\/public\//i, '/storage/')
  candidate = candidate.replace(/^\/uploads\//i, '/storage/')

  return candidate
}

export function getAssetUrl(path) {
  if (!path) {
    return path
  }

  const rawPath = String(path).trim()

  if (!rawPath) {
    return ''
  }

  if (
    rawPath.startsWith('http://')
    || rawPath.startsWith('https://')
    || rawPath.startsWith('data:')
    || rawPath.startsWith('blob:')
    || rawPath.startsWith('//')
  ) {
    return rawPath
  }

  const normalizedPath = normalizeLegacyAssetPath(rawPath)

  if (!normalizedPath) {
    return ''
  }

  const baseUrl = api.defaults.baseURL.replace(/\/api\/v1\/?$/, '')

  return `${baseUrl}${normalizedPath}`
}

export default api