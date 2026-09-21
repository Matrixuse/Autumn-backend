import { registerPlugin } from '@capacitor/core'

export const AutumnMedia = registerPlugin('AutumnMedia', {
  web: () => import('./nativeMediaWeb').then((module) => new module.AutumnMediaWeb())
})
