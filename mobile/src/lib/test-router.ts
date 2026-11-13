/** Mock de expo-router para pantallas: `jest.mock('expo-router', () => require('<ruta>/test-router').mockRouter)`. */
export const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() }
export const params: { current: Record<string, string> } = { current: {} }
export const mockRouter = {
  useRouter: () => router,
  useLocalSearchParams: () => params.current,
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react')
    useEffect(() => cb(), [cb])
  },
  Stack: { Screen: () => null },
  Redirect: () => null,
}
