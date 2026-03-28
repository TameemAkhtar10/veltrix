import { createHashRouter, isRouteErrorResponse, Link, Navigate, redirect, useRouteError } from 'react-router-dom'
import { store } from './App.Store'
import { getme } from '../features/auth/services/auth.api'
import Login from '../features/auth/pages/Login.jsx'
import Register from '../features/auth/pages/Register.jsx'
import { clearError, clearUser, setAuthChecked, setError, setUser } from '../features/auth/auth.slice'
import Dashboard from '../features/chats/pages/Dashboard.jsx'
import Protected from '../features/auth/components/Protected.jsx'
import VerifyRequired from '../features/auth/pages/VerifyRequired.jsx'
import Profile from '../features/auth/pages/Profile.jsx'

const RouteErrorFallback = () => {
    const error = useRouteError()

    let heading = 'Something went wrong'
    let detail = 'Please refresh and try again.'

    if (isRouteErrorResponse(error)) {
        heading = `${error.status} ${error.statusText}`
        detail = error.data?.message || 'The requested page could not be loaded.'
    } else if (error?.message) {
        detail = error.message
    }

    return (
        <section className="page-shell flex min-h-dvh items-center justify-center px-4">
            <div className="card-surface w-full max-w-md rounded-2xl p-6 text-center">
                <h1 className="text-2xl font-bold">{heading}</h1>
                <p className="muted-text mt-2 text-sm">{detail}</p>
                <div className="mt-5 flex justify-center gap-3">
                    <Link to="/" className="btn-primary px-4 py-2 text-sm font-semibold no-underline">Go Home</Link>
                    <Link to="/login" className="px-4 py-2 text-sm font-semibold no-underline">Login</Link>
                </div>
            </div>
        </section>
    )
}

const routeErrorElement = <RouteErrorFallback />

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

export const router = createHashRouter([
    {
        path: '/',
        loader: requireAuth,
        errorElement: routeErrorElement,
        element: <Protected>
            <Dashboard />
        </Protected>
    },

    {
        path: '/login',
        loader: redirectIfAuthenticated,
        errorElement: routeErrorElement,
        element: <Login />
    },
    {
        path: '/register',
        loader: redirectIfAuthenticated,
        errorElement: routeErrorElement,
        element: <Register />

    },
    {
        path: '/verify-required',
        loader: requireUnverifiedUser,
        errorElement: routeErrorElement,
        element: <VerifyRequired />,
    },
    {
        path: '/profile',
        loader: requireAuth,
        errorElement: routeErrorElement,
        element: <Protected>
            <Profile />
        </Protected>,
    },
    {
        path: '/index.html',
        errorElement: routeErrorElement,
        element: <Navigate to='/' replace />
    },
    {
        path: '/dashboard',
        errorElement: routeErrorElement,
        element: <Navigate to='/' replace />
    },
    {
        path: '*',
        errorElement: routeErrorElement,
        element: <Navigate to='/' replace />
    }
])
