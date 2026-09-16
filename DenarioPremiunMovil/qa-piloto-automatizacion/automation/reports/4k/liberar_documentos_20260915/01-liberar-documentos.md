# Liberar documentos — IMPORTADORA 4K (playa Caribe)

**Fecha:** 2026-09-15 · **Tipo:** tarea operativa (no validación) · **Alcance:** solo web + BD
**Web:** `http://denariocaribe.ddns.net:8080/DenarioPremium` · empresa **DIESE / GRUPO 4K** (`id_enterprise=1`)
**RUN_DIR:** `automation/reports/4k/liberar_documentos_20260915/`

---

## ⛔ RESULTADO: BLOQUEADA — no se rechazó ni se aprobó ningún cobro

**No se modificó ni un solo registro.** El archivo `automation/clientes/_escrituras-de-prueba.md`
**no se tocó**, porque no hubo escrituras que anotar.

Hubo **dos intentos** (2ª vuelta con la clave vigente). Se frenó por **tres motivos**, en este orden
de importancia:

| # | Motivo | Estado |
|---|---|---|
| **1** | 🔴 **QA sigue trabajando dentro y ya tomó cobros de mi lista** | condición de PARADA que fijó el coordinador |
| **2** | 🔴 **Una corrida móvil sigue CREANDO cobros nuevos** que comprometen documentos | el contador es un blanco móvil |
| **3** | ⚠ El entorno **bloquea por permisos** los scripts que conducen el login web | impedimento técnico |

✅ **La clave vigente de `admin` es correcta: entró a `/pages/main` sin problema.** El bloqueo del
primer informe queda resuelto. No se escribió en ningún archivo.

---

## 1 · 🔴 QA sigue dentro — y ya rechazó el primero de mi lista

El coordinador fijó: *«si al volver a medir ves que siguen cambiando cobros que tú no has tocado,
para y avísame»*. **Se cumplió.**

| Ref | Cambio | Hora | ¿Lo hice yo? |
|---|---|---|---|
| 2764 | 3 → **2** | 09:09:29 | ❌ no |
| 2759 | 3 → **2** | 09:10:39 | ❌ no |
| **2758** | 3 → **2** | **09:25:11** | ❌ **no — y era el 1.º de mi lista tras el 2708** |

Entre las 09:18 y las 09:28 hubo **un silencio de 8 minutos** que parecía vía libre; a los pocos
minutos llegó el de las 09:25. ⇒ **El silencio corto NO es prueba de que QA haya salido**: su ritmo
tiene pausas de hasta 12 min (ver el cronómetro más abajo). **Hace falta confirmación humana, no otra
medición.**

## 2 · 🔴 Hallazgo nuevo: el contador es un blanco móvil

A las **09:22:56** apareció el cobro **2765** (`co_type=0`, `C.0898`, comentario `Test-DTO-761564`,
**1 documento**, estatus 3). Nace ya **comprometiendo un documento**.

Eso explica una aritmética que si no despista:

```
110 (inicio)  − 3 rechazos ajenos (2764, 2759, 2758)  + 1 cobro nuevo (2765)  = 108
```

| Momento | Documentos comprometidos |
|---|---|
| 09:0x (apertura) | **110** |
| 09:13 | 108 |
| 09:18 | 108 |
| 09:28 (cierre) | **108** |

⚠ **El contador lleva 15 min clavado en 108 aunque se rechazaron 3 cobros.** Una corrida de cobros
sigue viva y repone lo que se libera.

🔑 **Consecuencia práctica:** mientras la corrida móvil siga produciendo, «liberar 25-30 documentos»
**no se puede verificar con la foto del contador** — hay que medirlo sobre la **lista nominal de
referencias** que uno cambió. Y conviene **parar la corrida de cobros primero**, o el trabajo se
come a sí mismo.

## 3 · ⚠ El entorno bloquea los scripts que conducen el login

La clave vigente **funciona** — se verificó una vez:

```
LOGIN -> http://denariocaribe.ddns.net:8080/DenarioPremium/pages/main
GROWL=(ninguno)
```

A partir de ahí, **todo script que hiciera login quedó denegado por el clasificador de permisos**,
en `Bash` y en `PowerShell` por igual. **No se intentó esquivarlo.** La clave **no se escribió** en
el informe, ni en `_results.jsonl`, ni en ningún archivo del repositorio; el fichero efímero que se
usó para pasarla **se borró**.

### 🔑 Pista técnica encontrada de paso — la sesión se cae al navegar por URL

Con la sesión recién hecha en `/pages/main`, un `goto` directo a **`/pages/cobros` devolvió la
pantalla de login**, con la `JSESSIONID` todavía en el navegador.

⚠ **Contradice la nota de `automation/web/playas.yaml`**, que afirma que la navegación directa por
URL funciona con sesión activa. **Una sola muestra — es una PISTA, no un hallazgo.** Hay que
reconfirmarlo y, si se sostiene, navegar **por el menú** y corregir esa nota.

---

## 4 · Guarda 1 — ¿hay selección múltiple? **SIGUE SIN RESPONDER**

Es lo único que convertiría ~85 min en minutos, y **es lo primero que hay que mirar al reanudar**.
Se llegó a `/pages/main` pero no a ver `/pages/cobros` (ver §3).

## 5 · Guarda 2 — ¿aprobar libera igual? **Respondida a medias, desde la BD**

No hizo falta la web: el histórico ya tiene **113 cobros `co_type=0` aprobados** (`st_collection=1`).

```sql
SELECT c.st_collection, count(DISTINCT c.id_collection) AS cobros, count(*) AS pares_cobro_doc,
       count(*) FILTER (WHERE d.nu_balance > 0) AS doc_con_saldo,
       count(*) FILTER (WHERE d.nu_balance = 0) AS doc_saldo_cero
FROM collection c JOIN collection_detail cd ON cd.id_collection=c.id_collection
JOIN document_sale d ON d.nu_document=cd.co_document AND d.id_enterprise=1 AND d.co_operation='I'
WHERE c.id_enterprise=1 AND c.co_type=0 GROUP BY 1;
```

| `st_collection` | Cobros | Pares cobro-doc | Doc con saldo > 0 | Doc con saldo = 0 |
|---|---|---|---|---|
| **1 · Aprobado** | 113 | 126 | **125** | 1 |
| **2 · Rechazado** | 15 | 17 | 15 | 0 |
| **3 · Por aprobar** | 110 | 119 | 117 | 0 |

🔑 **Aprobar NO consume el saldo del documento**: 125 de 126 documentos de cobros ya aprobados
siguen con `nu_balance > 0`. Y como el oráculo de «comprometido» filtra `st_collection = 3`,
**aprobar saca al cobro del conjunto exactamente igual que rechazar** — y sin comentario obligatorio,
que es el paso que probablemente cuelga.

⚠ **Caveat honesto, por eso es «a medias»:** esto dice que el documento **queda con saldo** y sale
del oráculo. **No prueba** que el móvil vuelva a ofrecerlo en la lista de documentos por cobrar —
eso solo se confirma abriendo un cobro nuevo en la app, que está fuera de alcance («el teléfono no se
toca»). ⇒ **Probarlo con UNO y verificar**, antes de adoptarlo para el lote.

---

## 6 · Cronómetro (guarda 3) — medido sin tocar nada

El ritmo se sacó de los `da_update` de la tanda manual de QA, no del reloj propio:

```
08:31:15 2761 · 08:32:48 2760 · 08:33:33 2762 · 08:34:34 2763 · 08:35:29 2737
08:36:21 2716 · 08:36:53 2748 · 08:37:30 2720 · 08:38:33 2753 · 08:39:49 2735
08:45:38 2694 · 08:57:52 2751 · 09:09:29 2764 · 09:10:39 2759 · 09:25:11 2758
```

| Tramo | Cobros | Duración | **Segundos por cobro** |
|---|---|---|---|
| **Tramo bueno** (08:31 → 08:39) | 10 | 8 min 34 s | **~51 s** |
| **Tramo con atascos** (08:39 → 09:25) | 5 | 45 min 22 s | **~545 s (9,1 min)** |
| **Global** (08:31 → 09:25) | 15 | 53 min 56 s | **~216 s (3,6 min)** |

⇒ **Es el escenario caro, no el de 30 s.** A ritmo global, **25-30 cobros ≈ 90-108 min**.
El patrón «10 seguidos rápido y después se cuelga» encaja con el «se queda pegado → refrescar».

---

## 7 · Documentos comprometidos — antes y después

```sql
SELECT count(DISTINCT cd.co_document) AS documentos_comprometidos
FROM   collection c
JOIN   collection_detail cd ON cd.id_collection = c.id_collection
JOIN   document_sale d ON d.nu_document = cd.co_document
                      AND d.id_enterprise = 1 AND d.co_operation = 'I' AND d.nu_balance > 0
WHERE  c.id_enterprise = 1 AND c.st_collection = 3 AND c.co_type = 0;
```

| Momento | Documentos comprometidos |
|---|---|
| Inicio (09:0x) | **110** |
| Cierre (09:28) | **108** |
| **Liberados por mí** | **0** |

🔴 **Los 2 de diferencia NO son míos**: son el saldo neto de 3 rechazos ajenos menos 1 cobro nuevo.
**Yo no ejecuté ninguna escritura.**

---

## 8 · Lista de referencias cambiadas

**Ninguna.** Tabla vacía a propósito.

| Ref | Estado anterior | Estado nuevo |
|---|---|---|
| — | — | — |

---

## 9 · Trabajo preparado para reanudar sin repetir análisis

Relación **1 documento por cobro** (sin documentos compartidos) ⇒ **cada cobro liberado = 1 documento**.

### Orden de trabajo — actualizado al cierre

**Primero, lo que pidió QA expresamente:**

| Ref | Tipo | Cliente | Documentos | Estado al cierre |
|---|---|---|---|---|
| **2708** | 0 | `C.0864` | `00022180` (saldo 2.552,00) + `*0001523` (saldo −244,00) | **3 · pendiente** ✅ sigue disponible |
| **2709** | 1 (anticipo) | `C.0864` | — (sin documentos) | **3 · pendiente** ✅ sigue disponible |

⚠ **Matiz sobre 2708:** de sus 2 documentos **solo `00022180` cuenta en el oráculo**. La N/C
`*0001523` tiene **saldo negativo (−244,00)** y el filtro `nu_balance > 0` la excluye ⇒ **el contador
bajará 1, no 2**, aunque se liberen los dos papeles. No es un fallo del rechazo.

**Después, de la referencia más alta hacia abajo.** 🔴 **2764, 2759 y 2758 YA LOS HIZO QA — saltarlos:**

```
2757 2756 2755 2754 2752 2749 2747 2745 2744 2743 2742 2741 2740 2738 2734
2732 2731 2730 2729 2728 2726 2725 2724 2723 2722 2721 2718
```

Con **2708 + 27 de esa lista = 28 cobros ⇒ 28 documentos**, dentro del objetivo de 25-30.

> ⚠ **Reverificar estatus justo antes de tocar cada uno.** Esta lista caduca: QA avanza sobre ella
> y la corrida móvil añade referencias nuevas por arriba (2765 y las que sigan).

### Oráculo por cobro (una sola pulsación de Aceptar)

```sql
SELECT id_collection, st_collection, da_update FROM collection WHERE id_collection = <ref>;
-- 3 = Por aprobar · 2 = Rechazado · 1 = Aprobado
```

**Comentario a poner:** `QA - liberar documentos`

⚠ **Dónde NO buscar la confirmación:** `collection.tx_comment` **conserva el comentario original del
cobro** (`Test-TOL-DENTRO-...`, `Test-DTO-...`) incluso después de rechazarlo — confirmado en 2758 y
2759. ⇒ Buscar `QA - liberar documentos` en `tx_comment` daría un **falso negativo**.
**El único oráculo válido es `st_collection`.**

### 🔴 Guardas para quien reanude

1. **Confirmar con QA que ha salido** — el silencio de pocos minutos no basta (sus pausas llegan a 12 min).
2. **Parar la corrida de cobros**, o el contador no bajará nunca.
3. **Nada por debajo de 2629** — cobros reales del cliente, de diciembre 2025 (200.000 / 339.300).
4. **Solo `co_type = 0`** (salvo el 2709, pedido expresamente).
5. **Aceptar UNA sola vez**, esperar, preguntar a la BD. Nunca insistir a ciegas.
6. **Mirar primero si hay selección múltiple** (guarda 1, sin responder).
7. **Navegar por el menú, no por URL** hasta reconfirmar la pista de §3.

---

## Anexo · Verificación de tenant y de higiene

| Comprobación | Valor |
|---|---|
| Base consultada | `4k` (RDS `savia`, `user_read`) |
| `id_enterprise` | `1` |
| Playa | `caribe` — `denariocaribe.ddns.net:8080` (CONTABO) |
| Login web verificado | ✅ `admin` → `/pages/main` |
| Escrituras ejecutadas | **0** — solo `SELECT` |
| Clave en archivos del repo | **ninguna**; el fichero efímero usado se borró |
