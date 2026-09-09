import { PlanCuotaEmpresaView } from './planCuotaEmpresaView';

describe('PlanCuotaEmpresaView', () => {
  it('PlanCuotaEmpresaViewJson reads ventaPedidoMes and ventaFacturadaMes', () => {
    const plan = PlanCuotaEmpresaView.PlanCuotaEmpresaViewJson({
      id: 1,
      idPresupuesto: 10,
      coEnterprise: 'E1',
      naEnterprise: 'Empresa',
      coUser: 'U1',
      daBudget: '2026-08-01',
      coUnit: 'USD',
      naUnit: 'Dólares',
      cuotaMes: 5000,
      ventaRealMes: 100,
      ventaPedidoMes: 150,
      ventaFacturadaMes: 120,
    });

    expect(plan.ventaPedidoMes).toBe(150);
    expect(plan.ventaFacturadaMes).toBe(120);
    expect(plan.ventaRealMes).toBe(100);
  });

  it('PlanCuotaEmpresaViewJson falls back ventaPedidoMes from ventaRealMes', () => {
    const plan = PlanCuotaEmpresaView.PlanCuotaEmpresaViewJson({
      id: 2,
      idPresupuesto: 11,
      coEnterprise: 'E1',
      naEnterprise: 'Empresa',
      coUser: 'U1',
      daBudget: '2026-08-01',
      coUnit: 'USD',
      naUnit: 'Dólares',
      cuotaMes: 5000,
      ventaRealMes: 200,
    });

    expect(plan.ventaPedidoMes).toBe(200);
    expect(plan.ventaFacturadaMes).toBeUndefined();
  });
});
