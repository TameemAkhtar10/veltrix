import React from 'react'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const VerifyRequired = () => {
    const { handlegetme, handlelogout } = useAuth()
    const { user, loading, error } = useSelector((state) => state.auth)
    const navigate = useNavigate()

    const checkVerificationStatus = async () => {
        const result = await handlegetme()
        if (result?.success && result?.data?.user?.verified) {
            navigate('/', { replace: true })
        }
    }

    const logoutNow = async () => {
        const result = await handlelogout()
        if (result?.success) {
            navigate('/login', { replace: true })
        }
    }

    return (
        <section className="auth-shell page-shell min-h-dvh relative overflow-hidden flex items-center justify-center px-3 sm:px-4 md:px-8 py-6 sm:py-10">
            <div className="auth-card fade-rise relative w-full max-w-md sm:max-w-lg overflow-hidden">
                <main className="p-5 sm:p-7 md:p-8 space-y-5">
                    <div className="text-center md:text-left">
                        <div className="mx-auto md:mx-0 mb-3 verified-logo overflow-hidden ">
                            <img src="/favicon.svg" alt="Veltrix logo" className="app-logo-fill" />
                        </div>
                        <h1 className="text-2xl font-bold">Verify Email First</h1>
                        <p className="auth-helper mt-2 text-sm">
                            Your account is not verified yet. Please open your inbox and click the verification link.
                        </p>
                        {user?.email && (
                            <p className="muted-text mt-2 text-xs">Signed in as {user.email}</p>
                        )}
                    </div>

                    {error && (
                        <div className="auth-error px-4 py-3 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={checkVerificationStatus}
                            disabled={loading}
                            className="auth-primary-btn w-full px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {loading ? 'Checking...' : 'I verified my email'}
                        </button>

                        <button
                            type="button"
                            onClick={logoutNow}
                            className="auth-secondary-btn w-full px-4 py-3 text-sm font-semibold transition"
                        >
                            Logout
                        </button>
                    </div>

                    <p className="auth-helper text-center md:text-left text-sm">
                        Back to{' '}
                        <Link to="/login" className="auth-link font-semibold no-underline">
                            Login
                        </Link>
                    </p>
                </main>
            </div>
        </section>
    )
}

export default VerifyRequired
