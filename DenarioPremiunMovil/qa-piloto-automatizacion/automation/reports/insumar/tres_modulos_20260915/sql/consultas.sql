-- INSUMAR · 2026-09-15 · SOLO LECTURA · base `insumar`
-- Ejecutar con: node automation/db/query.js insumar "<SQL>"

-- Q0 · Tamaño de la tabla (la base se mueve entre corridas)
SELECT count(*) AS filas_invoice, max(da_invoice)::date AS ultima FROM invoice;
-- 46.564 filas | última 2026-09-11   (el 11/09 eran 35.440)

-- Q1 · ORÁCULO OFICIAL · invoice x salesman_view, agosto 2026, por rol
SELECT sv.co_role, count(*) AS filas, round(sum(i.nu_amount_total)::numeric,2) AS monto,
       count(DISTINCT sv.id_user) AS usuarios
  FROM invoice i JOIN salesman_view sv ON sv.id_user = i.id_user
 WHERE i.da_invoice >= '2026-08-01' AND i.da_invoice < '2026-09-01'
 GROUP BY sv.co_role ORDER BY sv.co_role;
-- rol 1  (admin):        4 filas |     1.090,81 | 1 usuario
-- rol 7  (VENDEDOR): 1.171 filas |   224.411,08 | 5 usuarios   <== LO QUE DEBE MOSTRAR
-- rol 15 (TRANSPORTE):17.196 filas| 2.954.757,96 | 6 usuarios
-- Todas las filas de invoice en agosto: 18.604 | 3.211.252,08
-- (las 233 que faltan para cuadrar son EVA MEDINA id_user=13, que no está en salesman_view)

-- Q2 · Desglose por vendedor, agosto (cuadra con el oráculo del encargo)
SELECT sv.co_user, sv.na_user, count(*) f, round(sum(i.nu_amount_total)::numeric,2) m
  FROM invoice i JOIN salesman_view sv ON sv.id_user=i.id_user
 WHERE sv.co_role=7 AND i.da_invoice>='2026-08-01' AND i.da_invoice<'2026-09-01'
 GROUP BY 1,2 ORDER BY m DESC;
-- R013 VIVIANA 379|90.638,43 · R015 ALEJANDRA 141|37.284,37 · R007 MIGUEL 219|36.699,51
-- R016 LEANDRO 251|35.549,11 · R009 YENNI 181|24.239,66   (EVA MEDINA: 0 — ver Q7)

-- Q3 · LA CLAVE DEL OFF-BY-ONE de Cumplimiento de Cuota
--      La pantalla, pidiéndole 01/08-31/08, devolvió 1.220 | 232.003,67.
--      Eso NO es ningún corte de rol: es el corte de VENDEDORES con UN DÍA DE MÁS.
WITH b AS (SELECT i.nu_amount_total amt, i.da_invoice dt, ru.co_role rol, u.co_operation uop
           FROM invoice i LEFT JOIN role_user ru ON ru.id_user=i.id_user
           LEFT JOIN users u ON u.id_user=i.id_user)
SELECT 'ago 01-31  (< 09-01)' k, count(*) f, round(sum(amt)::numeric,2) m FROM b
 WHERE rol=7 AND uop<>'D' AND dt>='2026-08-01' AND dt<'2026-09-01'
UNION ALL SELECT 'ago 01-31 + 1 dia (< 09-02)', count(*), round(sum(amt)::numeric,2) FROM b
 WHERE rol=7 AND uop<>'D' AND dt>='2026-08-01' AND dt<'2026-09-02'
UNION ALL SELECT 'ago 01-30  (< 08-31)', count(*), round(sum(amt)::numeric,2) FROM b
 WHERE rol=7 AND uop<>'D' AND dt>='2026-08-01' AND dt<'2026-08-31'
UNION ALL SELECT 'solo el 01/09', count(*), round(sum(amt)::numeric,2) FROM b
 WHERE rol=7 AND uop<>'D' AND dt>='2026-09-01' AND dt<'2026-09-02';
-- ago 01-31          1.171 | 224.411,08  <- lo que devuelve Cumplimiento pidiéndole 01/08-30/08
-- ago 01-31 + 1 día  1.220 | 232.003,67  <- lo que devuelve Cumplimiento pidiéndole 01/08-31/08
-- ago 01-30          1.118 | 212.706,05  <- lo que devuelven Plan vs Cuota y Facturaciones con 01/08-30/08
-- solo el 01/09         49 |   7.592,59  <- exactamente la diferencia

-- Q4 · La vista por Línea: de dónde sale el número inflado (sigue igual que el 14/09)
SELECT round(sum(d.nu_amount_total)::numeric,2) AS detalle_nu_amount_total,
       round(sum(d.nu_amount_total_conversion)::numeric,2) AS detalle_conversion
  FROM invoice_detail d JOIN invoice i ON i.id_invoice=d.id_invoice
  JOIN role_user ru ON ru.id_user=i.id_user JOIN users u ON u.id_user=i.id_user
 WHERE ru.co_role=7 AND u.co_operation<>'D'
   AND i.da_invoice>='2026-09-01' AND i.da_invoice<'2026-09-15';
-- 905.028.443,33 | 1.142.201,63     (agosto: 2.469.301.992,11 | 3.249.076,61)
-- 905.028.443,33 = EXACTAMENTE la suma de la columna Facturado por Línea en pantalla, tanto en
-- Plan vs Cuota como en Cumplimiento de Cuota. Y el filtro de rol YA está aplicado (el JOIN es
-- sobre rol 7): la inflación es de la COLUMNA, no de los transportistas.

-- Q5 · Presupuestos: 7 de 9 tablas siguen vacías (sin cambio desde el 11/09)
SELECT 'quota_plan_enterprise' t, count(*) n FROM quota_plan_enterprise
UNION ALL SELECT 'sales_plan_enterprise', count(*) FROM sales_plan_enterprise
UNION ALL SELECT 'quota_plan_product', count(*) FROM quota_plan_product
UNION ALL SELECT 'quota_plan_product_structure', count(*) FROM quota_plan_product_structure
UNION ALL SELECT 'quota_plan_segment', count(*) FROM quota_plan_segment
UNION ALL SELECT 'sales_plan_enterprise_structure', count(*) FROM sales_plan_enterprise_structure
UNION ALL SELECT 'sales_plan_product', count(*) FROM sales_plan_product
UNION ALL SELECT 'sales_plan_product_structure', count(*) FROM sales_plan_product_structure
UNION ALL SELECT 'sales_plan_segment', count(*) FROM sales_plan_segment ORDER BY 1;
-- quota_plan_enterprise 72 · sales_plan_enterprise 12 · las otras SIETE en 0.

-- Q6 · Roles: `selector` SIGUE en true para ROLE_TRANSPORT => el arreglo NO fue apagar el flag
SELECT u.id_user, ud.co_user, u.name_user||' '||u.lastname_user AS nombre, u.co_operation,
       ru.co_role, r.editable_na_role, r.selector
  FROM users u LEFT JOIN users_data ud ON ud.id_user=u.id_user
  LEFT JOIN role_user ru ON ru.id_user=u.id_user LEFT JOIN role r ON r.co_role=ru.co_role
 WHERE ru.co_role IN (7,15) OR ud.co_user IN ('P001','C001','A001')
 ORDER BY ru.co_role, ud.co_user;
-- T001..T006 = co_role 15 · 'Transportista' · selector = TRUE (sin cambio respecto al 11/09)
-- P001 MARIA JOSE PEREZ = co_role 9 'Promotor' · selector = FALSE -> pero SÍ sale en los combos
-- C001 CATALOGO         = co_role 16 'Catalogo' · selector = FALSE -> ya NO sale en los combos

-- Q7 · EVA MEDINA sigue duplicada (K4/H4 del 11-14/09, sin corregir)
SELECT i.id_user, ud.co_user, u.co_operation, count(*) f, round(sum(i.nu_amount_total)::numeric,2) m
  FROM invoice i LEFT JOIN users u ON u.id_user=i.id_user
  LEFT JOIN users_data ud ON ud.id_user=i.id_user
 WHERE ud.co_user='R003' AND i.da_invoice>='2026-08-01' AND i.da_invoice<'2026-09-01'
 GROUP BY 1,2,3;
-- 13 | R003 | D | 233 | 30.992,23      (el id_user=22, co_operation='I', no tiene ninguna)

-- Q8 · `document_sale` (pestaña «Pendientes por cobrar»): NO hay replicación por transportista
SELECT count(*) filas,
       count(*) FILTER (WHERE co_document_sale ~ 'T00[1-6]$') con_sufijo_T,
       count(DISTINCT regexp_replace(co_document_sale,'T00[1-6]$','')) documentos_reales
  FROM document_sale WHERE da_document>='2026-08-01' AND da_document<'2026-09-01';
-- 2.890 | 0 | 2.890  -> cada documento una sola vez.
-- Ojo: `document_sale.id_user` es NULL en TODAS las filas, así que esa pestaña no se puede cortar
-- por vendedor (no hay a quién atribuirla).
-- TRAMPA: el regex 'T[0-9]+$' NO sirve aquí — los códigos son 'FACT#####' / 'DEVO#####' y la «T»
-- de FACT da un falso positivo (daba 2.875 «con sufijo» que no existen). Usar 'T00[1-6]$'.

-- Q9 · Año 2026 completo (para Indicadores -> Pedidos, que filtra por año y no por fechas)
WITH b AS (SELECT i.nu_amount_total amt, i.da_invoice dt, ru.co_role rol, u.co_operation uop
           FROM invoice i LEFT JOIN role_user ru ON ru.id_user=i.id_user
           LEFT JOIN users u ON u.id_user=i.id_user)
SELECT 'ANO2026 rol7 vivos' k, count(*) f, round(sum(amt)::numeric,2) m FROM b
 WHERE rol=7 AND uop<>'D' AND dt>='2026-01-01' AND dt<'2027-01-01'
UNION ALL SELECT 'ANO2026 todas las filas', count(*), round(sum(amt)::numeric,2) FROM b
 WHERE dt>='2026-01-01' AND dt<'2027-01-01';
-- rol 7 vivos: 8.261 | 1.733.804,89      todas: 46.441 | 8.331.946,28  (factor 5,6x)

-- Q10 · Septiembre 01-14 por vendedor (control de Indicadores -> Vendedores)
WITH b AS (SELECT i.nu_amount_total amt, i.da_invoice dt, ru.co_role rol, u.co_operation uop, ud.co_user cu
           FROM invoice i LEFT JOIN role_user ru ON ru.id_user=i.id_user
           LEFT JOIN users u ON u.id_user=i.id_user LEFT JOIN users_data ud ON ud.id_user=i.id_user)
SELECT cu, count(*) f, round(sum(amt)::numeric,2) m FROM b
 WHERE rol=7 AND uop<>'D' AND dt>='2026-09-01' AND dt<'2026-09-15' GROUP BY 1 ORDER BY m DESC;
-- R013 137|27.632,38 · R016 127|18.152,99 · R007 89|14.979,88 · R009 73|10.824,71 · R015 42|8.570,27
