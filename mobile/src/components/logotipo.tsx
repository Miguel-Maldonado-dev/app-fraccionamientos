import { Image, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native'
import { useApariencia } from '../lib/apariencia'

const LOGO = require('../../assets/logotipo-weadmi.png')
/** Misma imagen con las letras en blanco, para fondos oscuros. */
const LOGO_BLANCO = require('../../assets/logotipo-weadmi-blanco.png')

/** Logotipo WEADMI; en oscuro usa la versión con letras blancas. */
export function Logotipo({ style, contenedor }: { style: StyleProp<ImageStyle>; contenedor?: StyleProp<ViewStyle> }) {
  const { esquema } = useApariencia()
  const imagen = (
    <Image
      testID={esquema === 'oscuro' ? 'logo-blanco' : 'logo'}
      source={esquema === 'oscuro' ? LOGO_BLANCO : LOGO}
      style={style}
      resizeMode="contain"
      accessibilityLabel="WEADMI"
    />
  )
  return contenedor ? <View style={contenedor}>{imagen}</View> : imagen
}
