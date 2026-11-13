const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Los tests viven junto a las rutas de app/; Expo Router no debe empaquetarlos.
const bloqueo = /.*\.test\.tsx?$/
const actual = config.resolver.blockList
config.resolver.blockList = actual ? [].concat(actual, bloqueo) : bloqueo

module.exports = config
