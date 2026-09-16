-- INSUMAR · RE-VERIFICACION INDEPENDIENTE · 2026-09-15 · SOLO LECTURA · base `insumar`
-- Ejecutar con: node automation/db/query.js insumar "<SQL>"
-- Todas las consultas de este archivo se escribieron de cero para esta auditoria.

-- R0 · Tamano de la tabla: la base NO se movio respecto de la corrida auditada
SELECT count(*) filas, min(da_invoice)::date pri, max(da_invoice)::date ult, now()::timestamp(0) ahora FROM invoice;
-- 46.564 | 2020-09-23 | 2026-09-11 | 2026-09-15 15:04 UTC   (identico a su Q0)

-- R1 · Las DOS definiciones de "vendedor" dan lo mismo; la que incluye borrados da la diferencia
WITH sv AS (SELECT count(*) f, round(sum(i.nu_amount_total)::numeric,2) m
            FROM invoice i JOIN salesman_view s ON s.id_user=i.id_user
            WHERE s.co_role=7 AND i.da_invoice>='2026-08-01' AND i.da_invoice<'2026-09-01'),
ru AS (SELECT count(*) f, round(sum(i.nu_amount_total)::numeric,2) m
       FROM invoice i JOIN role_user r ON r.id_user=i.id_user JOIN users u ON u.id_user=i.id_user
       WHERE r.co_role=7 AND u.co_operation<>'D' AND i.da_invoice>='2026-08-01' AND i.da_invoice<'2026-09-01'),
ruall AS (SELECT count(*) f, round(sum(i.nu_amount_total)::numeric,2) m
          FROM invoice i JOIN role_user r ON r.id_user=i.id_user
          WHERE r.co_role=7 AND i.da_invoice>='2026-08-01' AND i.da_invoice<'2026-09-01')
SELECT 'salesman_view rol7' k,f,m FROM sv
UNION ALL SELECT 'role_user rol7 vivos',f,m FROM ru
UNION ALL SELECT 'role_user rol7 TODOS (incl D)',f,m FROM ruall;
-- salesman_view rol7 ............ 1.171 | 224.411,08
-- role_user rol7 vivos .......... 1.171 | 224.411,08   (las dos definiciones coinciden)
-- role_user rol7 TODOS .......... 1.404 | 255.403,31   => diferencia 233 | 30.992,23

-- R2 · EL ORACULO DE ESTA AUDITORIA: total por DIA del corte de vendedores.
--      Con esta tabla se calcula el valor esperado de CUALQUIER ventana, y ademas el que
--      saldria con un dia de mas al final o con un dia de menos al principio.
SELECT i.da_invoice::date d, count(*) f, round(sum(i.nu_amount_total)::numeric,2) m
  FROM invoice i JOIN salesman_view s ON s.id_user=i.id_user
 WHERE s.co_role=7 AND i.da_invoice>='2026-06-25' AND i.da_invoice<'2026-09-15'
 GROUP BY 1 ORDER BY 1;
-- 60 dias con factura. Claves: 31/08 = 53|11.705,03 · 01/09 = 49|7.592,59 · 13/07 = 285|155.028,94
-- 14/07 = 647|147.388,67 · 11/08 = 94|20.965,11 · 11/09 = 24|4.279,55
-- NO hay facturas el 16/08 ni el 01-02/08: por eso 01/08-15/08 y 01/07-31/07 NO discriminan
-- un desfase de un dia en la fecha final (el dia extra esta vacio).

-- R3 · Matriz de ventanas: valor correcto vs. el que daria cada desfase (calculado sobre R2)
--   ventana            correcto            +1 dia al final      -1 dia al inicio
--   01/08-31/08     1.171|224.411,08    1.220|232.003,67     1.171|224.411,08
--   01/08-30/08     1.118|212.706,05    1.171|224.411,08     1.118|212.706,05
--   01/08-10/08       285| 57.733,98      379| 78.699,09       285| 57.733,98
--   01/08-15/08       559|109.175,13      559|109.175,13       559|109.175,13   <= NO DISCRIMINA
--   01/07-31/07     5.908|1.270.978,81  5.908|1.270.978,81   5.715|1.195.421,75 <= solo borde izq.
--   01/07-30/07     5.865|1.265.182,84  5.908|1.270.978,81   5.672|1.189.625,78
--   01/09-10/09       444| 75.880,68      468| 80.160,23       395| 68.288,09
--   01/09-14/09       468| 80.160,23      468| 80.160,23       419| 72.567,64   <= NO DISCRIMINA
--   13/07-13/07       285|155.028,94      932|302.417,61         0|      0,00   <= EL MAS LIMPIO

-- R4 · HALLAZGO 2 · La causa, sobre facturas de ROL 7 (no de transportista): el importe de
--      cada linea es el TOTAL DE LA CABECERA x LA TASA, repetido identico en todas las lineas.
SELECT i.co_invoice, i.nu_amount_total cab_usd, i.nu_value_local tasa, count(*) lineas,
       count(DISTINCT d.nu_amount_total) valores_distintos, max(d.nu_amount_total) importe_linea,
       round((max(d.nu_amount_total)/NULLIF(i.nu_amount_total,0))::numeric,4) ratio,
       count(DISTINCT d.nu_amount_total_conversion) conv_distintos, max(d.nu_amount_total_conversion) conv_linea,
       max(d.nu_price_final) precio_final, max(d.qu_total) cantidad
  FROM invoice i JOIN salesman_view s ON s.id_user=i.id_user AND s.co_role=7
  JOIN invoice_detail d ON d.id_invoice=i.id_invoice
 WHERE i.da_invoice>='2026-09-01' AND i.da_invoice<'2026-09-15'
 GROUP BY 1,2,3 ORDER BY count(*) DESC LIMIT 4;
-- 20096641 | 162,01 US$ | tasa 801,18 | 30 lineas | 1 valor distinto | 129.799,16 | ratio 801,1799
-- 20096541 | 141,83     | 798,33      | 30 | 1 | 113.227,20 | 798,3304
-- 20096569 |  83,58     | 798,33      | 30 | 1 |  66.724,45 | 798,3303
-- 20096768 | 266,84     | 804,81      | 30 | 1 | 214.755,50 | 804,8100
-- Y ADEMAS: nu_amount_total_conversion tambien es UNICO por factura y vale el total de la
-- cabecera EN US$ repetido en cada linea => tampoco sirve como importe de linea.
-- nu_price_final y qu_total estan VACIOS en las 440.059 filas de la tabla.

-- R5 · Cuanto ocupa el defecto: la tabla NO tiene ninguna columna de importe por linea
SELECT count(*) n, count(nu_price_base) pb, count(nu_price_final) pf, count(qu_total) qt,
       count(nu_amount_total) amt, count(nu_amount_total_conversion) amtc FROM invoice_detail;
-- 440.059 | 440.059 | 0 | 0 | 440.059 | 440.059

-- R5b · En el 96% de las facturas TODAS las lineas traen el mismo importe; en el 4% restante
--       hay 2-3 valores, y tampoco son importes de linea (son ~856x la cabecera)
SELECT count(*) facturas_con_mas_de_un_valor FROM (
  SELECT i.id_invoice FROM invoice i JOIN invoice_detail d ON d.id_invoice=i.id_invoice
   WHERE i.da_invoice>='2026-09-01' GROUP BY i.id_invoice HAVING count(DISTINCT d.nu_amount_total)>1) z;
-- 273 de 7.370 facturas de septiembre

-- R6 · HALLAZGO 2 · La cifra de pantalla reproducida al centimo, CON EL JOIN YA EN ROL 7,
--      y desglosada por las 18 Lineas (la vista "Linea" mostraba 18 filas)
WITH lin AS (
  SELECT l1.na_product_structure linea, d.nu_amount_total dbs, d.nu_amount_total_conversion dconv
  FROM invoice i
  JOIN salesman_view s ON s.id_user=i.id_user AND s.co_role=7
  JOIN invoice_detail d ON d.id_invoice=i.id_invoice
  JOIN product p ON p.id_product=d.id_product
  JOIN product_structure l2 ON l2.id_product_structure=p.id_product_structure
  JOIN product_structure l1 ON l1.co_product_structure=l2.sco_product_structure AND l1.id_type_product_structure=1
  WHERE i.da_invoice>='2026-09-01' AND i.da_invoice<'2026-09-15')
SELECT linea, count(*) lineas, round(sum(dbs)::numeric,2) col_inflada, round(sum(dconv)::numeric,2) col_conversion
  FROM lin GROUP BY 1 ORDER BY 3 DESC;
-- 18 filas. GALLETAS 280.303.497,85 · PASAPALOS 125.071.197,08 · ... · TORTAS 853.353,68
-- TOTAL 905.028.443,33  (identico a la pantalla del 15/09)  |  conversion 1.142.201,63
-- Cabecera correcta del mismo corte: 80.160,23 => x11.290 la columna BS, x14,25 la _conversion
-- Agosto: col_inflada 2.469.301.992,11 · conversion 3.249.076,61 · correcto 224.411,08

-- R7 · "Sub-Linea" NO existe en INSUMAR: la estructura de producto tiene 2 niveles
SELECT nu_level, na_type_product_structure FROM type_product_structure ORDER BY nu_level;
-- 1 = Linea · 2 = Proveedor   (la de empresa: 1 = Pais · 2 = Estado)
SELECT count(*) FILTER (WHERE id_type_product_structure=1) lineas,
       count(*) FILTER (WHERE id_type_product_structure=2) proveedores FROM product_structure;
-- 18 lineas · 161 proveedores

-- R8 · HALLAZGO 3 · Censo COMPLETO de usuarios: quien esta en salesman_view y quien no
SELECT u.id_user, ud.co_user, u.name_user||' '||coalesce(u.lastname_user,'') nom, u.co_operation,
       ru.co_role, (SELECT count(*) FROM salesman_view sv WHERE sv.id_user=u.id_user) en_sv,
       (SELECT count(*) FROM invoice i WHERE i.id_user=u.id_user) facturas
  FROM users u LEFT JOIN users_data ud ON ud.id_user=u.id_user LEFT JOIN role_user ru ON ru.id_user=u.id_user
 ORDER BY u.id_user;
-- 24 usuarios. UN SOLO co_operation='D': id_user=13 R003 EVA MEDINA (rol 7), fuera de salesman_view,
-- con 1.881 facturas. El id_user=22 (R003, 'I') tiene 0 facturas.
-- (admin id_user=1 tampoco esta en salesman_view, pero tiene 0 facturas)

-- R9 · HALLAZGO 3 AMPLIADO · Facturas que NO alcanza salesman_view: son TRES id_user, no uno
SELECT i.id_user, i.co_user, count(*) n, round(sum(i.nu_amount_total)::numeric,2) m,
       min(i.da_invoice)::date pri, max(i.da_invoice)::date ult,
       (SELECT count(*) FROM users u WHERE u.id_user=i.id_user) existe_en_users
  FROM invoice i WHERE NOT EXISTS (SELECT 1 FROM salesman_view s WHERE s.id_user=i.id_user)
 GROUP BY 1,2 ORDER BY n DESC;
--  13 | R003 | 1.881 |   293.168,86 | 12/02/2026 | 24/08/2026 | existe (co_operation='D')
-- 470 | R013 |   644 |   138.790,15 | 17/04/2026 | 08/07/2026 | NO EXISTE en users
-- 471 | R006 |   282 | 5.633.764,69 | 23/09/2020 | 08/07/2026 | NO EXISTE en users
--       (de esos 5,63 M, 5.575.500,00 son UNA sola factura de 2020 en BS; en 2026 son 58.264,69 US$)
-- Invisible en 2026: 2.806 facturas | 490.223,70 US$ frente a 1.733.804,89 que muestra el ano.

-- R10 · HALLAZGO 3 · El corte del 25/08: pedidos del id viejo y del id nuevo, sin solape
SELECT o.id_user, o.co_user, count(*) n, round(sum(o.nu_amount_total)::numeric,2) m,
       min(o.da_order)::date pri, max(o.da_order)::date ult,
       (SELECT count(*) FROM salesman_view s WHERE s.id_user=o.id_user) en_sv
  FROM "order" o GROUP BY 1,2 ORDER BY n DESC;
-- 13 R003 | 143 | 19.286,24 | 11/08 -> 24/08 | en_sv=0   <= INVISIBLES
-- 22 R003 | 158 | 22.218,33 | 25/08 -> 11/09 | en_sv=1
-- La ultima factura del id 13 es del 24/08 y el primer pedido del id 22 es del 25/08:
-- el relevo es exactamente el 25/08/2026.
-- Lineas de detalle colgando del id 13: 1.397 (order_detail). Total de pedidos: 620 => 23% invisible.

-- R11 · El id nuevo de EVA (22) tiene pedidos pero NINGUNA factura, nunca
SELECT 'facturas id 22' k, count(*) n FROM invoice WHERE id_user=22
UNION ALL SELECT 'facturas co_user=R003 despues del 24/08', count(*) FROM invoice WHERE co_user='R003' AND da_invoice>'2026-08-24';
-- 0 y 0

-- R12 · Las tablas no se movieron durante la auditoria (descarta "cambio de dato")
SELECT 'quota_plan_enterprise' t, count(*) n, max(da_update)::timestamp(0) upd FROM quota_plan_enterprise
UNION ALL SELECT 'sales_plan_enterprise', count(*), max(da_update)::timestamp(0) FROM sales_plan_enterprise
UNION ALL SELECT 'invoice', count(*), max(da_update)::timestamp(0) FROM invoice
UNION ALL SELECT 'users', count(*), max(da_update)::timestamp(0) FROM users
UNION ALL SELECT 'order', count(*), max(da_update)::timestamp(0) FROM "order";
-- quota 72 (15/08) · sales_plan 12 (15/08) · invoice 46.564 (11/09) · users 24 (11/09) · order 620 (11/09)
