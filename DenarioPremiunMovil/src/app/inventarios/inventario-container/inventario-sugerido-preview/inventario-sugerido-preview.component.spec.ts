import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { InventarioSugeridoPreviewComponent } from './inventario-sugerido-preview.component';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { PedidosService } from 'src/app/pedidos/pedidos.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ModalController } from '@ionic/angular';
import { Client } from 'src/app/modelos/tables/client';
import { MSG_CLIENT_SUSPENDED_ORDER } from 'src/app/utils/client-suspension.policy';
import {
  configureIonicComponentTestingModule,
  createShallowComponentFixture,
} from 'src/app/testing/ionic-component-spec.helpers';

describe('InventarioSugeridoPreviewComponent', () => {
  let component: InventarioSugeridoPreviewComponent;
  let fixture: ComponentFixture<InventarioSugeridoPreviewComponent>;

  const mockPedidosService = {
    ensureModuleReady: jasmine.createSpy('ensureModuleReady').and.returnValue(Promise.resolve()),
    getTag: jasmine.createSpy('getTag').and.callFake((tagName: string) =>
      tagName === 'PED_MONEDA' ? 'Moneda' : '',
    ),
  };

  const mockCurrencyService = {
    setup: jasmine.createSpy('setup').and.returnValue(Promise.resolve()),
    getCurrencyModule: jasmine.createSpy('getCurrencyModule').and.returnValue({
      idModule: 0,
      localCurrencyDefault: true,
      currencySelector: true,
    }),
    getLocalCurrency: jasmine.createSpy('getLocalCurrency').and.returnValue({
      idCurrency: 1,
      coCurrency: 'BS',
    }),
    getHardCurrency: jasmine.createSpy('getHardCurrency').and.returnValue({
      idCurrency: 2,
      coCurrency: '$',
    }),
    multimoneda: false,
    formatNumber: (value: number) => String(value),
  };

  beforeEach(waitForAsync(() => {
    configureIonicComponentTestingModule(InventarioSugeridoPreviewComponent, [
      { provide: PedidosService, useValue: mockPedidosService },
      { provide: CurrencyService, useValue: mockCurrencyService },
    ]).compileComponents();
  }));

  beforeEach(() => {
    mockPedidosService.ensureModuleReady.calls.reset();
    mockPedidosService.getTag.calls.reset();
    ({ fixture, component } = createShallowComponentFixture(InventarioSugeridoPreviewComponent));
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('resuelve monedaLabel desde PED_MONEDA cuando el input viene vacío', async () => {
    component.monedaLabel = '';
    component.ngOnInit();
    await fixture.whenStable();

    expect(mockPedidosService.ensureModuleReady).toHaveBeenCalled();
    expect(mockPedidosService.getTag).toHaveBeenCalledWith('PED_MONEDA');
    expect(component.monedaLabel).toBe('Moneda');
  });

  it('confirm suspendido muestra aviso y no cierra modal', () => {
    const message = TestBed.inject(MessageService);
    spyOn(message, 'transaccionMsjModalNB');
    const modalCtrl = TestBed.inject(ModalController) as unknown as { dismiss: jasmine.Spy };
    modalCtrl.dismiss = jasmine.createSpy('dismiss');
    component.client = { inSuspension: true } as Client;

    component.confirm();

    expect(message.transaccionMsjModalNB).toHaveBeenCalledWith(MSG_CLIENT_SUSPENDED_ORDER);
    expect(modalCtrl.dismiss).not.toHaveBeenCalled();
  });

  it('confirm activo dismiss confirm', () => {
    const message = TestBed.inject(MessageService);
    spyOn(message, 'transaccionMsjModalNB');
    const modalCtrl = TestBed.inject(ModalController) as unknown as { dismiss: jasmine.Spy };
    modalCtrl.dismiss = jasmine.createSpy('dismiss');
    component.client = { inSuspension: false } as Client;
    component.monedaSeleccionadaPreview = { idCurrency: 1, coCurrency: 'BS' } as any;

    component.confirm();

    expect(message.transaccionMsjModalNB).not.toHaveBeenCalled();
    expect(modalCtrl.dismiss).toHaveBeenCalledWith(
      { monedaSeleccionada: component.monedaSeleccionadaPreview },
      'confirm',
    );
  });
});
