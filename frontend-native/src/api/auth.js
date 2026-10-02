import { apiClient } from './client'

/** @typedef {{ id: string, username: string, email: string, createdAt: string }} ApiUser */
/** @typedef {{ email: string, password: string }} LoginCredentials */
/** @typedef {LoginCredentials & { username: string }} RegisterCredentials */

const unwrapUser = (response) => {
  const payload = response.data
  if (!payload?.success || !payload.data) throw new Error(payload?.message || 'The server returned an invalid account response.')
  return payload.data
}

/** @param {LoginCredentials} credentials @returns {Promise<ApiUser>} */
export const login = async (credentials) => unwrapUser(await apiClient.post('/auth/login', credentials))
/** @param {RegisterCredentials} credentials @returns {Promise<ApiUser>} */
export const register = async (credentials) => unwrapUser(await apiClient.post('/auth/register', credentials))
/** @param {string} idToken @returns {Promise<ApiUser>} */
export const loginWithGoogle = async (idToken) => unwrapUser(await apiClient.post('/auth/google', { idToken }))
/** @returns {Promise<ApiUser>} */
export const getProfile = async () => unwrapUser(await apiClient.get('/auth/profile'))
export const logout = async () => apiClient.post('/auth/logout')