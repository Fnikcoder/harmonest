import axios from 'axios'

const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : ''

class ConfigService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      response => response,
      error => {
        console.error('API Error:', error)
        const message = error.response?.data?.error || error.message || 'Unknown error'
        throw new Error(message)
      }
    )
  }

  async getClients() {
    const response = await this.api.get('/api/clients')
    return response.data.clients || []
  }

  async getClient(clientName) {
    const response = await this.api.get(`/api/clients/${clientName}`)
    return response.data
  }

  async createClient(clientName) {
    const response = await this.api.post(`/api/clients/${clientName}`)
    return response.data
  }

  async updateClient(clientName, config) {
    const response = await this.api.put(`/api/clients/${clientName}`, config)
    return response.data
  }

  async deleteClient(clientName) {
    const response = await this.api.delete(`/api/clients/${clientName}`)
    return response.data
  }

  async validateConfig(config) {
    try {
      const response = await this.api.post('/api/validate', config)
      return { valid: true, message: response.data.message }
    } catch (error) {
      return { valid: false, message: error.message }
    }
  }

  async getSchema() {
    const response = await this.api.get('/api/schema')
    return response.data
  }

  async getHealth() {
    const response = await this.api.get('/api/health')
    return response.data
  }
}

export default new ConfigService()
