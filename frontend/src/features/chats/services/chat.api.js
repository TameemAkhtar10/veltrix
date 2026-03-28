import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

let api = axios.create({
    baseURL: BACKEND_URL,
    withCredentials: true
})

export async function sendMessage(message, chatId, signal) {
    let response = await api.post('/api/chats/message', { message, chat: chatId }, { signal })
    return response.data
}
export async function uploadFiles(files, chatId, message, signal) {
    const formData = new FormData()
    if (chatId) {
        formData.append('chat', chatId)
    }
    if (message) {
        formData.append('message', message)
    }

    for (const file of files || []) {
        formData.append('files', file)
    }

    let response = await api.post('/api/upload', formData, {
        signal,
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    })
    return response.data
}
export async function getMessages(chatId) {
    let response = await api.get(`/api/chats/messages/${chatId}`)
    return response.data
}
export async function getChats() {
    let response = await api.get('/api/chats/chats')
    return response.data


}
export async function createChat() {
    let response = await api.post('/api/chats/create')
    return response.data
}
export async function deleteChat(chatId) {
    let response = await api.delete(`/api/chats/delete/${chatId}`)
    return response.data
}

