import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { abrir, type BotonEstado } from '../lib/inicio'
import { BotonAcceso } from './boton-acceso'

jest.mock('../lib/supabase')
jest.mock('../lib/inicio', () => ({ abrir: jest.fn() }))
const abrirMock = abrir as jest.Mock

const boton = (extra: Partial<BotonEstado> = {}): BotonEstado => ({
  id: 7,
  orden: 1,
  nombre: 'Peatonal',
  icono: 'peatonal',
  ancho_completo: true,
  habilitado: true,
  ...extra,
})
const fondo = () => StyleSheet.flatten(screen.getByTestId('boton-7').props.style).backgroundColor

beforeEach(() => abrirMock.mockReset())

test('muestra el nombre y pinta azul_claro si no trae estilo', async () => {
  await render(<BotonAcceso boton={boton()} domicilioId={1} completo />)
  expect(screen.getByText('Peatonal')).toBeTruthy()
  expect(fondo()).toBe('#E6F1FD')
  expect(screen.queryByTestId('degradado-7')).toBeNull()
})

test('estilo azul usa degradado', async () => {
  await render(<BotonAcceso boton={boton({ estilo: 'azul' })} domicilioId={1} completo />)
  expect(screen.getByTestId('degradado-7')).toBeTruthy()
})

test('Abriendo… y luego Abierto ✓', async () => {
  jest.useFakeTimers()
  let soltar!: (v: { status: string }) => void
  abrirMock.mockReturnValue(new Promise((r) => (soltar = r)))
  await render(<BotonAcceso boton={boton({ estilo: 'azul' })} domicilioId={3} completo={false} />)
  await fireEvent.press(screen.getByTestId('boton-7'))
  expect(screen.getByText('Abriendo…')).toBeTruthy()
  expect(abrirMock).toHaveBeenCalledWith(3, 7)
  await act(async () => soltar({ status: 'opened' }))
  expect(screen.getByText('Abierto ✓')).toBeTruthy()
  await act(async () => void jest.advanceTimersByTime(2000))
  expect(screen.getByText('Peatonal')).toBeTruthy()
  jest.useRealTimers()
})

test('deshabilitado (moroso) con estilo azul: gris, sin degradado y no llama onPress', async () => {
  await render(<BotonAcceso boton={boton({ estilo: 'azul', habilitado: false })} domicilioId={1} completo />)
  expect(fondo()).toBe('#EEF2F6')
  expect(screen.queryByTestId('degradado-7')).toBeNull()
  await fireEvent.press(screen.getByTestId('boton-7'))
  expect(abrirMock).not.toHaveBeenCalled()
})
