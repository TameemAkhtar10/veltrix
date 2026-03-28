import React from 'react'
import { useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'

const Protected = (props) => {
    const { user, authChecked } = useSelector((state) => state.auth)

    if (!authChecked) {
        return (
            <section className="page-shell flex min-h-dvh items-center justify-center px-4">
                <div className="card-surface rounded-2xl px-6 py-4 text-sm">Loading...</div>
            </section>
        )
    }

    if (!user) {
        return <Navigate to="/login" />
    }
    return props.children
}

export default Protected
