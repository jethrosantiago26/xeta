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
      return Promise.reject(error)
    }

    originalRequest.__retriedWithFreshToken = true

    try {
      const freshToken = await authTokenProvider()

      if (!freshToken) {
        setApiAuthToken(null)
        return Promise.reject(error)
      }

      setApiAuthToken(freshToken)
      originalRequest.headers = {
        ...(originalRequest.headers || {}),
        Authorization: `Bearer ${freshToken}`,
      }

      return api.request(originalRequest)
    } catch {
      setApiAuthToken(null)
      return Promise.reject(error)
    }
  },
)

export async function getProducts(params = {}) {
  return api.get('/products', { params })
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

export async function createAdminProductVariant(productId, payload) {
  return api.post(`/admin/products/${productId}/variants`, payload)
}

export async function updateAdminProductVariant(productId, variantId, payload) {
  if (payload instanceof FormData) {
    payload.append('_method', 'PUT')
    return api.post(`/admin/products/${productId}/variants/${variantId}`, payload)
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

export function readResource(response) {
  return response.data
}

export default api