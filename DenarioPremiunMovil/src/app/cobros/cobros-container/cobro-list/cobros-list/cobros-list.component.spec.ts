import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { CobrosListComponent } from './cobros-list.component';
import { CollectionService } from 'src/app/services/collection/collection-logic.service';
import { EnterpriseService } from 'src/app/services/enterprise/enterprise.service';
import { GeolocationService } from 'src/app/services/geolocation/geolocation.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';

describe('CobrosListComponent', () => {
  let component: CobrosListComponent;
  let fixture: ComponentFixture<CobrosListComponent>;
  let collectServiceMock: any;

  beforeEach(waitForAsync(() => {
    collectServiceMock = {
      userMustActivateGPS: false,
      newCollect: true,
      collectionTags: new Map([
        ['COB_HEADER_MESSAGE', 'Cobros'],
        ['COB_CONFIRM_DELETE', '¿Eliminar?'],
      ]),
      itemListaCobros: [
        { id_collection: 10, co_client: 'CLI-001', lb_client: 'Cliente Alpha' },
        { id_collection: 20, co_client: 'CLI-002', lb_client: 'Cliente Beta' },
      ],
      listCollect: [],
      initLogicService: jasmine.createSpy('initLogicService'),
      ensureCobCurrencyModuleLoaded: jasmine.createSpy('ensureCobCurrencyModuleLoaded').and.resolveTo(),
      ensureDocumentSaleTypeInvoiceMapLoaded: jasmine.createSpy('ensureDocumentSaleTypeInvoiceMapLoaded').and.resolveTo(),
    };

    TestBed.configureTestingModule({
      declarations: [CobrosListComponent],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: CollectionService, useValue: collectServiceMock },
        { provide: EnterpriseService, useValue: {} },
        { provide: GeolocationService, useValue: { getCurrentPosition: () => Promise.resolve('') } },
        { provide: MessageService, useValue: {} },
        { provide: SynchronizationDBService, useValue: { getDatabase: () => ({}) } },
      ],
    })
      .overrideComponent(CobrosListComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(CobrosListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('P2: handleInput filters list by client name', () => {
    component.handleInput({ detail: { value: 'beta' } });

    expect(component.hasNoVisibleItems()).toBeFalse();
    expect(component.displayedItems.length).toBe(1);
    expect(component.displayedItems[0].lb_client).toBe('Cliente Beta');
  });

  it('P2: handleInput with no match yields empty visible list', () => {
    component.handleInput({ detail: { value: 'zzz-no-existe' } });

    expect(component.hasNoVisibleItems()).toBeTrue();
    expect(component.displayedItems.length).toBe(0);
  });
});
