-- INSUMAR · VERIFICACION DEL FIX "DIA DE MAS" · 2026-09-15 · SOLO LECTURA · base `insumar`
-- Ejecutar con: node automation/db/query.js insumar "<SQL>"
-- TODAS son SELECT. No se escribio nada en la base.

-- F1 · El oraculo por dia (corte de vendedores, rol 7). Reconstruido de cero hoy.
SELECT i.da_invoice::date d, count(*) f, round(sum(i.nu_amount_total)::numeric,2) m
  FROM invoice i JOIN salesman_view s ON s.id_user=i.id_user
 WHERE s.co_role=7 AND i.da_invoice>='2026-07-01' AND i.da_invoice<'2026-09-15'
 GROUP BY 1 ORDER BY 1;
-- Claves: 13/07 = 285|155.028,94 · 14/07 = 647|147.388,67 · 31/08 = 53|11.705,03 · 01/09 = 49|7.592,59
-- DIAS VACIOS usados como ancla: 04, 05, 11 y 12 de julio (no aparecen en el resultado).

-- F2 · Matriz de ventanas: valor correcto y el que saldria con cada desfase
WITH d AS (SELECT i.da_invoice::date dd, i.nu_amount_total v
             FROM invoice i JOIN salesman_view s ON s.id_user=i.id_user WHERE s.co_role=7),
w(k,a,b) AS (VALUES ('13/07-13/07','2026-07-13'::date,'2026-07-13'::date),
                    ('13/07-14/07','2026-07-13','2026-07-14'),
                    ('14/07-14/07','2026-07-14','2026-07-14'),
                    ('01/08-31/08','2026-08-01','2026-08-31'),
                    ('01/08-30/08','2026-08-01','2026-08-30'),
                    ('01/07-31/07','2026-07-01','2026-07-31'),
                    ('02/07-31/07','2026-07-02','2026-07-31'),
                    ('01/08-01/09','2026-08-01','2026-09-01'),
                    ('01/09-14/09','2026-09-01','2026-09-14'))
SELECT w.k, count(d.v) f, round(sum(d.v)::numeric,2) m FROM w LEFT JOIN d ON d.dd BETWEEN w.a AND w.b
 GROUP BY w.k ORDER BY w.k;
-- 13/07-13/07 ..   285 |     155.028,94   <= "corregido"
-- 13/07-14/07 ..   932 |     302.417,61   <= "anade un dia"
-- 01/08-31/08 .. 1.171 |     224.411,08   · 01/08-01/09 .. 1.220 | 232.003,67 (la salida defectuosa)
-- 01/08-30/08 .. 1.118 |     212.706,05
-- 01/07-31/07 .. 5.908 |   1.270.978,81   · 02/07-31/07 .. 5.715 | 1.195.421,75 (si comiera el 1er dia)
-- 01/09-14/09 ..   468 |      80.160,23

-- F3 · Oraculo de la COLUMNA INFLADA (la que pinta la vista por Linea)
WITH w(k,a,b) AS (VALUES ('13/07-13/07','2026-07-13'::date,'2026-07-13'::date),
                         ('01/08-31/08','2026-08-01','2026-08-31'),
                         ('01/08-30/08','2026-08-01','2026-08-30'))
SELECT w.k, count(DISTINCT i.id_invoice) fac, round(sum(d.nu_amount_total)::numeric,2) inflado
  FROM w JOIN invoice i ON i.da_invoice::date BETWEEN w.a AND w.b
  JOIN salesman_view s ON s.id_user=i.id_user AND s.co_role=7
  JOIN invoice_detail d ON d.id_invoice=i.id_invoice
 GROUP BY w.k ORDER BY w.k;
-- 01/08-31/08 .. 1.171 | 2.469.301.992,11   (identico a lo que reconstruyo la re-verificacion de las 11:50)

-- F4 · Agregados alternativos de agosto, para descartar hipotesis sobre los importes
SELECT count(*) fac, count(DISTINCT i.id_client) clientes,
       round(sum(i.nu_amount_total)::numeric,2) total,
       round(sum(i.nu_amount_final)::numeric,2) final
  FROM invoice i JOIN salesman_view s ON s.id_user=i.id_user AND s.co_role=7
 WHERE i.da_invoice>='2026-08-01' AND i.da_invoice<'2026-09-01';
-- 1.171 | 490 clientes | 224.411,08 | 228.757,29
