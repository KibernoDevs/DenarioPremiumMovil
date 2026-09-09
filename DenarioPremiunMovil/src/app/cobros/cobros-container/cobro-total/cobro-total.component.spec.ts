import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { CobroTotalComponent } from './cobro-total.component';
import { CollectionService } from 'src/app/services/collection/collection-logic.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { DateServiceService } from 'src/app/services/dates/date-service.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';

describe('CobroTotalComponent', () => {
  let component: CobroTotalComponent;
  let fixture: ComponentFixture<CobroTotalComponent>;
  let collectServiceMock: any;

  beforeEach(waitForAsync(() => {
    collectServiceMock = {
      calculateDifference: false,
      dynamicRetentions: false,
      retencion: false,
      montoIgtf: 0,
      coTypeModule: '0',
      collection: {
        collectionDetails: [],
      },
      collectionTags: new Map(),
      shouldDisplayIgtfInTotals: () => false,
      resolveCollectionDetailPaymentDisplay: () => ({ igtfAmount: 0, amountToPay: 0 }),
      resolveCollectionDetailRemainingBalance: () => 0,
      convertirMonto: (amount: number) => amount,
    };

    TestBed.configureTestingModule({
      declarations: [CobroTotalComponent],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: CollectionService, useValue: collectServiceMock },
        { provide: GlobalConfigService, useValue: { get: () => undefined } },
        {
          provide: CurrencyService,
          useValue: { formatNumber: (n: number) => String(n) },
        },
        {
          provide: DateServiceService,
          useValue: { hoyISO: () => '2026-08-04T00:00:00' },
        },
        { provide: SynchronizationDBService, useValue: { getDatabase: () => ({}) } },
      ],
    })
      .overrideComponent(CobroTotalComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(CobroTotalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('P2: formatTotalizationAmount hides zero and formats positive amounts', () => {
    expect(component.formatTotalizationAmount(0)).toBe('');
    expect(component.formatTotalizationAmount(125.5)).toBe('125.5');
  });

  it('P2: hasTotalizationColumnAmount detects retention/discount columns from details', () => {
    collectServiceMock.collection.collectionDetails = [{
      nuAmountDiscount: 0,
      nuAmountRetention: 10,
      nuAmountRetention2: 0,
      nuAmountCollectDiscount: 0,
    }];

    expect(component.hasTotalizationColumnAmount('retentionIva')).toBeTrue();
    expect(component.hasTotalizationColumnAmount('discount')).toBeFalse();
  });

  it('P2: resolveDetailRemainingBalance delegates to collection service', () => {
    collectServiceMock.resolveCollectionDetailRemainingBalance = jasmine
      .createSpy('resolveCollectionDetailRemainingBalance')
      .and.returnValue(12.5);
    const detail = { nuAmountPaid: 400 } as any;

    expect(component.resolveDetailRemainingBalance(detail)).toBe(12.5);
    expect(collectServiceMock.resolveCollectionDetailRemainingBalance).toHaveBeenCalledWith(detail);
  });

  it('P2: calculateDifDocsNegativos accumulates negative document balances', () => {
    collectServiceMock.collection = {
      coCurrency: 'USD',
      nuValueLocal: 1,
      collectionDetails: [
        { nuBalanceDoc: -20, nuValueLocal: 1 },
        { nuBalanceDoc: 50, nuValueLocal: 1 },
      ],
    };
    collectServiceMock.difDocsNegativosByRate = 0;
    collectServiceMock.difDocsNegativosByOriginalRate = 0;
    collectServiceMock.difference = 0;
    collectServiceMock.calculateDifference = true;

    component.calculateDifDocsNegativos();

    expect(collectServiceMock.difDocsNegativosByRate).toBe(-20);
    expect(collectServiceMock.difference).toBe(0);
  });
});
