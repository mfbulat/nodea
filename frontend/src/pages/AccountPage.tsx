import { FormEvent, useState } from 'react'
import { api } from '../api/client'
import TopBar from './TopBar'

export default function AccountPage() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await api('/api/auth/change-password', { method: 'POST', json: { current_password: current, new_password: next } })
      setMsg({ ok: true, text: 'Password changed. Other sessions have been signed out.' })
      setCurrent(''); setNext('')
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }) }
  }

  return (
    <>
      <TopBar />
      <form className="auth" onSubmit={submit}>
        <h1>Change Password</h1>
        <input type="password" placeholder="Current password" value={current} onChange={e => setCurrent(e.target.value)} required />
        <input type="password" placeholder="New password (8+ characters)" value={next} onChange={e => setNext(e.target.value)} required minLength={8} />
        {msg && <div className={msg.ok ? 'muted' : 'error'}>{msg.text}</div>}
        <button className="primary">Change Password</button>
      </form>
    </>
  )
}
