// Secure store en memoria para pruebas.
jest.mock('expo-secure-store', () => {
  const datos = new Map<string, string>()
  return {
    getItemAsync: jest.fn(async (k: string) => datos.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void datos.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void datos.delete(k)),
    __datos: datos,
  }
})
jest.mock('expo-device', () => ({ modelName: 'iPhone de prueba' }))
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }))
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(async () => {}), impactAsync: jest.fn(async () => {}), ImpactFeedbackStyle: { Light: 'light' }, NotificationFeedbackType: { Success: 'success' } }))
jest.mock('expo-file-system', () => {
  const escritos: { uri: string; bytes: Uint8Array }[] = []
  class File {
    uri: string
    constructor(...partes: (string | { uri: string })[]) {
      this.uri = partes.map((p) => (typeof p === 'string' ? p : p.uri)).join('/')
    }
    async write(bytes: Uint8Array) {
      escritos.push({ uri: this.uri, bytes })
    }
  }
  return { File, Paths: { cache: { uri: 'file:///cache' } }, __escritos: escritos }
})
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => {}), isAvailableAsync: jest.fn(async () => true) }))
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.2.3', nativeBuildVersion: '45' }))
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }))
