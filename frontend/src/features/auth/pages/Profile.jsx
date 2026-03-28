import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { setchatlist, setchats, setcurrentchatId, seterror } from '../../chats/chat.slice'

const Profile = () => {
    const { user } = useSelector((state) => state.auth)
    const { handlelogout } = useAuth()
    const dispatch = useDispatch()
    const navigate = useNavigate()

    const profileName = user?.username || 'User'
    const profileEmail = user?.email || 'Not available'
    const profileId = user?._id || 'Not available'
    const profileLetter = (profileName?.[0] || 'U').toUpperCase()
    console.log('User data in Profile component:', user)

    const handleBack = () => {
        navigate('/', { replace: true })
    }

    const handleProfileLogout = async () => {
        const result = await handlelogout()
        if (!result?.success) return

        dispatch(setchatlist([]))
        dispatch(setchats([]))
        dispatch(setcurrentchatId(null))
        dispatch(seterror(null))
        navigate('/login', { replace: true })
    }

    return (
        <section className="profile-shell min-h-dvh px-4 py-8">
            <div className="mx-auto w-full max-w-3xl">
                <button
                    type="button"
                    onClick={handleBack}
                    className="muted-action mb-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition"
                >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                    Back to chat
                </button>

                <div className="profile-panel rounded-2xl p-6 sm:p-8">
                    <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                        <div className="profile-avatar flex h-18 w-18 items-center justify-center rounded-full text-2xl font-bold">
                            {profileLetter}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">{profileName}</h1>
                            <p className="muted-text mt-1 text-sm">Manage your account details</p>
                        </div>
                    </div>

                    <div className="mt-8 grid gap-4 sm:grid-cols-2">
                        <div className="card-surface rounded-xl p-4">
                            <p className="muted-text text-xs uppercase tracking-[0.18em]">Email</p>
                            <p className="mt-2 break-all text-sm">{profileEmail}</p>
                        </div>

                        <div className="card-surface rounded-xl p-4">
                            <p className="muted-text text-xs uppercase tracking-[0.18em]">User ID</p>
                            <p className="mt-2 break-all text-sm">{profileId}</p>
                        </div>
                    </div>

                    <div className="mt-6 border-t dashboard-divider pt-6">
                        <button
                            type="button"
                            onClick={handleProfileLogout}
                            className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition"
                        >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                <path d="M10 17l5-5-5-5" />
                                <path d="M15 12H3" />
                            </svg>
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default Profile
