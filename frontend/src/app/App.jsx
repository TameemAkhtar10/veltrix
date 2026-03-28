import React, { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './App.routes.jsx'

const THEME_STORAGE_KEY = 'theme-preference'

const getInitialTheme = () => {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const App = () => {
  useEffect(() => {
    const initialTheme = getInitialTheme()
    const html = document.documentElement
    html.classList.toggle('dark', initialTheme === 'dark')
    window.localStorage.setItem(THEME_STORAGE_KEY, initialTheme)
  }, [])

  return (
    <div className="app-shell">
      <div className="app-content">
        <RouterProvider router={router} />
      </div>
    </div>
  )
}

export default App
