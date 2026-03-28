import React, { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useChat } from '../Hooks/Use.chats'
import { setchatlist, setchats, setcurrentchatId, seterror } from '../chat.slice'
import { useAuth } from '../../auth/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { markdown } from 'markdown'
import { uploadFiles } from '../services/chat.api'
import {
  disconnectSocketConnection,
  initializeSocketConnection,
  joinChatRoom,
  leaveChatRoom,
  onChatMessage,
} from '../services/chat.socket'

const THEME_STORAGE_KEY = 'theme-preference'

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

function parseTableCells(line = '') {
  return line
    .split('|')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function isMarkdownTableRow(line = '') {
  const trimmed = String(line || '').trim()
  if (!trimmed.includes('|')) return false
  return /^\|?.+\|.+\|?$/.test(trimmed)
}

function isMarkdownTableSeparator(line = '') {
  const trimmed = String(line || '').trim()
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(trimmed)
}

function normalizeAssistantFormatting(value = '') {
  const input = decodeHtmlEntities(value)
  const lines = input.split(/\r?\n/)
  const normalized = []

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const nextLine = lines[i + 1] || ''

    if (isMarkdownTableRow(line) && isMarkdownTableSeparator(nextLine)) {
      const headers = parseTableCells(line)
      i += 1

      while (i + 1 < lines.length && isMarkdownTableRow(lines[i + 1])) {
        const row = lines[i + 1]
        const cells = parseTableCells(row)

        if (headers.length > 1 && cells.length > 0) {
          const pairs = headers
            .map((header, index) => {
              const cellValue = cells[index]
              if (!cellValue) return null
              return `${header}: ${cellValue}`
            })
            .filter(Boolean)

          if (pairs.length > 0) {
            normalized.push(`- ${pairs.join(', ')}`)
          }
        } else if (cells.length > 0) {
          normalized.push(`- ${cells.join(', ')}`)
        }

        i += 1
      }

      continue
    }

    if (isMarkdownTableSeparator(line)) {
      continue
    }

    normalized.push(line)
  }

  return normalized.join('\n')
}

const renderMarkdown = (value = '') => markdown.toHTML(normalizeAssistantFormatting(value))

const Dashboard = () => {
  const {
    sendMessageHandler,
    stopGeneratingHandler,
    getChatsHandler,
    getMessagesHandler,
    deleteChathandler,
    createChatHandler,
  } = useChat()
  const { handlelogout } = useAuth()
  const [message, setMessage] = useState('')
  const [lastPrompt, setLastPrompt] = useState('')
  const [streamedAssistantId, setStreamedAssistantId] = useState(null)
  const [streamedAssistantText, setStreamedAssistantText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [theme, setTheme] = useState(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'))
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user } = useSelector((state) => state.auth)
  const { conversations, chatList, currentchatId, isloading, error } = useSelector((state) => state.chat)
  const bottomRef = useRef(null)
  const conversationsRef = useRef([])
  const currentChatIdRef = useRef(null)

  useEffect(() => {
    conversationsRef.current = conversations || []
    currentChatIdRef.current = currentchatId
  }, [conversations, currentchatId])

  useEffect(() => {
    const socket = initializeSocketConnection()
    const unsubscribe = onChatMessage((payload) => {
      const socketChatId = payload?.chatId
      const incomingId = payload?.id
      const incomingRole = payload?.role
      const incomingText = payload?.content

      if (!socketChatId || !incomingId || !incomingRole) return
      if (socketChatId !== currentChatIdRef.current) return

      const currentMessages = conversationsRef.current || []
      const alreadyExists = currentMessages.some((item) => item?.id === incomingId)
      if (alreadyExists) return

      dispatch(
        setchats([
          ...currentMessages,
          {
            id: incomingId,
            role: incomingRole,
            text: decodeHtmlEntities(incomingText || ''),
          },
        ])
      )
    })

    return () => {
      unsubscribe?.()
      socket?.off?.('chat_message')
      disconnectSocketConnection()
    }
  }, [dispatch])

  useEffect(() => {
    if (!currentchatId) return

    joinChatRoom(currentchatId)
    return () => {
      leaveChatRoom(currentchatId)
    }
  }, [currentchatId])

  useEffect(() => {
    const loadChats = async () => {
      try {
        const response = await getChatsHandler()
        dispatch(setchatlist(response?.chats || []))
      } catch (fetchError) {
        console.error('Error loading chats:', fetchError)
      }
    }

    loadChats()
  }, [dispatch, getChatsHandler])

  const handleCreateChat = async () => {
    if (isloading) return

    try {
      const response = await createChatHandler()
      const newChat = response?.chat
      if (!newChat?._id) return

      dispatch(setchatlist([newChat, ...chatList.filter((chat) => chat._id !== newChat._id)]))
      dispatch(setcurrentchatId(newChat._id))
      dispatch(setchats([]))
      dispatch(seterror(null))
      setLastPrompt('')
      setStreamedAssistantId(null)
      setStreamedAssistantText('')
      setIsStreaming(false)
    } catch (createError) {
      console.error('Error creating chat:', createError)
    }
  }

  const handleSelectChat = async (chatId) => {
    if (!chatId || isloading) return

    try {
      dispatch(setcurrentchatId(chatId))
      dispatch(seterror(null))

      const response = await getMessagesHandler(chatId)
      const messages = (response?.messages || []).map((item) => ({
        id: item?._id,
        role: item?.role,
        text: decodeHtmlEntities(item?.content),
      }))

      dispatch(setchats(messages))
      setLastPrompt('')
      setStreamedAssistantId(null)
      setStreamedAssistantText('')
      setIsStreaming(false)
    } catch (fetchError) {
      console.error('Error loading selected chat:', fetchError)
    }
  }

  const handleDeleteChat = async (event, chatId) => {
    event.stopPropagation()
    if (!chatId || isloading) return

    try {
      await deleteChathandler(chatId)
      const updatedChatList = chatList.filter((chat) => chat._id !== chatId)
      dispatch(setchatlist(updatedChatList))

      if (currentchatId !== chatId) return

      const nextChatId = updatedChatList[0]?._id || null
      dispatch(setcurrentchatId(nextChatId))

      if (!nextChatId) {
        dispatch(setchats([]))
        return
      }

      const response = await getMessagesHandler(nextChatId)
      const messages = (response?.messages || []).map((item) => ({
        id: item?._id,
        role: item?.role,
        text: decodeHtmlEntities(item?.content),
      }))

      dispatch(setchats(messages))
    } catch (deleteError) {
      console.error('Error deleting selected chat:', deleteError)
    }
  }


  const latestAssistantMessage = [...conversations].reverse().find((item) => item.role === 'assistant')
  const latestUserMessage = [...conversations].reverse().find((item) => item.role === 'user')
  const retryPrompt = (lastPrompt || latestUserMessage?.text || '').trim()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversations, isloading, isStreaming])

  useEffect(() => {
    if (!latestAssistantMessage?.id) return

    const fullText = latestAssistantMessage.text || ''
    let interval
    const setupTimer = setTimeout(() => {
      setStreamedAssistantId(latestAssistantMessage.id)
      setStreamedAssistantText(fullText.slice(0, 1))
      setIsStreaming(true)

      const chunkSize = Math.max(1, Math.ceil(fullText.length / 70))
      let cursor = 1

      interval = setInterval(() => {
        cursor = Math.min(fullText.length, cursor + chunkSize)
        setStreamedAssistantText(fullText.slice(0, cursor))
        if (cursor >= fullText.length) {
          setIsStreaming(false)
          clearInterval(interval)
        }
      }, 16)
    }, 0)

    return () => {

      clearTimeout(setupTimer)
      if (interval) clearInterval(interval)
    }
  }, [latestAssistantMessage?.id, latestAssistantMessage?.text])

  useEffect(() => {
    if (!isMobileSidebarOpen || window.innerWidth >= 768) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMobileSidebarOpen])

  useEffect(() => {
    const html = document.documentElement
    html.classList.toggle('dark', theme === 'dark')
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const handlesubmitmessage = async (e) => {
    e.preventDefault()
    const trimmedMessage = message.trim()
    if (!trimmedMessage || isloading) return

    setLastPrompt(trimmedMessage)
    setMessage('')
    const filesToUpload = [...selectedFiles]
    setSelectedFiles([])

    if (filesToUpload.length > 0) {
      try {
        await uploadFiles(filesToUpload, currentchatId, trimmedMessage)
      } catch (uploadError) {
        dispatch(seterror(uploadError?.response?.data?.error || uploadError?.message || 'File upload failed'))
        return
      }
    }

    await sendMessageHandler(trimmedMessage, currentchatId)
  }

  const handleFilesChange = (e) => {
    const files = Array.from(e.target.files || [])
    setSelectedFiles(files)
  }

  const handleRetry = async () => {
    if (!retryPrompt || isloading) return
    await sendMessageHandler(retryPrompt, currentchatId, { appendUserMessage: false })
  }

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false)
  }

  const handleLogout = async () => {
    const result = await handlelogout()
    if (!result?.success) return

    dispatch(setchatlist([]))
    dispatch(setchats([]))
    dispatch(setcurrentchatId(null))
    dispatch(seterror(null))
    closeMobileSidebar()
    navigate('/login')
  }

  const handleOpenProfile = () => {
    closeMobileSidebar()
    navigate('/profile')
  }

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'dark' ? 'light' : 'dark'))
  }

  const profileName = user?.username || 'User'
  const profileEmail = user?.email || 'listener'
  const profileLetter = (profileName?.[0] || 'U').toUpperCase()
  const hasMessages = conversations.length > 0
  const showCenteredComposer = !hasMessages && !isloading
  const suggestionPrompts = ['Summarize my notes', 'Create a study plan', 'Draft a follow-up email']

  const messageComposer = (
    <form onSubmit={handlesubmitmessage} className="composer relative flex items-center gap-2 px-2 py-2">
      <label className="composer-upload flex h-10 w-10 cursor-pointer items-center justify-center transition" aria-label="Upload files">
        <input
          type="file"
          multiple
          onChange={handleFilesChange}
          accept=".pdf,.docx,.txt,image/*"
          className="hidden"
        />
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M17 8l-5-5-5 5" />
          <path d="M12 3v12" />
        </svg>
      </label>

      <input
        type="text"
        name="message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask anything..."
        className="  flex-1 px-1 text-sm outline-none"
      />

      <button
        type={isloading ? 'button' : 'submit'}
        onClick={isloading ? stopGeneratingHandler : undefined}
        disabled={!isloading && !message.trim()}
        className="composer-send flex h-10 w-10 items-center justify-center transition disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Send message"
      >
        {isloading ? (
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3a9 9 0 1 1-9 9" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 19V5" />
            <path d="m6 11 6-6 6 6" />
          </svg>
        )}
      </button>

      {selectedFiles.length > 0 && (
        <div className="absolute bottom-[4.6rem] left-0 right-0 mx-auto max-w-4xl px-1">
          <div className="selected-files-tray flex flex-wrap gap-2 p-2">
            {selectedFiles.map((file) => (
              <span key={`${file.name}-${file.size}`} className="file-chip max-w-52 truncate px-3 py-1 text-xs">
                {file.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </form>
  )

  const sidebarContent = (
    <>
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="app-logo app-logo-sm">
              <img src="/favicon.svg" alt="Veltrix logo" className="app-logo-fill" />
            </span>
            <p className="dashboard-logo text-lg tracking-wide">Veltrix</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="muted-action flex h-8 w-8 items-center justify-center rounded-md transition"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="m4.93 4.93 1.41 1.41" />
                  <path d="m17.66 17.66 1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="m6.34 17.66-1.41 1.41" />
                  <path d="m19.07 4.93-1.41 1.41" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3c0 0 0 0 0 0A7 7 0 0 0 21 12.79Z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={closeMobileSidebar}
              className="muted-action flex h-8 w-8 items-center justify-center rounded-md transition md:hidden"
              aria-label="Close sidebar"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={async () => {
            await handleCreateChat()
            closeMobileSidebar()
          }}
          disabled={isloading}
          className="dashboard-new-chat-btn mt-2 w-full px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
        >
          + New Chat
        </button>
      </div>

      <div className="nooo flex-1 space-y-1 overflow-y-auto px-2 pb-2">
        {chatList.map((chat) => (
          <div
            key={chat._id}
            className={`dashboard-chat-item group flex w-full items-center gap-1 rounded-md pr-1 transition ${currentchatId === chat._id ? 'is-active' : ''}`}
          >
            <button
              type="button"
              onClick={async () => {
                await handleSelectChat(chat._id)
                closeMobileSidebar()
              }}
              className="min-w-0 flex-1 truncate rounded-md px-3 py-2.5 text-left text-sm"
            >
              {chat.title || 'New Chat'}
            </button>
            <button
              type="button"
              onClick={(event) => handleDeleteChat(event, chat._id)}
              className="chat-delete-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition"
              aria-label="Delete chat"
              title="Delete chat"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>
          </div>
        ))}

        {chatList.length === 0 && (
          <div className="chat-empty px-3 py-2 text-sm">No conversations yet.</div>
        )}
      </div>

      <div className="dashboard-divider border-t px-3 py-3">
        <button
          type="button"
          onClick={handleLogout}
          className="logout flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition"
        >
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <path d="M10 17l5-5-5-5" />
            <path d="M15 12H3" />
          </svg>
          Logout
        </button>

        <button
          type="button"
          onClick={handleOpenProfile}
          className="card-surface mt-2 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="avatar-chip flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold">
              {profileLetter}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{profileName}</span>
              <span className="muted-text block truncate text-xs">{profileEmail}</span>
            </span>
          </div>
          <svg viewBox="0 0 24 24" className="muted-text h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </>
  )

  return (
    <section className="dashboard-shell page-shell min-h-dvh">
      <aside className="dashboard-sidebar fixed left-0 z-20 hidden w-65 md:flex md:flex-col">
        {sidebarContent}
      </aside>

      <div
        className={`dashboard-overlay fixed inset-x-0 z-30 bg-black/60 transition-opacity duration-300 md:hidden ${isMobileSidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          }`}
        onClick={closeMobileSidebar}
      />

      <aside
        className={`dashboard-mobile-sidebar fixed left-0 z-40 flex w-[45vw] min-w-65 max-w-82 flex-col transition-transform duration-300 md:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {sidebarContent}
      </aside>

      <div className="dashboard-main flex flex-col md:ml-65">
        <div className="dashboard-mobile-topbar dashboard-divider border-b px-4 py-4 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="muted-action flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition"
              aria-label="Open sidebar"
            >
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleCreateChat}
              disabled={isloading}
              className="dashboard-new-chat-btn rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
            >
              + New Chat
            </button>
          </div>
        </div>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* <header className="border-b border-[#ffffff10] bg-[#151820] px-6 py-2">
            <div className="mx-auto flex w-full max-w-4xl items-center justify-end gap-4">
              <div className="rounded-full border border-[#ffffff10] bg-[#1e2130] px-3 py-1 text-xs text-[#bfc3d4]">
                Model:<span className="ml-1">{user?.model || 'GPT-4'}</span>
              </div>
            </div>
          </header> */}

          {showCenteredComposer ? (
            <section className="flex flex-1 items-center justify-center px-6 py-8">
              <div className="w-full max-w-2xl">
                <div className="mb-5 text-center">
                  <span className="app-logo app-logo-lg mx-auto mb-3">
                    <img src="/favicon.svg" alt="Veltrix logo" className="app-logo-fill" />
                  </span>
                  <h1 className="text-3xl font-black tracking-tight">Veltrix</h1>
                </div>
                <div className="mb-4 flex flex-wrap justify-center gap-2">
                  {suggestionPrompts.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setMessage(suggestion)}
                      className="suggestion-chip px-4 py-2 text-xs"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                {messageComposer}
              </div>
            </section>
          ) : (
            <>
              <section className="nooo min-h-0 flex-1 overflow-y-auto no-scrollbar px-6 py-8 pb-56">
                <div className="mx-auto max-w-4xl space-y-4">
                  {conversations.map((item) => {
                    const isLiveAssistant = item.role === 'assistant' && item.id === streamedAssistantId
                    const textToShow = isLiveAssistant ? streamedAssistantText : item.text

                    return (
                      <div key={item.id} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-2xl px-5 py-3 text-sm leading-7 ${item.role === 'user'
                            ? 'chat-bubble-user'
                            : 'chat-bubble-ai'
                            }`}
                        >
                          {item.role === 'assistant' ? (
                            <>
                              <div
                                className="markdown-content"
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(textToShow || '') }}
                              />
                              {isLiveAssistant && isStreaming && (
                                <span className="muted-text ml-1 inline-block h-4 w-0.5 animate-pulse align-middle" />
                              )}
                            </>
                          ) : (
                            <p className="whitespace-pre-wrap">{textToShow}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {isloading && (
                    <div className="flex justify-start">
                      <div className="chat-bubble-ai max-w-2xl px-5 py-3 text-sm leading-7">
                        <div className="loading-dots inline-flex items-center gap-1 rounded-full px-3 py-2">
                          <span className="h-2 w-2 animate-bounce rounded-full [animation-delay:-0.3s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full [animation-delay:-0.15s]" />
                          <span className="h-2 w-2 animate-bounce rounded-full" />
                        </div>
                      </div>
                    </div>
                  )}

                  {error && !isloading && retryPrompt && (
                    <div className="muted-text flex items-center gap-3 pl-1 text-xs">
                      <button
                        type="button"
                        onClick={handleRetry}
                        className="retry-btn px-3 py-1.5 transition"
                      >
                        Retry last prompt
                      </button>
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>
              </section>

              <footer className="fixed bottom-0 left-0 right-0 px-6 py-4 md:left-65">
                <div className="mx-auto max-w-4xl space-y-4">
                  <div className="flex flex-wrap gap-2" />
                  {messageComposer}
                </div>
              </footer>
            </>
          )}
        </main>
      </div>
    </section>
  )
}

export default Dashboard
