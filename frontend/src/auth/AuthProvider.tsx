import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, readIdentity, subscribeIdentity, writeIdentity } from '../api/client'
import type { Identity, User } from '../types'

function useAuthState() {
  const client = useQueryClient()
  const [candidate, setCandidate] = useState<Identity | null>(readIdentity)
  useEffect(() => subscribeIdentity(next => {
    // Cancel outstanding requests and remove every user's cached data at the boundary.
    void client.cancelQueries()
    client.clear()
    setCandidate(next)
  }), [client])
  const session = useQuery({
    queryKey: ['auth', 'me', candidate?.token],
    queryFn: async ({ signal }) => (await api.get<User>('auth/me/', { signal })).data,
    enabled: !!candidate,
    staleTime: Infinity,
    retry: false,
  })
  const login = useMutation({
    mutationFn: async (credentials: {username: string; password: string}) =>
      (await api.post<Identity>('auth/login/', credentials)).data,
    onSuccess: result => {
      writeIdentity(result)
      // The successful password login has already verified this identity.
      client.setQueryData(['auth', 'me', result.token], result.user)
    },
  })
  const logout = useMutation({
    mutationFn: async () => { await api.post('auth/logout/') },
    onSuccess: () => { writeIdentity(null) },
  })
  return {
    identity: candidate && session.isSuccess ? {token: candidate.token, user: session.data} : null,
    checking: !!candidate && session.isPending,
    checkError: candidate && session.isError ? session.error : null,
    retry: () => { void session.refetch() },
    login, logout,
  }
}
const AuthContext = createContext<ReturnType<typeof useAuthState> | null>(null)
export function AuthProvider({children}: {children: ReactNode}) {
  const auth = useAuthState()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('AuthProvider is required')
  return auth
}
