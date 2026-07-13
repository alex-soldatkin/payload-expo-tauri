// Email + password sign-in against {serverURL}/api/users/login.
import { useState } from 'react'
import { login } from '../lib/api'

type Props = {
  serverURL: string
  onLoggedIn: (token: string, email: string) => void
  onChangeServer: () => void
}

export function LoginScreen({ serverURL, onLoggedIn, onChangeServer }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (busy) return
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { token, email: confirmed } = await login(serverURL, email.trim(), password)
      onLoggedIn(token, confirmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <div className="screen-drag" />
      <div className="screen-body">
        <div className="card">
          <h1>Sign in</h1>
          <p className="muted">
            {serverURL}{' '}
            <button className="link" onClick={onChangeServer} disabled={busy}>
              change server
            </button>
          </p>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoFocus
              spellCheck={false}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>

          {error && <div className="error-box">{error}</div>}

          <button className="primary" onClick={submit} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
