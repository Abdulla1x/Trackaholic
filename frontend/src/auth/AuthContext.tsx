import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../api/client'
import type { User } from '../types'
import { localIsoDate } from '../lib/dates'
import { clearToken, getToken, setToken } from './token'
import { isInvalidSession } from './session'

interface AuthState {
  user: User | null
  loading: boolean
  unreachable: boolean
  retry: () => void
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  loginWithGoogle: (credential: string) => Promise<void>
  startDemo: () => Promise<void>
  endDemo: (options?: { quiet?: boolean }) => Promise<void>
  logout: () => void
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  deleteAccount: (confirm: { password: string } | { google_credential: string }) => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => getToken() !== null)
  // The server couldn't say whether the stored login is good: it was
  // unreachable, timed out or failed. Not the same as "signed out".
  const [unreachable, setUnreachable] = useState(false)

  // Validate the stored token against the backend on load.
  //
  // ⚠️ Only a 401 signs anyone out. Every failure used to clear the token, so a
  // server restarting under load (2026-10-21: three health-check restarts while
  // the date arrow was held) sent a signed-in user to the login page with
  // nothing wrong with their login. Any other failure keeps the token and
  // offers a retry (RequireAuth).
  const validate = useCallback(() => {
    if (!getToken()) return
    setLoading(true)
    setUnreachable(false)
    api
      .me()
      .then(setUser)
      .catch((err: unknown) => {
        if (isInvalidSession(err)) clearToken()
        else setUnreachable(true)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(validate, [validate])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login(email, password)
    setToken(response.access_token)
    setUser(response.user)
  }, [])

  const signup = useCallback(async (email: string, password: string) => {
    const response = await api.signup(email, password)
    setToken(response.access_token)
    setUser(response.user)
  }, [])

  // Sign in and sign up are one call: the server creates the account the
  // first time it sees this Google account.
  const loginWithGoogle = useCallback(async (credential: string) => {
    const response = await api.googleSignIn(credential)
    setToken(response.access_token)
    setUser(response.user)
  }, [])

  // A demo is an account the server makes on the spot, so it signs in like
  // the other ways in; only its token is marked as a demo's (auth/token.ts).
  // The visitor's own date, so the made-up month ends on their today.
  const startDemo = useCallback(async () => {
    const response = await api.startDemo(localIsoDate())
    setToken(response.access_token, true)
    setUser(response.user)
  }, [])

  // Throws if the server didn't delete it, so End demo can say so and keep
  // the visitor where they are. `quiet` signs out either way: Create an
  // account has already moved on to sign-up, and a demo the server missed is
  // purged with the rest after 24 hours.
  const endDemo = useCallback(async ({ quiet = false } = {}) => {
    const token = getToken()
    try {
      await api.endDemo()
    } catch (err) {
      if (!quiet) throw err
    }
    // Unless someone signed in meanwhile: sign-up is already on screen when
    // Create an account ends the demo, and its new token must survive.
    if (getToken() !== token) return
    clearToken()
    setUser(null)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUnreachable(false)
    setUser(null)
  }, [])

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      // The backend revokes all previous tokens and returns a fresh one;
      // storing it keeps this session logged in.
      const response = await api.changePassword(currentPassword, newPassword)
      setToken(response.access_token)
      setUser(response.user)
    },
    [],
  )

  const deleteAccount = useCallback(async (confirm: { password: string } | { google_credential: string }) => {
    await api.deleteAccount(confirm)
    clearToken()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        unreachable,
        retry: validate,
        login,
        signup,
        loginWithGoogle,
        startDemo,
        endDemo,
        logout,
        changePassword,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used within AuthProvider')
  return auth
}
