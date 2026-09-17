import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { InventarioHeaderComponent } from './inventario-header.component';
import { InventariosLogicService } from 'src/app/services/inventarios/inventarios-logic.service';
import {
  configureIonicComponentTestingModule,
  createShallowComponentFixture,
} from 'src/app/testing/ionic-component-spec.helpers';

describe('InventarioHeaderComponent', () => {
  let component: InventarioHeaderComponent;
  let fixture: ComponentFixture<InventarioHeaderComponent>;
  let inventariosLogicService: InventariosLogicService;

  beforeEach(waitForAsync(() => {
    configureIonicComponentTestingModule(InventarioHeaderComponent).compileComponents();
  }));

  beforeEach(() => {
    ({ fixture, component } = createShallowComponentFixture(InventarioHeaderComponent));
    inventariosLogicService = TestBed.inject(InventariosLogicService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('INV-SUG-003 Enviar con flag pendiente', () => {
    it('proceedAfterSendConfirm abre adjuntar si hay flag y no hay snapshot', async () => {
      inventariosLogicService.suggestedOrder = true;
      inventariosLogicService.newClientStock = { coClientStock: 'CS-1' } as any;
      inventariosLogicService.inventarioTags = new Map([['INV_HEADER_MESSAGE', 'Inventario']]);
      (inventariosLogicService as any).getSuggestedOrderSnapshotByClientStock = jasmine.createSpy(
        'getSuggestedOrderSnapshotByClientStock',
      ).and.resolveTo(null);
      (inventariosLogicService as any).hasPendingSuggestedOrderPersist = jasmine.createSpy(
        'hasPendingSuggestedOrderPersist',
      ).and.returnValue(true);
      (inventariosLogicService as any).setAttachSuggestedOrderOnStockSend = jasmine.createSpy(
        'setAttachSuggestedOrderOnStockSend',
      );
      spyOn(component as any, 'saveSendNewReturn');

      await (component as any).proceedAfterSendConfirm();

      expect(component.alertMessageOpenSendSuggested).toBeTrue();
      expect((component as any).saveSendNewReturn).not.toHaveBeenCalled();
    });

    it('proceedAfterSendConfirm no abre adjuntar sin snapshot ni flag', async () => {
      inventariosLogicService.suggestedOrder = true;
      inventariosLogicService.newClientStock = { coClientStock: 'CS-1' } as any;
      (inventariosLogicService as any).getSuggestedOrderSnapshotByClientStock = jasmine.createSpy(
        'getSuggestedOrderSnapshotByClientStock',
      ).and.resolveTo(null);
      (inventariosLogicService as any).hasPendingSuggestedOrderPersist = jasmine.createSpy(
        'hasPendingSuggestedOrderPersist',
      ).and.returnValue(false);
      (inventariosLogicService as any).setAttachSuggestedOrderOnStockSend = jasmine.createSpy(
        'setAttachSuggestedOrderOnStockSend',
      );
      spyOn(component as any, 'saveSendNewReturn');

      await (component as any).proceedAfterSendConfirm();

      expect(component.alertMessageOpenSendSuggested).toBeFalse();
      expect(inventariosLogicService.setAttachSuggestedOrderOnStockSend).toHaveBeenCalledWith('CS-1', false);
      expect((component as any).saveSendNewReturn).toHaveBeenCalled();
    });
  });
});
