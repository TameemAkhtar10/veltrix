import { createBrowserRouter, Navigate, redirect } from 'react-router-dom'
import { store } from './App.Store'
import { getme } from '../features/auth/services/auth.api'
import Login from '../features/auth/pages/Login.jsx'
import Register from '../features/auth/pages/Register.jsx'
import { clearError, clearUser, setAuthChecked, setError, setUser } from '../features/auth/auth.slice'
import Dashboard from '../features/chats/pages/Dashboard.jsx'
import Protected from '../features/auth/components/Protected.jsx'
import VerifyRequired from '../features/auth/pages/VerifyRequired.jsx'
import Profile from '../features/auth/pages/Profile.jsx'

const getRouteAuthError = (error) => {
    if (error?.errors?.length) {
        return error.errors.map((item) => item.msg).join(', ')
    }

    if (error?.message === 'unauthrized') {
        return 'Please login first'
    }

    return error?.message || 'Please login first'
}

const requireAuth = async () => {
    const authState = store.getState().auth

    if (authState.authChecked && authState.user) {
        if (!authState.user?.verified) {
            throw redirect('/verify-required')
        }

        return null
    }

    try {
        store.dispatch(setAuthChecked(false))
        store.dispatch(clearError())

        const data = await getme()

        store.dispatch(setUser(data.user))
        if (!data.user?.verified) {
            throw redirect('/verify-required')
        }

        return null
    } catch (error) {
        store.dispatch(clearUser())
        store.dispatch(setError(getRouteAuthError(error)))
        throw redirect('/login')
    }
}

const redirectIfAuthenticated = async () => {
    const authState = store.getState().auth

    if (authState.authChecked) {
        if (authState.user) {
            throw redirect(authState.user?.verified ? '/' : '/verify-required')
        }

        return null
    }

    try {
        store.dispatch(setAuthChecked(false))
        store.dispatch(clearError())

        const data = await getme()

        store.dispatch(setUser(data.user))
        throw redirect(data.user?.verified ? '/' : '/verify-required')
    } catch (error) {
        if (error instanceof Response) {
            throw error
        }

        store.dispatch(clearUser())
        store.dispatch(clearError())
        return null
    }
}

const requireUnverifiedUser = async () => {
    const authState = store.getState().auth

    if (authState.authChecked) {
        if (!authState.user) {
            throw redirect('/login')
        }

        if (authState.user?.verified) {
            throw redirect('/')
        }

        return null
    }

    try {
        store.dispatch(setAuthChecked(false))
        store.dispatch(clearError())

        const data = await getme()
        store.dispatch(setUser(data.user))

        if (data.user?.verified) {
            throw redirect('/')
        }

        return null
    } catch (error) {
        if (error instanceof Response) {
            throw error
        }

        store.dispatch(clearUser())
        store.dispatch(setError(getRouteAuthError(error)))
        throw redirect('/login')
    }
}

export const router = createBrowserRouter([
    {
        path: '/',
        loader: requireAuth,
        element: <Protected>
            <Dashboard />
        </Protected>
    },

    {
        path: '/login',
        loader: redirectIfAuthenticated,
        element: <Login />
    },
    {
        path: '/register',
        loader: redirectIfAuthenticated,
        element: <Register />

    },
    {
        path: '/verify-required',
        loader: requireUnverifiedUser,
        element: <VerifyRequired />,
    },
    {
        path: '/profile',
        loader: requireAuth,
        element: <Protected>
            <Profile />
        </Protected>,
    },
    {
        path: '/dashboard',
        element: <Navigate to='/' replace />
    }
]
)
