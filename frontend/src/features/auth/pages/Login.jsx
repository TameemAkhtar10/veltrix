import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const Login = () => {
    const { handlelogin, clearAuthError } = useAuth()
    const { loading, error, user, authChecked } = useSelector((state) => state.auth)

    const [formData, setFormData] = useState({ email: '', password: '' })

    let navigate = useNavigate()

    useEffect(() => {
        if (authChecked && user) {
            navigate('/', { replace: true })
        }
    }, [authChecked, navigate, user])

    const handleChange = (e) => {
        if (error) {
            clearAuthError()
        }

        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        const result = await handlelogin(formData.email, formData.password)

        if (result.success) {
            navigate('/', { replace: true })
        }
    }

    return (
        <section className="auth-shell page-shell min-h-dvh relative overflow-hidden flex items-center justify-center px-3 sm:px-4 md:px-8 py-6 sm:py-10">
            <div className="auth-card fade-rise relative w-full max-w-md sm:max-w-lg overflow-hidden">
                <main className="p-5 sm:p-7 md:p-8">
                    <div className="mb-6 sm:mb-7 text-center md:text-left">
                        <div className="mb-3 flex justify-center md:justify-start">
                            <span className="app-logo app-logo-md">
                                <img src="/favicon.svg" alt="Veltrix logo" className="app-logo-fill" />
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold">Welcome Back</h1>
                        <p className="auth-helper mt-1 text-sm">Login to continue your workspace journey.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="auth-error px-4 py-3 text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="auth-label mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em]">Email</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="you@company.com"
                                required
                                className="auth-input w-full rounded-xl px-4 py-3 text-sm outline-none transition"
                            />
                        </div>

                        <div>
                            <label className="auth-label mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em]">Password</label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Enter your password"
                                required
                                className="auth-input w-full rounded-xl px-4 py-3 text-sm outline-none transition"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="auth-primary-btn mt-1 cursor-pointer w-full px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {loading ? 'Signing In...' : 'Sign In'}
                        </button>
                    </form>

                    <div className="auth-divider mt-6 pt-4 text-center md:text-left">
                        <p className="auth-helper text-sm">
                            New here?{' '}
                            <Link to="/register" className="auth-link font-semibold no-underline">
                                Create an account
                            </Link>
                        </p>
                    </div>
                </main>
            </div>
        </section>
    )
}

export default Login
