-- INSUMAR · corrida web 2026-09-11 · SOLO LECTURA
-- node automation/db/query.js insumar "<SQL>"

-- Q1 · Cómo se distingue un TRANSPORTISTA de un VENDEDOR  (clave de la incidencia C)
SELECT co_role, na_role, editable_na_role, selector, co_operation, st_role
  FROM role ORDER BY co_role;
-- ROLE_SALESMAN  co_role=7  editable_na_role='Vendedor'       selector=true
-- ROLE_TRANSPORT co_role=15 editable_na_role='Transportista'  selector=true   <-- LOS DOS son "seleccionables"

-- Q2 · Quién es quién en INSUMAR (rol vía role_user, NO hay columna id_role en users)
SELECT u.id_user, ud.co_user, u.login_user, u.name_user||' '||u.lastname_user AS nombre,
       u.co_operation AS u_op, ud.st_user, r.na_role, r.editable_na_role, r.selector, ru.co_operation AS ru_op
  FROM users u
  LEFT JOIN users_data ud ON ud.id_user = u.id_user
  LEFT JOIN role_user  ru ON ru.id_user = u.id_user
  LEFT JOIN role       r  ON r.co_role  = ru.co_role
 ORDER BY u.id_user;
-- 6 transportistas: T001..T006 (id_user 5..10) · 7 filas de vendedor: R013,R009,R016,R003(x2),R007,R015

-- Q3 · La misma factura, 7 veces (una por transportista + la del vendedor)
SELECT regexp_replace(co_invoice,'T[0-9]{3}$','') AS factura, co_invoice, co_user,
       nu_amount_total, da_invoice::date, co_client
  FROM invoice
 WHERE regexp_replace(co_invoice,'T[0-9]{3}$','') = '20095815'
 ORDER BY co_invoice;

-- Q4 · Cuánto se infla la tabla completa
SELECT count(*) AS filas_invoice,
       count(DISTINCT regexp_replace(co_invoice,'T[0-9]{3}$','')) AS facturas_reales,
       round(count(*)::numeric / count(DISTINCT regexp_replace(co_invoice,'T[0-9]{3}$','')),2) AS factor,
       sum(nu_amount_total) AS monto_total_tabla,
       sum(nu_amount_total) FILTER (WHERE co_invoice !~ 'T[0-9]{3}$') AS monto_solo_vendedor
  FROM invoice;
-- 35.440 filas / 8.273 facturas reales / factor 4,28 · 45.465.124,18 vs 6.734.040,40

-- Q5 · Distribución de copias por factura
WITH b AS (SELECT regexp_replace(co_invoice,'T[0-9]{3}$','') AS base FROM invoice)
SELECT copias, count(*) AS n_facturas FROM (SELECT base, count(*) copias FROM b GROUP BY base) x
 GROUP BY copias ORDER BY copias;
-- 1 copia: 3.345 · 6 copias: 2.401 (solo transportistas) · 7 copias: 2.527 (vendedor + 6 transportistas)

-- Q6 · Agosto 2026 por usuario (la ventana medida en pantalla)
SELECT co_user, count(*) AS filas, sum(nu_amount_total) AS monto,
       count(*) FILTER (WHERE co_invoice ~ 'T[0-9]{3}$') AS con_sufijo_T
  FROM invoice WHERE da_invoice >= '2026-08-01' AND da_invoice < '2026-09-01'
 GROUP BY co_user ORDER BY filas DESC;
-- T001..T006: 2.283 filas y 386.243,04 CADA UNO · R013 289 · R003 233 · R016 195 · R007 177 · R009 142 · R015 112 · A001 4

-- Q7 · Nombre completo vs nombre corto de las estructuras de producto (incidencia A)
SELECT co_product_structure, na_product_structure, short_na_product_structure,
       length(na_product_structure) AS len_full, length(short_na_product_structure) AS len_short
  FROM product_structure
 WHERE na_product_structure <> short_na_product_structure
 ORDER BY co_type_product_structure, na_product_structure;
-- Linea:     LECHE CONDENSADA -> 'LECHE CONDENSAD' · POSTRES Y GELATINAS -> 'POSTRES Y GELAT' · TURRONES Y BOCADILLOS -> 'TURRONES Y BOCA'
-- Sub-Linea: RELLENA Y CUBIERTA -> 'RELLENA Y CUBIE' · RELLENOS LIQUIDO -> 'RELLENOS LIQUID'
-- short_na_product_structure está truncado a 15 caracteres

-- Q8 · Qué datos de Plan y Cuota existen (incidencia B)
SELECT 'quota_plan_enterprise' t, count(*) n FROM quota_plan_enterprise
UNION ALL SELECT 'quota_plan_product',            count(*) FROM quota_plan_product
UNION ALL SELECT 'quota_plan_product_structure',  count(*) FROM quota_plan_product_structure
UNION ALL SELECT 'quota_plan_segment',            count(*) FROM quota_plan_segment
UNION ALL SELECT 'sales_plan_enterprise',         count(*) FROM sales_plan_enterprise
UNION ALL SELECT 'sales_plan_enterprise_structure',count(*) FROM sales_plan_enterprise_structure
UNION ALL SELECT 'sales_plan_product',            count(*) FROM sales_plan_product
UNION ALL SELECT 'sales_plan_product_structure',  count(*) FROM sales_plan_product_structure
UNION ALL SELECT 'sales_plan_segment',            count(*) FROM sales_plan_segment;
-- SOLO quota_plan_enterprise (72) y sales_plan_enterprise (12) tienen filas. TODAS las tablas por
-- dimensión (producto, estructura de producto, segmento) están VACÍAS.

-- Q9 · Presupuestos vivos
SELECT id_budget, type, year, budget, co_plan, na_plan, tipo_unidad, co_operation FROM budget ORDER BY id_budget;
-- Vivos (co_operation='I'): id 7 BUDGET_QUOTA_PLAN US$ 3.500.000 · id 10 BUDGET_SALES_PLAN US$ 6.000.000
-- Los presupuestos en BULTO (id 1 y 3) están borrados lógicamente ('D')

-- Q10 · Pedidos cargados (universo de "Pedido")
SELECT count(*) n, min(da_order)::date, max(da_order)::date FROM "order";
-- 296 pedidos, 2026-08-11 .. 2026-08-28
