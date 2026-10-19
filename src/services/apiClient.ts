import axios from 'axios'

// Prepared Axios instance for future Laravel backend API integration
const isMockMode = import.meta.env.VITE_DATA_MODE === 'mock'
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  },
  timeout: 10000
})

apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('tapmenu_demo_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export { isMockMode }
