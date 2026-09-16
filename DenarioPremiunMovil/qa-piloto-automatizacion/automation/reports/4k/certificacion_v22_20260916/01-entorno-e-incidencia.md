# Certificación v22 · IMPORTADORA 4K — entorno e incidencia de arranque

## Entorno medido (no supuesto)

| Parámetro | Valor medido |
|---|---|
| Cliente / empresa | **4k** · `DIESE` · GRUPO 4K — empresa única |
| Playa | **CARIBE** (declarada en el encargo; no se re-midió `ws_url` en runtime) |
| Build | `main.js` = **5.446.151** caracteres ✅ coincide con la APK del día |
| `versionApp` | `6.6.21.3` — **no discrimina builds**; el discriminante es el tamaño del bundle |
| `db_version` | 23 |
| Vendedor en el equipo | **`V.0030zgrancaracas`** · `id_user` 338 · JOAN BRICEÑO · **46 clientes** |
| Dispositivo | Infinix X6728 · Android 15 · CDP `:9220` · Chrome/152.0.7977.87 |
| Conducción | Node + Playwright de `automation/playwright/node_modules` (`connectOverCDP`) |
| Contraste de VGs | **187 equipo · 187 nube · coinciden** (verificado antes de cada módulo) |
| Corte de referencias | `max(id_collection)` = **2831** al arrancar |

⚠ El encargo decía baseline **2829**. Al medirlo estaba en **2831**: la otra QA creó 2830 y 2831
(cliente C.1071, comentario `g`, 14:31Z). Cotejo hecho **por marca de comentario**, nunca por rango.

---

## 🔴 Incidencia de arranque: el guion de LOGIN tumbó la corrida completa

**Qué pasó.** La primera pasada (`script_4k_20260916_105201`) murió en 20 segundos: `login` dejó la
app en la pantalla de acceso y los nueve módulos siguientes salieron con
`volverAHome: app en login` ⇒ 158 BLOCKED y 11 FAIL que **no miden nada del producto**.

**Por qué.** Las credenciales del repo para `4k`
(`secrets/qa-credentials.env` → `QA_USER=V.0002zonacentral`) **no son las del equipo**, que estaba
con `V.0030zgrancaracas`. Al teclear un usuario distinto, la app levanta:

> «Está intentando sincronizar con un usuario que es diferente al previamente ingresado, de aceptar
> la sincronización **todos los datos anteriores serán borrados**. ¿Está de acuerdo?» — `Cancelar` / `Aceptar`

- `DM-LOG-003` (contraseña incorrecta) leyó **esa** alerta en vez de una de credenciales ⇒ FAIL.
- `DM-LOG-001` (login correcto) no pudo pasar de ahí ⇒ FAIL, y el resto en cascada.

**Qué se hizo.** Se pulsó **CANCELAR**, no Aceptar. Aceptar habría borrado la base local, que en ese
momento tenía **10 cobros «Por Enviar» de la otra QA** (`CIE24-*`, de las 10:00–10:31) más 5 borradores
de agosto. Después se volvió a entrar con **el mismo usuario del equipo** (`V.0030zgrancaracas`), que
**no** dispara la alerta de borrado. HOME en 41 s, datos intactos:
46 clientes · 1.432 productos · 182 documentos · 60 cobros.
Los 10 pendientes de la otra QA salieron a la nube en ese login (ya estaban como 2822-2831).

**Etiqueta: SCRIPT/DATO — no es un defecto del producto.** La app hizo lo correcto: avisar y pedir
confirmación antes de borrar. Lo que está mal es el dato del repo.

> 📌 **Acción para el repo:** `secrets/qa-credentials.env` bloque `# Cliente: 4k` apunta a
> `V.0002zonacentral`. O se actualiza al vendedor con el que se trabaja, o `login` debe excluirse de
> la barrida cuando el equipo esté con otro usuario. **Tal como está, correr `login` cuesta la corrida entera.**

---

## 🔴 Segundo hallazgo de datos: el perfil YAML era de otro vendedor

`automation/clientes/4k.yaml` traía los clientes medidos el 14/09 **para `V.0002`**. Comprobado contra
la nube: **ninguno de los 12** pertenece a `V.0030`
(`select … from active_clients where id_user=338` → 0 filas).
Sin corregirlo, `cobros`, `pedidos`, `visitas`, `inventarios` y `devoluciones` habrían arrancado contra
clientes que la pantalla no lista.

Se rehizo el perfil con la cartera real, leída del **SQLITE DEL EQUIPO** (la misma fuente que pinta la
pantalla) y anotado en el propio YAML. Empresa comprobada: `products.co_enterprise = DIESE`.

Esto ya lo había detectado la corrida `cierre_anticipo_20260916` de esta misma mañana y lo dejó escrito
en `_escrituras-de-prueba.md`; la barrida seguía usando el dato viejo.

---

## Corrida efectiva

Tras restaurar la sesión se relanzaron los **nueve módulos restantes uno a uno**
(`--modulo=<nombre>`), **excluyendo `login`** para no volver a tumbar la sesión.
Log: `_barrida.log`. Los veredictos de `login` que se citan son los de la primera pasada.
