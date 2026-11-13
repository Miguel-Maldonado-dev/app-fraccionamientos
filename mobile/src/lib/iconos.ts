import {
  CarFront,
  Construction,
  DoorOpen,
  Dumbbell,
  KeyRound,
  PartyPopper,
  PersonStanding,
  Waves,
  type LucideIcon,
} from 'lucide-react-native'

/** Mismo set que la web (src/features/app-botones/components/iconos.tsx). */
export const ICONOS: Record<string, LucideIcon> = {
  puerta: DoorOpen,
  pluma: Construction,
  peatonal: PersonStanding,
  vehiculo: CarFront,
  alberca: Waves,
  gimnasio: Dumbbell,
  salon: PartyPopper,
  otro: KeyRound,
}

/** Ícono desconocido ⇒ DoorOpen. */
export const iconoBoton = (icono: string): LucideIcon => (Object.hasOwn(ICONOS, icono) ? ICONOS[icono] : DoorOpen)
