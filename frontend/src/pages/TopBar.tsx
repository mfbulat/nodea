import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'

export default function TopBar({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuth()
  return (
    <div className="topbar">
      <Link to="/" className="brand" style={{ color: 'inherit', textDecoration: 'none' }}>MindMap</Link>
      {children}
      <div className="spacer" />
      <Link to="/account" className="muted">{user?.email}</Link>
      <button onClick={() => logout()}>Выйти</button>
    </div>
  )
}
