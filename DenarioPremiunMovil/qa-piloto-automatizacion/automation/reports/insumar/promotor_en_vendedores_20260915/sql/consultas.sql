-- INSUMAR · ¿Los PROMOTORES se cuelan como vendedores? · 2026-09-15 · SOLO LECTURA
-- Ejecutar con:  node automation/db/query.js insumar "<SQL>"

-- ============================================================
-- Q1 · LA PREGUNTA DEL ENCARGO: ¿el corte certificado incluye al promotor?
--      Resultado: SOLO salen los roles 1, 7 y 15. El rol 9 (ROLE_PROMOTER)
--      NO APARECE ⇒ no tiene ni una factura en agosto.
--      rol 7 = 1171 facturas / 224.411,08  ← el número certificado, intacto
-- ============================================================
SELECT sv.co_role, count(*) AS facturas, round(sum(i.nu_amount_total)::numeric,2) AS monto
FROM   invoice i JOIN salesman_view sv ON sv.id_user = i.id_user
WHERE  i.da_invoice >= '2026-08-01' AND i.da_invoice < '2026-09-01'
GROUP  BY 1 ORDER BY 1;
-- co_role 1  ->      4 /     1.090,81
-- co_role 7  ->  1.171 /   224.411,08   ✔ el corte certificado
-- co_role 15 -> 17.196 / 2.954.757,96
-- (co_role 9 ausente)

-- ============================================================
-- Q2 · Refuerzo: P001 no tiene facturas EN NINGUNA FECHA, no solo en agosto.
--      Cierra la puerta a "es que agosto fue flojo".
-- ============================================================
SELECT sv.co_user, sv.na_user, sv.co_role,
       count(i.id_invoice) AS facturas,
       min(i.da_invoice) AS primera, max(i.da_invoice) AS ultima,
       round(coalesce(sum(i.nu_amount_total),0)::numeric,2) AS monto
FROM   salesman_view sv LEFT JOIN invoice i ON i.id_user = sv.id_user
GROUP  BY 1,2,3 ORDER BY 3,1;
-- P001 MARIA JOSE PEREZ (rol 9) -> 0 facturas, primera=NULL, ultima=NULL, 0,00

-- ============================================================
-- Q3 · El flag `selector` NO es el criterio: solo 7 y 15 lo tienen en true,
--      y la pantalla muestra 7 y 9, y oculta 15 y 16.
-- ============================================================
SELECT co_role, na_role, st_role, selector FROM role ORDER BY co_role;
-- 7  ROLE_SALESMAN  selector=true
-- 9  ROLE_PROMOTER  selector=false   <- SALE en los combos
-- 15 ROLE_TRANSPORT selector=true    <- NO sale
-- 16 ROLE_CATALOG   selector=false   <- NO sale

-- ============================================================
-- Q4 🔑 · Censo de salesman_view por rol. Es la prueba de que el criterio
--         efectivo es exactamente `co_role IN (7, 9)`:
--         6 usuarios de rol 7 + 1 de rol 9 = los 7 que ofrecen TODOS los combos.
--         Los roles 1 (5 usuarios), 3 (1), 6 (2), 15 (6) y 16 (1) quedan fuera.
-- ============================================================
SELECT sv.co_role, r.na_role, r.selector, count(*) AS usuarios,
       string_agg(sv.co_user, ', ' ORDER BY sv.co_user) AS quienes
FROM   salesman_view sv JOIN role r ON r.co_role = sv.co_role
GROUP  BY 1,2,3 ORDER BY 1;

-- ============================================================
-- Q5 · P001 tampoco tiene clientes asignados ⇒ la fila que pinta
--      Activación de Clientes es estructuralmente 0, no un 0 coyuntural.
-- ============================================================
SELECT sv.co_user, sv.na_user, sv.co_role, count(*) AS clientes
FROM   client_template_user ctu JOIN salesman_view sv ON sv.id_user = ctu.id_user
GROUP  BY 1,2,3 ORDER BY 3,1;
-- P001 no aparece en el resultado: 0 clientes en client_template_user
