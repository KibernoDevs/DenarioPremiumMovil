# Ticket para montar · Pendientes por cobrar

> Redactado con la plantilla de `plantilla-levantamiento-incidencias.md`.
> **Alcance: vista del ADMINISTRADOR.** Todo lo de abajo se observó con `ADMIN`.

---

## Título (campo nombre de la tarea)

```text
4K-Transacciones-Pendientes por cobrar no muestra ningún documento
```

---

## Descripción para la tarea — copiar desde aquí

## Metadatos

| Campo | Valor |
|---|---|
| **Fecha** | 2026-09-11 |
| **Ambiente** | Web |
| **Versión** | Denario Premium web · playa CARIBE (`denariocaribe.ddns.net:8080/DenarioPremium`) |
| **Usuario** | `ADMIN` |
| **Contraseña** | *(la de QA — no se transcribe aquí)* |
| **Ruta** | `Transacciones > Facturaciones > Pendientes por cobrar` |

---

## Descripción

**Esperado:** el reporte lista los documentos de venta con saldo pendiente.

**Actual:** devuelve **0 registros**, con cualquier rango de fechas. En la base hay
**7.745 documentos con saldo pendiente, por un total de 1.728.167,14**, y la propia web
los muestra en `Datos Maestros > Documentos de Venta`.

**Impacto:** quien abre el reporte concluye que no hay nada pendiente por cobrar.

---

## Pasos para reproducir

1. Entrar a la web con `ADMIN`.
2. Ir a `Transacciones > Facturaciones`.
3. Elegir la variante **Pendientes por cobrar**.
4. Poner un rango amplio de fechas (p. ej. 01/01/2020 – hoy) y pulsar **Buscar**.
5. La grilla queda vacía: **0 registros**.

**Contraste, en la misma sesión:**

6. Ir a `Datos Maestros > Documentos de Venta`, mismo rango, **sin filtrar por vendedor**
   → salen **8.470 registros**.
7. En esa misma pantalla, **elegir cualquier vendedor** en el filtro → **0 registros**.

---

## Datos de prueba

*(No aplica: falla con cualquier rango de fechas y sin depender de un documento concreto.)*

---

## Evidencia

| Archivo | Qué muestra |
|---|---|
| `evidencia/` (27 capturas) | Listado vacío, contraste con Documentos de Venta y filtros aplicados |

---

## Info técnica

| Campo | Valor |
|---|---|
| Ruta / pantalla | `Transacciones > Facturaciones > Pendientes por cobrar` |
| Mensaje de error en pantalla | Ninguno — la grilla sale vacía, sin aviso |
| ¿Web, móvil o ambos? | Solo web |

**Hipótesis de causa:** el reporte cruza los documentos con el vendedor, y ese campo está
vacío en `document_sale`. En `invoice` sí está poblado, y por eso `Facturaciones` filtra
bien por vendedor mientras este reporte no devuelve nada.

⚠ **Es la explicación que encaja con todo lo medido, no una lectura del código**: QA no
tiene acceso al fuente de la web. Con la consulta del reporte a la vista se confirma o se
descarta en un minuto.

---

## Consultas para verificar

> Base **`4k`**, esquema de la nube. Todas son de solo lectura.

**1 · Los documentos pendientes existen** — *da 7.745 y 1.728.167,14*

```sql
SELECT count(*) AS documentos,
       round(sum(nu_balance)::numeric, 2) AS saldo_total
FROM   document_sale
WHERE  id_enterprise = 1
  AND  nu_balance > 0;
```

**2 · El vendedor está vacío en `document_sale` y poblado en `invoice`** — *el núcleo del asunto*

```sql
SELECT 'document_sale' AS tabla,
       count(*) AS filas,
       count(*) FILTER (WHERE id_user IS NOT NULL AND id_user <> 0) AS con_vendedor
FROM   document_sale WHERE id_enterprise = 1
UNION ALL
SELECT 'invoice',
       count(*),
       count(*) FILTER (WHERE id_user IS NOT NULL AND id_user <> 0)
FROM   invoice WHERE id_enterprise = 1;
```

Resultado medido: `document_sale` **8.470 filas / 0 con vendedor** · `invoice` **4.474 / 4.474**.

**3 · La columna existe** — *para descartar que falte el campo*

```sql
SELECT column_name, data_type
FROM   information_schema.columns
WHERE  table_name = 'document_sale'
  AND  column_name = 'id_user';
```

**4 · Desglose de los documentos con saldo, por tipo**

```sql
SELECT co_document_sale_type AS tipo,
       count(*) AS documentos,
       round(sum(nu_balance)::numeric, 2) AS saldo
FROM   document_sale
WHERE  id_enterprise = 1 AND nu_balance <> 0
GROUP  BY 1
ORDER  BY 3 DESC;
```

---

## Observaciones del mismo reporte *(pueden separarse en tickets aparte)*

Todas observadas con `ADMIN`.

### A · El listado muestra 3.693 de 4.474 facturas

Faltan **781**. La hipótesis, por conteo, es que solo se devuelven las facturas de roles
con `selector = true`: ROLE_SALESMAN aporta 3.693, y quedan fuera ROLE_PROMOTER (588) y
ROLE_SUPERVISOR (193), que suman exactamente 781.

**Es inferencia por coincidencia de números, no lectura de código.** ¿Es intencional que
las facturas de promotores y supervisores no aparezcan en el reporte?

```sql
-- Total de facturas frente a lo que muestra la pantalla
SELECT count(*) AS facturas FROM invoice WHERE id_enterprise = 1;   -- 4.474
```

### B · El filtro ofrece vendedores cuya grilla sale vacía

El combo de vendedores ofrece a **ARMANDO SUAREZ**, pero al elegirlo la grilla devuelve 0,
cuando en la base tiene **588** facturas. Control con **EDWIN HERRERA**: 847 en pantalla =
847 en base. Si un vendedor no puede aparecer en el reporte, ¿debería ofrecerse en el filtro?

```sql
SELECT u.co_user, u.na_user, count(*) AS facturas
FROM   invoice i JOIN "user" u ON u.id_user = i.id_user
WHERE  i.id_enterprise = 1
GROUP  BY 1, 2
ORDER  BY 3 DESC;
```

*(Ajustar el nombre de la tabla de usuarios si difiere.)*

### C · El «Subtotal» de cada línea del detalle repite el total de la factura

**Es el dato, no la pantalla:** `invoice_detail.nu_amount_total` trae el mismo importe en
todas las líneas. ¿Ese campo debería traer el subtotal de la línea?

```sql
SELECT i.nu_invoice, d.co_product, d.qu_total, d.nu_amount_total
FROM   invoice i JOIN invoice_detail d ON d.id_invoice = i.id_invoice
WHERE  i.id_enterprise = 1
  AND  i.id_invoice = (SELECT id_invoice FROM invoice_detail
                       GROUP BY id_invoice HAVING count(*) > 3 LIMIT 1);
```

### D · Caracteres corruptos en la columna «Responsable»

Se ve `JOAN BRICE?O` mientras «Vendedor» sale correcto **en la misma fila**. No se
comprobó si es el dato o el render.

---

## Nota para quien revalide

Si se abre el detalle de la **primera fila** del listado, la tabla de productos sale
vacía. **No es un fallo del reporte:** hay facturas sin líneas en `invoice_detail`, y la
mayoría son de agosto — justo las que quedan arriba al ordenar. Hay que elegir una factura
con líneas para juzgar el detalle.

```sql
SELECT count(*) AS facturas_sin_lineas
FROM   invoice i
WHERE  i.id_enterprise = 1
  AND  NOT EXISTS (SELECT 1 FROM invoice_detail d WHERE d.id_invoice = i.id_invoice);
```
