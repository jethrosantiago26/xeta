import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  withCredentials: true,
})

export function setApiAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`
    return
  }

  delete api.defaults.headers.common.Authorization
}

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

export async function getAdminProducts(params = {}) {
  return api.get('/admin/products', { params })
}

export async function createAdminProduct(payload) {
  return api.post('/admin/products', payload)
}

export async function createAdminProductVariant(productId, payload) {
  return api.post(`/admin/products/${productId}/variants`, payload)
}

export function readResource(response) {
  return response.data
}

export default api