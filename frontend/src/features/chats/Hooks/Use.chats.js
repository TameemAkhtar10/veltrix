import { sendMessage, getChats, getMessages, deleteChat, createChat } from "../services/chat.api"
import { setchatlist, setchats, setcurrentchatId, seterror, setisloading } from "../chat.slice"
import { useCallback, useRef } from 'react'
import { useDispatch, useStore } from 'react-redux'
import { initializeSocketConnection } from "../services/chat.socket"

function decodeHtmlEntities(str) {
    return String(str || "")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
}




export const useChat = () => {

    let dispatch = useDispatch()
    const store = useStore()
    const abortControllerRef = useRef(null)

    const getConversations = useCallback(() => store.getState().chat?.conversations || [], [store])
    const getChatList = useCallback(() => store.getState().chat?.chatList || [], [store])

    const sendMessageHandler = useCallback(async (message, chatId, options = {}) => {
        const { appendUserMessage = true } = options
        const normalizedMessage = message?.trim()
        if (!normalizedMessage) return

        const userMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            text: normalizedMessage,
        }

        try {
            dispatch(seterror(null))
            dispatch(setisloading(true))
            abortControllerRef.current = new AbortController()

            if (appendUserMessage) {
                dispatch(setchats([...getConversations(), userMessage]))
            }

            let response = await sendMessage(normalizedMessage, chatId, abortControllerRef.current.signal)
            let { chat, aiMessage } = response

            const assistantMessage = {
                id: aiMessage?._id || `assistant-${Date.now()}`,
                role: 'assistant',
                text: decodeHtmlEntities(aiMessage?.content || 'No response received.'),
            }

            const existingMessages = getConversations()
            const alreadyExists = existingMessages.some((item) => item?.id === assistantMessage.id)

            dispatch(
                setchats([
                    ...existingMessages,
                    ...(alreadyExists ? [] : [assistantMessage]),
                ])
            )

            const resolvedChatId = chat?._id || chatId || null
            dispatch(setcurrentchatId(resolvedChatId))

            if (chat?._id) {
                const existingChatList = getChatList()
                const normalizedChat = {
                    ...chat,
                    title: chat?.title || 'New Chat',
                }

                dispatch(
                    setchatlist([
                        normalizedChat,
                        ...existingChatList.filter((item) => item?._id !== chat._id),
                    ])
                )
            }
        }
        catch (error) {
            const isCancelled = error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED'
            if (isCancelled) {
                dispatch(seterror('Generation stopped.'))
                return
            }

            console.error("Error sending message:", error)
            dispatch(seterror(error.message || "An error occurred while sending the message."))
            dispatch(
                setchats([
                    ...getConversations(),
                    {
                        id: `assistant-error-${Date.now()}`,
                        role: 'assistant',
                        text: 'Sorry, I could not respond right now. Please try again.',
                    },
                ])
            )

        }
        finally {
            abortControllerRef.current = null
            dispatch(setisloading(false))
        }

    }, [dispatch, getChatList, getConversations])

    const stopGeneratingHandler = useCallback(() => {
        abortControllerRef.current?.abort()
    }, [])
    const getMessagesHandler = useCallback(async (chatId) => {
        try {
            let response = await getMessages(chatId)
            return response
        } catch (error) {
            console.error("Error fetching messages:", error)
            dispatch(seterror(error.message || "An error occurred while fetching messages."))
            throw error
        }
    }, [dispatch])
    const getChatsHandler = useCallback(async () => {
        try {
            let response = await getChats()
            return response
        } catch (error) {
            console.error("Error fetching chats:", error)
            dispatch(seterror(error.message || "An error occurred while fetching chats."))
            throw error
        }
    }, [dispatch])
    const deleteChathandler = useCallback(async (chatId) => {
        try {
            let response = await deleteChat(chatId)
            return response
        } catch (error) {
            console.error("Error deleting chat:", error)
            dispatch(seterror(error.message || "An error occurred while deleting the chat."))
            throw error
        }
    }, [dispatch])

    const createChatHandler = useCallback(async () => {
        try {
            let response = await createChat()
            return response
        } catch (error) {
            console.error("Error creating chat:", error)
            dispatch(seterror(error.message || "An error occurred while creating the chat."))
            throw error
        }
    }, [dispatch])

    return {
        initializesocketconnection: initializeSocketConnection,
        sendMessageHandler,
        stopGeneratingHandler,
        getMessagesHandler,
        getChatsHandler,
        deleteChathandler,
        createChatHandler

    }
}   
