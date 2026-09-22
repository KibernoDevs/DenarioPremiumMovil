# Revisión antes de entregar

Para pasar sobre lo que devolvió la IA. **Este paso no se salta.** Una IA escribe con
mucha seguridad cosas que no le constan: promete tiempo real, afirma que los datos van
cifrados y se inventa cifras exactas porque suenan bien. Todo eso hay que cazarlo aquí.

Lleva unos cinco minutos.

---

## 1 · Lo que la IA se inventa

- [ ] Busca **«tiempo real», «al instante», «inmediatamente», «automáticamente»**. Cada
      aparición: ¿es verdad, o eso viaja **al sincronizar**?
- [ ] Busca promesas de seguridad: **«cifrado», «encriptado», «seguro», «protegido»**. Si
      nadie lo confirmó, fuera.
- [ ] Busca **cifras**: metros, minutos, cantidades, límites. ¿De dónde salió cada una? Si
      no te la dieron, fuera o `[VERIFICAR]`.
- [ ] Busca **`[VERIFICAR]`**: son las dudas que la IA marcó. Consúltalas — no se publican
      así.
- [ ] ¿Alguna frase describe **lo que el usuario ve en pantalla** (un color, un estado, un
      botón)? Eso lo confirma QA antes de salir.

## 2 · Cómo está escrito

- [ ] Sin lenguaje técnico: nada de «offline», «push», «ERP» suelto, «integración».
- [ ] Cada instrucción importante trae **su motivo**.
- [ ] Las claves de éxito son **instrucciones** («Marque estando en el local»), no
      etiquetas («Marcaje Obligatorio»).
- [ ] Ninguna clave depende de **otra persona** o de algo que el lector no controla.
- [ ] Lo que se activa por empresa dice **«según la configuración de su empresa»**.
- [ ] La barra de cierre dice **qué logró el usuario**, no qué hizo el sistema.
- [ ] Nada se repite: dos beneficios que dicen lo mismo son un beneficio.

## 3 · Identidad

- [ ] Cabecera con el **logo** y el rótulo correcto: «GUÍA DE CAMPO» si es para el
      vendedor, «GUÍA WEB · ADMINISTRACIÓN» si es para supervisores.
- [ ] **Cinta tricolor** bajo la cabecera.
- [ ] Colores en su papel: morado principal, verde beneficios y cierre, ámbar claves,
      rojo **solo** para «si algo falla».
- [ ] **Pie** con el isotipo y la línea institucional.
- [ ] No hay estilos inventados fuera de `_estilo.css`.
- [ ] El **mes y año** de la cabecera están al día.

## 4 · Que quepa y se lea

- [ ] Ábrelo en el navegador e imprime a PDF: **A4**, márgenes predeterminados,
      **«Gráficos de fondo» activado**.
- [ ] **Una sola página.** Si son dos, se **recorta contenido** — no se achica la letra.
- [ ] Se lee cómodo a tamaño real, no ampliado en pantalla.
- [ ] Las tres columnas quedan más o menos parejas; ninguna colgando sola.

## 5 · Los datos de siempre

- [ ] Teléfono de soporte correcto.
- [ ] El nombre del producto es **Denario Premium**.
- [ ] El archivo se llama por su contenido, no por el módulo del que creías que era.
      *(Una pieza llegó llamada «Clientes 1» y en realidad era de Visitas.)*

---

## Si algo no pasa la revisión

Vuelve a la IA con la corrección concreta —«esto viaja al sincronizar, no en tiempo
real»— en vez de pedirle que lo rehaga entero. Y si el cambio afecta al **contenido**, no
solo a la forma, anótalo en `documentacion/_cambios-de-contenido.md`: así queda claro qué
se tocó y por qué.
