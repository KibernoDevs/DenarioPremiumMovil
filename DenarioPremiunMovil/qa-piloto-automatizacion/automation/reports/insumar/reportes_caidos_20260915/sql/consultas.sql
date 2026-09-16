-- INSUMAR · reportes_caidos_20260915 · TODO SOLO LECTURA (SELECT)
-- Base: insumar · node automation/db/query.js insumar "<SQL>"

-- Q1 · Baseline de dato: nada se movio respecto de la corrida de las 09:43 ni de la de las 11:05
SELECT (SELECT count(*) FROM invoice) inv,                  -- 46.564  (identico)
       (SELECT count(*) FROM quota_plan_enterprise) qpe,    -- 72      (identico)
       (SELECT count(*) FROM sales_plan_enterprise) spe,    -- 12      (identico)
       now() AS ahora;

-- Q2 · Log de errores de la aplicacion: VACIO en los ultimos 3 dias
SELECT da_update, na_table, co_operation, left(description_error,200) err
  FROM log_error WHERE da_update > now() - interval '3 days' ORDER BY da_update DESC LIMIT 25;
-- => 0 filas. El error del reporte NO se registra aqui.

-- Q3 · Auditoria de configuracion: el ultimo cambio es del 02/09, NADA hoy
SELECT da_update, na_user, na_variable, old_value, new_value
  FROM global_configuration_audit ORDER BY da_update DESC LIMIT 20;
-- => ultimo: 2026-09-02 21:27 RangoToleranciaPositiva 10 -> 100000.
--    Descarta "alguien toco una variable global entre las 09:50 y las 11:05".

-- Q4 · Las vistas de las que viven los reportes responden todas
SELECT count(*) FROM quota_plan_enterprise_view;       -- 6
SELECT count(*) FROM quota_plan_enterprise_anio_view;  -- 6
SELECT count(*) FROM sales_plan_enterprise_anio_view;  -- 1
SELECT count(*) FROM quota_plan_segment_view;          -- 0
SELECT count(*) FROM salesman_view;                    -- 22
-- => ninguna lanza error. La capa de base esta sana.

-- Q5 · Feriados: la tabla esta VACIA, pero lo ha estado SIEMPRE (la secuencia
--      nunca se uso: last_value NULL). No se borro nada hoy. Hipotesis descartada.
SELECT * FROM holiday;                                                  -- 0 filas
SELECT sequencename, last_value FROM pg_sequences
 WHERE schemaname='public' AND sequencename ILIKE '%holiday%';          -- last_value = NULL

-- Q6 · ORACULO de bordes de fecha (corte de vendedores, rol 7) — para el dia que
--      Cumplimiento de Cuota vuelva. Verificado hoy de forma independiente.
WITH d AS (SELECT i.da_invoice::date dd, count(*) f, sum(i.nu_amount_total) m
             FROM invoice i JOIN salesman_view s ON s.id_user=i.id_user
            WHERE s.co_role=7 GROUP BY 1)
SELECT 'jul01-31 correcto' k, sum(f) f, round(sum(m)::numeric,2) m FROM d WHERE dd BETWEEN '2026-07-01' AND '2026-07-31'
UNION ALL SELECT 'jul02-31 (come 1er dia)', sum(f), round(sum(m)::numeric,2) FROM d WHERE dd BETWEEN '2026-07-02' AND '2026-07-31'
UNION ALL SELECT 'jul01 solo', sum(f), round(sum(m)::numeric,2) FROM d WHERE dd='2026-07-01'
UNION ALL SELECT 'jul13 solo', sum(f), round(sum(m)::numeric,2) FROM d WHERE dd='2026-07-13'
UNION ALL SELECT 'jul14 solo', sum(f), round(sum(m)::numeric,2) FROM d WHERE dd='2026-07-14'
UNION ALL SELECT 'ago01-30 correcto', sum(f), round(sum(m)::numeric,2) FROM d WHERE dd BETWEEN '2026-08-01' AND '2026-08-30'
UNION ALL SELECT 'ago01-31 correcto', sum(f), round(sum(m)::numeric,2) FROM d WHERE dd BETWEEN '2026-08-01' AND '2026-08-31'
UNION ALL SELECT 'sep01-14 correcto', sum(f), round(sum(m)::numeric,2) FROM d WHERE dd BETWEEN '2026-09-01' AND '2026-09-14';
-- jul01-31 correcto        5908 | 1.270.978,81
-- jul02-31 (come 1er dia)  5715 | 1.195.421,75   <= el borde IZQUIERDO si discrimina aqui
-- jul01 solo                193 |    75.557,06   <= 01/07 SI tiene facturas
-- jul13 solo                285 |   155.028,94
-- jul14 solo                647 |   147.388,67
-- ago01-30 correcto        1118 |   212.706,05
-- ago01-31 correcto        1171 |   224.411,08
-- sep01-14 correcto         468 |    80.160,23
