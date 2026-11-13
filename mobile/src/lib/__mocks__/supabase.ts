export const supabase = {
  auth: {
    getSession: jest.fn(),
    refreshSession: jest.fn(),
    signInWithPassword: jest.fn(),
    updateUser: jest.fn(async () => ({ data: {}, error: null })),
    signOut: jest.fn(async () => ({ error: null })),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
  },
  from: jest.fn(),
}
