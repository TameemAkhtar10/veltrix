import axios from 'axios'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://veltrix-bn4b.onrender.com';

export const api = axios.create({
    baseURL: `${BACKEND_URL}/api/auth`,
    withCredentials: true

})

api.defaults.withCredentials = true

export const register = async (username, email, password) => {
    try {
        let response = await api.post('/register', {
            username,
            email,
            password
        })
        return response.data
    } catch (error) {
        throw error.response?.data || { message: 'Unable to connect to server' }
    }
}

export const login = async (email, password) => {
    try {
        let response = await api.post('/login', {
            email,
            password
        })
        return response.data
    }
    catch (error) {
        throw error.response?.data || { message: 'Unable to connect to server' }
    }
}
export const getme = async () => {
    try {
        let response = await api.get('/get-me')
        return response.data
    }
    catch (error) {
        throw error.response?.data || { message: 'Unable to connect to server' }
    }
}

export const logout = async () => {
    try {
        let response = await api.post('/logout')
        return response.data
    }
    catch (error) {
        throw error.response?.data || { message: 'Unable to connect to server' }
    }
}