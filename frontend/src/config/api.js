// API Configuration - Use environment variable for production
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'
export const API_URL = API_BASE_URL
export const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5001'
