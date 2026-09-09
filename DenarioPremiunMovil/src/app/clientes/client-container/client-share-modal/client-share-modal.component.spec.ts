import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ClientShareModalComponent } from './client-share-modal.component';
import { ClientLogicService } from 'src/app/services/clientes/client-logic.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { PdfCreatorService } from 'src/app/services/pdf-creator/pdf-creator.service';
import { ImageServicesService } from 'src/app/services/imageServices/image-services.service';
import { DocumentSale } from 'src/app/modelos/tables/documentSale';

describe('ClientShareModalComponent', () => {
  let component: ClientShareModalComponent;
  let fixture: ComponentFixture<ClientShareModalComponent>;
  let clientLogic: jasmine.SpyObj<Pick<ClientLogicService,
    'canShowConversion' | 'getPrimaryCurrencyLabel' | 'getSecondaryCurrencyLabel' | 'localCurrencyDefault'
    | 'clientTags' | 'clientTagsDenario' | 'closeClientShareModalFunction' | 'message' | 'documentsSaleSelectShared'>>;

  const buildDoc = (overrides: Partial<DocumentSale> = {}): DocumentSale => ({
    coDocument: 'FAC-1',
    coCurrency: 'USD',
    nuAmountTotal: 100,
    nuBalance: 50,
    nuValueLocal: 737.88,
    daDueDate: '01/01/2026',
    daDocument: '01/01/2026',
    ...overrides,
  } as DocumentSale);

  beforeEach(waitForAsync(() => {
    clientLogic = jasmine.createSpyObj('ClientLogicService', [
      'canShowConversion',
      'getPrimaryCurrencyLabel',
      'getSecondaryCurrencyLabel',
      'closeClientShareModalFunction',
    ], {
      localCurrencyDefault: false,
      clientTags: new Map<string, string>(),
      clientTagsDenario: new Map<string, string>([['DENARIO_BOTON_CANCELAR', 'Cancelar']]),
      documentsSaleSelectShared: [],
      message: {
        showLoading: () => Promise.resolve(),
        hideLoading: () => Promise.resolve(),
      },
    });

    clientLogic.canShowConversion.and.returnValue(false);
    clientLogic.getPrimaryCurrencyLabel.and.returnValue('USD');
    clientLogic.getSecondaryCurrencyLabel.and.returnValue('BS');

    TestBed.configureTestingModule({
      declarations: [ClientShareModalComponent],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: ClientLogicService, useValue: clientLogic },
        {
          provide: CurrencyService,
          useValue: {
            localCurrency: { coCurrency: 'BS' },
            hardCurrency: { coCurrency: 'USD' },
            formatNumber: (n: number) => String(n),
            toLocalCurrencyByNuValueLocal: (n: number) => n * 737.88,
            toHardCurrencyByNuValueLocal: (n: number) => n / 737.88,
          },
        },
        { provide: GlobalConfigService, useValue: { get: () => 'RIF' } },
        { provide: PdfCreatorService, useValue: {} },
        { provide: ImageServicesService, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientShareModalComponent);
    component = fixture.componentInstance;
    component.client = { coClient: 'C1', naClient: 'Cliente QA' } as any;
    component.localCurrency = 'BS';
    component.hardCurrency = 'USD';
  }));

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('CLI-CURRENCY-PDF: localCurrencyDefault=false usa USD como primaria en etiquetas', () => {
    expect(component.primaryCurrencyLabel).toBe('USD');
    expect(component.secondaryCurrencyLabel).toBe('BS');
  });

  it('CLI-CURRENCY-PDF: toPrimaryCurrency devuelve monto en moneda fuerte cuando doc es USD', () => {
    const doc = buildDoc({ coCurrency: 'USD', nuAmountTotal: 100 });
    expect(component.toPrimaryCurrency(100, doc)).toBe('100');
  });

  it('CLI-CURRENCY-PDF: toPrimaryCurrency convierte a USD cuando doc es BS y default es fuerte', () => {
    const doc = buildDoc({ coCurrency: 'BS', nuAmountTotal: 737.88 });
    expect(component.toPrimaryCurrency(737.88, doc)).toBe('1');
  });

  it('CLI-CURRENCY-PDF: toPrimaryCurrency devuelve local cuando localCurrencyDefault=true', () => {
    Object.defineProperty(clientLogic, 'localCurrencyDefault', { value: true, configurable: true });
    clientLogic.getPrimaryCurrencyLabel.and.returnValue('BS');

    const doc = buildDoc({ coCurrency: 'BS', nuAmountTotal: 100 });
    expect(component.toPrimaryCurrency(100, doc)).toBe('100');
  });
});
