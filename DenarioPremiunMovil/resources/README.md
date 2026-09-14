# Recursos nativos (icono y splash)

Fuentes en esta carpeta:

| Archivo | Uso |
|---------|-----|
| `icon-only.png` | Icono iOS/Android (1024×1024) |
| `splash.png` | Splash modo claro |
| `splash2.png` | Splash modo oscuro (dark) |

## Capacitor (recomendado)

Genera icono y splash en el proyecto iOS:

```bash
cd DenarioPremiunMovil
npm run assets:ios
```

Salida: `ios/App/App/Assets.xcassets/AppIcon.appiconset/` y `Splash.imageset/`.

Los PNG versionados en git están en la raíz del repo (`.gitignore` con excepciones para esos paths).

## Cordova (legacy)

Ver documentación Cordova si usas `config.xml` / `ionic cordova resources`.
