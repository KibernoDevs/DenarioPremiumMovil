-- INSUMAR · certificacion web 11/09/2026 · base NUEVA (reemplazada hoy a mediodia)
-- Todas de solo lectura. Ejecutar con:  node automation/db/query.js insumar "<SQL>"

-- Q1 · ORACULO CENTRAL: facturacion 01/09-11/09/2026, con y sin las copias de transportista
SELECT 'TODO invoice' k, count(*) filas, round(sum(nu_amount_total)::numeric,2) monto
  FROM invoice WHERE da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11'
UNION ALL SELECT 'solo vendedores (sin sufijo T)', count(*), round(sum(nu_amount_total)::numeric,2)
  FROM invoice WHERE da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11' AND co_invoice !~ 'T[0-9]{3}$'
UNION ALL SELECT 'solo vendedores sin A001 (admin)', count(*), round(sum(nu_amount_total)::numeric,2)
  FROM invoice WHERE da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11' AND co_invoice !~ 'T[0-9]{3}$' AND co_user<>'A001'
UNION ALL SELECT 'solo transportistas', count(*), round(sum(nu_amount_total)::numeric,2)
  FROM invoice WHERE da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11' AND co_invoice ~ 'T[0-9]{3}$';
-- 7370 / 1234598.91 | 470 / 80745.21 | 468 / 80160.23 | 6900 / 1153853.70

-- Q2 · desglose por usuario en la ventana (los 6 T00x identicos al centimo)
SELECT co_user, count(*) filas, round(sum(nu_amount_total)::numeric,2) monto
  FROM invoice WHERE da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11'
 GROUP BY co_user ORDER BY co_user;
-- A001 2/584.98 · R007 89/14979.88 · R009 73/10824.71 · R013 137/27632.38 · R015 42/8570.27
-- R016 127/18152.99 · T001..T006 1150/192308.95 cada uno

-- Q3 · clientes distintos en la ventana (para % de activacion / cartera)
SELECT 'todo' k, count(DISTINCT co_client) n FROM invoice WHERE da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11'
UNION ALL SELECT 'solo vendedores', count(DISTINCT co_client) FROM invoice
  WHERE da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11' AND co_invoice !~ 'T[0-9]{3}$';
-- 833 | 341

-- Q4 · el criterio de rol: quien puede ser elegido como "vendedor"
SELECT co_role, na_role, editable_na_role, selector FROM role ORDER BY co_role;
-- selector=true SOLO en 7 ROLE_SALESMAN y 15 ROLE_TRANSPORT (de 13 roles)

-- Q5 · quien es quien hoy
SELECT ud.co_user, u.id_user, r.editable_na_role, u.co_operation
  FROM users u LEFT JOIN users_data ud ON ud.id_user=u.id_user
  LEFT JOIN role_user ru ON ru.id_user=u.id_user LEFT JOIN role r ON r.co_role=ru.co_role
 ORDER BY ud.co_user;
-- R003 sigue DUPLICADO: id 13 (co_operation='D') e id 22 ('I')

-- Q6 · totales 2026 (para contrastar Indicadores -> Pedidos, que filtra por ANO)
SELECT CASE WHEN co_invoice ~ 'T[0-9]{3}$' THEN 'transportista' ELSE 'vendedor' END k,
       count(*) n, round(sum(nu_amount_total)::numeric,2) total, round(sum(nu_amount_final)::numeric,2) final
  FROM invoice WHERE extract(year from da_invoice)=2026 GROUP BY 1;
-- vendedor 6589 / 1285545.14 / 1310894.13 · transportista 39852 / 7046401.14


-- ============================================================================
-- Q7..Q12 · añadidas por 02-reportes-restantes.md (Activación de Clientes y
-- Rotación de Inventario). Mismo día, misma base, solo lectura.
-- ============================================================================

-- Q7 · ORACULO de Activacion de Clientes: clientes distintos, con y sin copias
SELECT
  (SELECT count(DISTINCT co_client) FROM invoice
     WHERE da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11')                        AS todo,
  (SELECT count(DISTINCT co_client) FROM invoice
     WHERE da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11'
       AND co_invoice !~ 'T[0-9]{3}$')                                                    AS solo_vendedores,
  (SELECT count(DISTINCT co_client) FROM invoice
     WHERE da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11'
       AND co_invoice !~ 'T[0-9]{3}$' AND co_user <> 'A001')                              AS solo_vend_sin_admin,
  (SELECT count(*) FROM client)                                                           AS clientes_total;
-- 833 | 341 | 339 | 1972

-- Q8 · el mismo oraculo con la convencion del reporte (los "nuevos" van aparte)
SELECT
  (SELECT count(*) FROM client
     WHERE da_created::date BETWEEN '2026-09-01' AND '2026-09-11')                         AS nuevos,
  (SELECT count(DISTINCT i.co_client) FROM invoice i JOIN client c ON c.co_client = i.co_client
     WHERE i.da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11'
       AND c.da_created::date NOT BETWEEN '2026-09-01' AND '2026-09-11')                   AS act_con_copias,
  (SELECT count(DISTINCT i.co_client) FROM invoice i JOIN client c ON c.co_client = i.co_client
     WHERE i.da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11'
       AND i.co_invoice !~ 'T[0-9]{3}$'
       AND c.da_created::date NOT BETWEEN '2026-09-01' AND '2026-09-11')                   AS act_correcto;
-- 37 | 796 | 330     <- 796 es EXACTAMENTE lo que muestra cada fila T00x en pantalla

-- Q9 · clientes distintos por usuario (cuadre fila a fila del desglose por vendedor)
SELECT co_user, count(*) AS filas, count(DISTINCT co_client) AS clientes
  FROM invoice WHERE da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11'
 GROUP BY co_user ORDER BY co_user;
-- A001 2/2 · R007 89/66 · R009 73/56 · R013 137/97 · R015 42/35 · R016 127/85
-- T001..T006 1150/833 cada uno  <- los 833 clientes de toda la empresa, seis veces

-- Q10 · la cartera (columna "Clientes") sale de client_template_user
SELECT co_user, count(DISTINCT co_client) AS cartera
  FROM client_template_user GROUP BY co_user ORDER BY co_user;
-- R003 152 · R007 137 · R009 105 · R013 175 · R015 106 · R016 176
-- T001 1745 · T002..T006 1863 cada uno   (menos los 37 nuevos = la columna de pantalla)

-- Q11 · ORACULO de Rotacion de Inventario (calculado; el reporte sale vacio y no se pudo contrastar)
--   OJO: invoice_detail.qu_total esta a NULL en esta base; las cantidades viven en invoice_detail_unit
WITH w AS (
  SELECT d.id_invoice_detail, (i.co_invoice ~ 'T[0-9]{3}$') AS es_copia
    FROM invoice_detail d JOIN invoice i ON i.id_invoice = d.id_invoice
   WHERE i.da_invoice::date BETWEEN '2026-09-01' AND '2026-09-11')
SELECT
  (SELECT round(sum(u.qu_invoice)::numeric,2) FROM invoice_detail_unit u
     JOIN w ON w.id_invoice_detail = u.id_invoice_detail)                        AS unid_todo,
  (SELECT round(sum(u.qu_invoice)::numeric,2) FROM invoice_detail_unit u
     JOIN w ON w.id_invoice_detail = u.id_invoice_detail WHERE NOT w.es_copia)   AS unid_sin_copias,
  (SELECT count(*) FROM w)                                                       AS lineas_todo,
  (SELECT count(*) FROM w WHERE NOT es_copia)                                    AS lineas_sin_copias;
-- 223086.00 | 14796.00 | 71796 | 4734     -> factor x15,08 si contase las copias

-- Q12 · por que sale vacio Rotacion de Inventario
SELECT (SELECT count(*) FROM client_stock)        AS client_stock,
       (SELECT count(*) FROM client_stock_detail) AS client_stock_detail,
       (SELECT count(*) FROM stock)               AS stock,
       (SELECT count(*) FROM stock_history)       AS stock_history;
-- 0 | 0 | 1141 | 62902   -> sin inventario EN EL CLIENTE no hay rotacion que calcular
