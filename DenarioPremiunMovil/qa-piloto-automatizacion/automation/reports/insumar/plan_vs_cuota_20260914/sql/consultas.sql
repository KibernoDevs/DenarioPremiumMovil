-- INSUMAR · Plan vs Cuota · 14/09/2026 · TODAS DE SOLO LECTURA
-- node automation/db/query.js insumar "<SQL>"

-- Q1 · Las 9 tablas de presupuesto (¿cambió algo desde el 11/09?)
SELECT 'quota_plan_enterprise' t, count(*) n FROM quota_plan_enterprise
UNION ALL SELECT 'quota_plan_product', count(*) FROM quota_plan_product
UNION ALL SELECT 'quota_plan_product_structure', count(*) FROM quota_plan_product_structure
UNION ALL SELECT 'quota_plan_segment', count(*) FROM quota_plan_segment
UNION ALL SELECT 'sales_plan_enterprise', count(*) FROM sales_plan_enterprise
UNION ALL SELECT 'sales_plan_enterprise_structure', count(*) FROM sales_plan_enterprise_structure
UNION ALL SELECT 'sales_plan_product', count(*) FROM sales_plan_product
UNION ALL SELECT 'sales_plan_product_structure', count(*) FROM sales_plan_product_structure
UNION ALL SELECT 'sales_plan_segment', count(*) FROM sales_plan_segment
ORDER BY 1;
-- Resultado: quota_plan_enterprise=72, sales_plan_enterprise=12, las otras 7 = 0. SIN CAMBIOS.
-- OJO: NO existe la tabla `quota_plan_enterprise_structure` (el informe del 11/09 la nombraba
-- por error); el par de `sales_plan_enterprise_structure` no tiene gemela de cuota.

-- Q2 · Oráculo de facturación por ROL, 01/09–14/09/2026  (la ventana del contraste)
SELECT COALESCE(r.na_role,'(sin rol)') rol, r.co_role, count(*) filas,
       round(sum(i.nu_amount_total)::numeric,2) monto
  FROM invoice i
  LEFT JOIN role_user ru ON ru.id_user = i.id_user
  LEFT JOIN role      r  ON r.co_role  = ru.co_role
 WHERE i.da_invoice >= '2026-09-01' AND i.da_invoice < '2026-09-15'
 GROUP BY 1,2 ORDER BY 2;
-- ROLE_ADMIN(1)      2 filas       584,98
-- ROLE_SALESMAN(7) 468 filas    80.160,23   <- lo que muestra la pantalla con filtro Vendedor
-- ROLE_TRANSPORT(15) 6.900 filas 1.153.853,70

-- Q3 · Facturación REAL deduplicada (quitando las copias de transportista)
WITH d AS (
  SELECT DISTINCT ON (regexp_replace(co_invoice,'T[0-9]+$',''))
         regexp_replace(co_invoice,'T[0-9]+$','') num, nu_amount_total
    FROM invoice
   WHERE da_invoice >= '2026-09-01' AND da_invoice < '2026-09-15'
   ORDER BY 1, co_invoice)
SELECT count(*) facturas_reales, round(sum(nu_amount_total)::numeric,2) monto_real FROM d;
-- 1.150 facturas reales · 192.105,14 US$

-- Q4 · El factor de replicación, MES A MES (¿es puntual o continuo?)
SELECT to_char(da_invoice,'YYYY-MM') mes, count(*) filas,
       count(DISTINCT regexp_replace(co_invoice,'T[0-9]+$','')) numeros_reales,
       round((count(*)::numeric/NULLIF(count(DISTINCT regexp_replace(co_invoice,'T[0-9]+$','')),0)),2) factor,
       round(sum(nu_amount_total)::numeric,2) sumando_todo,
       round(sum(nu_amount_total) FILTER (WHERE co_invoice !~ 'T[0-9]+$')::numeric,2) solo_limpias
  FROM invoice GROUP BY 1 ORDER BY 1;
-- Ver la tabla del informe: viene desde 2020-09 y crece (1,48 en may-2026 -> 6,49 en ago-2026).
-- OJO: la replicacion por transportista es CONOCIDA Y DELIBERADA por INSUMAR. NO es defecto de
-- carga. Se documenta solo para saber que NUNCA hay que contar filas de invoice como facturas.

-- Q5 · Por usuario, rol 7, agosto 2026 — descubre por qué la pantalla da 224.411,08 y no 255.403,31
SELECT i.co_user, u.id_user, u.co_operation, count(*) filas,
       round(sum(i.nu_amount_total)::numeric,2) total
  FROM invoice i
  JOIN users u ON u.id_user = i.id_user
  JOIN role_user ru ON ru.id_user = u.id_user
  JOIN role r ON r.co_role = ru.co_role AND r.co_role = 7
 WHERE i.da_invoice >= '2026-08-01' AND i.da_invoice < '2026-09-01'
 GROUP BY 1,2,3 ORDER BY 1;
-- R003 EVA MEDINA id_user=13 co_operation='D' -> 233 filas / 30.992,23 QUE LA PANTALLA NO SUMA.
-- Los otros 5 ('I') suman EXACTAMENTE 224.411,08.

-- Q6 · El detalle de factura: de dónde sale el 905 millones de la vista por Línea
SELECT count(*) lineas_detalle,
       round(sum(d.nu_amount_total)::numeric,2)            suma_detalle,
       round(sum(d.nu_amount_total_conversion)::numeric,2) suma_conversion
  FROM invoice_detail d
  JOIN invoice i   ON i.id_invoice = d.id_invoice
  JOIN role_user ru ON ru.id_user  = i.id_user
 WHERE ru.co_role = 7 AND i.da_invoice >= '2026-09-01' AND i.da_invoice < '2026-09-15';
-- 4.719 | 905.028.443,33 | 1.142.201,63
-- 905.028.443,33 es EXACTAMENTE lo que suma la columna Facturado (US$) de la vista por Línea.

-- Q7 · La tasa de cambio, para pesar el 11.290x
SELECT round(min(nu_value_local)::numeric,4) tasa_min,
       round(max(nu_value_local)::numeric,4) tasa_max,
       round(avg(nu_value_local)::numeric,4) tasa_avg
  FROM invoice i JOIN role_user ru ON ru.id_user = i.id_user
 WHERE ru.co_role = 7 AND i.da_invoice >= '2026-09-01' AND i.da_invoice < '2026-09-15';
-- 798,33 / 832,49 / 812,11

-- Q8 · El Plan de empresa mes a mes (para NO reportar el "Plan = 0" como defecto)
SELECT nu_month, round(initial_value::numeric,2) inicial, round(current_value::numeric,2) actual
  FROM sales_plan_enterprise ORDER BY nu_month;
-- meses 1..8: 452.000 .. 580.600  |  meses 9..12: 0,00
-- El mes 8 = 580.600,00 coincide AL CÉNTIMO con el "Plan (US$) 580.600" de la pantalla en agosto.

-- Q9 · Moneda de las facturas (para saber si nu_amount_total es comparable con US$)
SELECT co_currency, count(*) n, round(sum(nu_amount_total)::numeric,2) tot
  FROM invoice WHERE da_invoice >= '2026-08-01' AND da_invoice < '2026-09-01' GROUP BY 1;
-- US$ | 18.604 | 3.211.252,08  -> TODAS en US$, comparable directo.

-- Q10 · Cartera: ¿por qué "Transportista" da 0 y "Clientes en Cartera" también?
--       (la columna client.id_user NO existe en este esquema; queda SIN COMPROBAR)

-- Q11 · El corte de VENDEDORES de agosto, que es el resultado esperado segun el criterio del cliente
--       (solo usuarios vivos: la web no suma los co_operation='D' — ver Q5)
SELECT count(*) facturas, round(sum(i.nu_amount_total)::numeric,2) monto
  FROM invoice i
  JOIN users u      ON u.id_user = i.id_user
  JOIN role_user ru ON ru.id_user = u.id_user
 WHERE ru.co_role = 7 AND u.co_operation <> 'D'
   AND i.da_invoice >= '2026-08-01' AND i.da_invoice < '2026-09-01';
-- 1.171 facturas · 224.411,08 US$
-- Coincide AL CENTIMO con Plan VS Cuota (Roles=Vendedor) y con Facturaciones (1.171 filas).

-- Q12 · Cobertura del corte de vendedores: que porcentaje de las facturas reales alcanza
SELECT count(DISTINCT regexp_replace(co_invoice,'T[0-9]+$','')) facturas_reales,
       count(*) FILTER (WHERE co_invoice !~ 'T[0-9]+$')          con_fila_de_vendedor
  FROM invoice
 WHERE da_invoice >= '2026-08-01' AND da_invoice < '2026-09-01';
-- agosto: 2.866 reales · 1.171 con fila de vendedor (41%)
-- sept 1-14: 1.150 reales · 470 con fila de vendedor (41%)
-- PREGUNTA ABIERTA para implementacion, no defecto del reporte.
