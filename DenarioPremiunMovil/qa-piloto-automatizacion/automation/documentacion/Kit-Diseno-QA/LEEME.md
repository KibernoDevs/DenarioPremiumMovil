# Kit de diseño · Documentación de Denario

Todo lo necesario para que un manual, un panfleto o una infografía de Denario salga
alineado con lo que ya está publicado.

**Preparado por QA · septiembre 2026**

---

## Está pensado para trabajar con IA

No es un manual de diseño para seguir a mano: es un **texto que le pasas a la IA** para
que lo que produzca ya cumpla, y una **lista para revisar lo que devuelve**.

| Orden | Archivo | Qué haces con él |
|---|---|---|
| 1.º | **`PROMPT-MAESTRO.md`** | Lo copias y lo pegas en la IA **antes** de pedirle la pieza. Lleva la identidad, la estructura y las reglas de redacción |
| 2.º | **`plantillas/`** | Le adjuntas `ejemplo-flujo.html` o `ejemplo-faq.html` según el tipo de pieza. Una IA copia mucho mejor de un ejemplo que de una descripción |
| 3.º | **`CHECKLIST.md`** | Lo revisas contra lo que devolvió la IA. **Este paso no se salta**: es donde se atrapa lo que la IA se inventa |
| Consulta | **`REGLAS-DE-CONTENIDO.md`** | El porqué de cada regla, con los casos reales que las originaron |
| Consulta | **`ejemplos/`** | Tres piezas publicadas, en PDF, para ver el resultado |

## Cómo se usa, en corto

1. Abres una conversación nueva con la IA.
2. Pegas **`PROMPT-MAESTRO.md`** completo.
3. Adjuntas el ejemplo que corresponda (`plantillas/ejemplo-flujo.html` para un
   procedimiento con pasos, `ejemplo-faq.html` para preguntas y respuestas) junto con
   `plantillas/_estilo.css`.
4. Le das **el contenido**: de qué va la pieza, qué pasos tiene, qué advertencias.
5. Te devuelve un `.html`. Lo guardas junto a `_estilo.css` y `assets/`, y lo abres en
   el navegador para verlo.
6. Pasas el **`CHECKLIST.md`**. Lo que la IA no pudo verificar viene marcado
   `[VERIFICAR]` — eso se consulta, no se publica.
7. Para el PDF final: imprimir desde el navegador a PDF, tamaño A4, márgenes
   predeterminados y **activando «Gráficos de fondo»** (si no, sale sin colores).

## Qué es intocable y qué no

**Intocable:** la paleta, la cabecera con el logo, la cinta tricolor, la barra de cierre,
el pie, y las reglas de redacción.

**Flexible:** la estructura interna. Tres columnas funciona muy bien para un
procedimiento y bastante mal para otras cosas. Si la pieza no encaja, se adapta —
manteniendo la identidad.

## Si algo no encaja

Pregunta antes de improvisar. Detrás de cada regla hay un caso real que costó una
corrección, y casi siempre existe una salida que respeta la identidad. Escribe a QA.
