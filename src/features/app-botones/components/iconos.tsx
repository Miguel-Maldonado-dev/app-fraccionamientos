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
} from 'lucide-react'
import type { Icono } from '../schemas'

export const ICONO_INFO: Record<Icono, { Icon: LucideIcon; etiqueta: string }> = {
  puerta: { Icon: DoorOpen, etiqueta: 'Puerta' },
  pluma: { Icon: Construction, etiqueta: 'Pluma' },
  peatonal: { Icon: PersonStanding, etiqueta: 'Peatonal' },
  vehiculo: { Icon: CarFront, etiqueta: 'Vehicular' },
  alberca: { Icon: Waves, etiqueta: 'Alberca' },
  gimnasio: { Icon: Dumbbell, etiqueta: 'Gimnasio' },
  salon: { Icon: PartyPopper, etiqueta: 'Salón' },
  otro: { Icon: KeyRound, etiqueta: 'Otro' },
}
