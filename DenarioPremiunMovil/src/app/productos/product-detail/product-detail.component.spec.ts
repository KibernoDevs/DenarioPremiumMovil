import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ProductDetailComponent } from './product-detail.component';
import { ProductService } from 'src/app/services/products/product.service';
import { PriceListService } from 'src/app/services/priceLists/price-list.service';
import { StockService } from 'src/app/services/stocks/stock.service';
import { ImageServicesService } from 'src/app/services/imageServices/image-services.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { PedidosService } from 'src/app/pedidos/pedidos.service';
import { TextService } from 'src/app/services/text/text.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { ProductDetail } from 'src/app/modelos/ProductDetail';
import { CurrencyModules } from 'src/app/modelos/tables/currencyModules';

describe('ProductDetailComponent', () => {
  let component: ProductDetailComponent;
  let fixture: ComponentFixture<ProductDetailComponent>;
  let productServiceMock: jasmine.SpyObj<ProductService>;
  let currencyServiceMock: jasmine.SpyObj<CurrencyService>;
  let globalConfigMock: jasmine.SpyObj<GlobalConfigService>;
  let imageServicesMock: jasmine.SpyObj<ImageServicesService>;

  const detail = {
    idProduct: 1,
    coProduct: 'P-001',
    naProduct: 'Producto demo',
    idProductStructure: 1,
    coProductStructure: 'S1',
    naProductStructure: 'Estructura',
    txDescription: '',
    txPacking: '',
    txDimension: '',
    idUnit: 1,
    coUnit: 'UND',
    naUnit: 'Unidad',
    points: 0,
    priceLocal: 100,
    coCurrencyLocal: 'Bs',
    priceHard: 2.5,
    coCurrencyHard: '$',
    conversion: '40',
    stock: 10,
    coEnterprise: 'E1',
    idEnterprise: 1,
    nuTax: 16,
  } as ProductDetail;

  beforeEach(waitForAsync(async () => {
    productServiceMock = jasmine.createSpyObj('ProductService', [
      'syncOrderPresentationFromPedidos',
      'formatNumber',
      'resolveDisplayPriceForUnit',
      'getCatalogUnitsForProduct',
      'getUnitsByIdProductOrderByCoPrimaryUnit',
      'mapUnitToUnitInfo',
      'catalogHasProdMinMul',
      'getCatalogProdMinMul',
      'getCatalogPresentationTag',
      'formatStock',
    ], {
      catalogUnitByPriceList: false,
      catalogShowProductImages: true,
      catalogValidateWarehouses: false,
      catalogShowStock: false,
      catalogDisplayProductPoints: false,
      userCanSelectIVA: false,
      vatExemptProducts: false,
      empresaSeleccionada: { coCurrencyDefault: 'Bs' },
      unitsByProduct: [],
      catalogListaUnitInfo: [],
    });
    productServiceMock.syncOrderPresentationFromPedidos.and.resolveTo();
    productServiceMock.formatNumber.and.callFake((n: number) => String(n));
    productServiceMock.resolveDisplayPriceForUnit.and.callFake((price: number) => price);
    productServiceMock.getCatalogUnitsForProduct.and.returnValue([]);

    currencyServiceMock = jasmine.createSpyObj('CurrencyService', [
      'getCurrencyModule',
      'getLocalCurrency',
      'getHardCurrency',
      'getOppositeCurrency',
      'oppositeCoCurrency',
      'convertFrom',
    ]);
    currencyServiceMock.getCurrencyModule.and.returnValue(
      new CurrencyModules(1, 1, true, true, true),
    );
    currencyServiceMock.getLocalCurrency.and.returnValue({ coCurrency: 'Bs' } as any);
    currencyServiceMock.getHardCurrency.and.returnValue({ coCurrency: '$' } as any);

    globalConfigMock = jasmine.createSpyObj('GlobalConfigService', ['get']);
    globalConfigMock.get.and.callFake((key: string) => {
      const map: Record<string, string> = {
        multiCurrency: 'true',
        conversionByPriceList: 'false',
        currencyModule: 'true',
        hideProductWarehouse: 'true',
      };
      return map[key] ?? 'false';
    });

    imageServicesMock = jasmine.createSpyObj('ImageServicesService', [
      'getImagesForProduct',
      'getImgForProduct',
    ]);
    imageServicesMock.getImagesForProduct.and.resolveTo(['img://a.jpg']);
    imageServicesMock.getImgForProduct.and.returnValue('img://a.jpg');

    const priceListMock = jasmine.createSpyObj('PriceListService', ['getListByIdProduct', 'getPriceListByIdListAndIdProduct'], {
      productlists: [],
    });
    priceListMock.getListByIdProduct.and.resolveTo();

    TestBed.configureTestingModule({
      declarations: [ProductDetailComponent],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: ProductService, useValue: productServiceMock },
        { provide: PriceListService, useValue: priceListMock },
        { provide: StockService, useValue: jasmine.createSpyObj('StockService', ['getWarehousesByIdProduct']) },
        { provide: ImageServicesService, useValue: imageServicesMock },
        { provide: GlobalConfigService, useValue: globalConfigMock },
        { provide: CurrencyService, useValue: currencyServiceMock },
        { provide: PedidosService, useValue: {} },
        { provide: TextService, useValue: { isNull: () => false } },
        { provide: SynchronizationDBService, useValue: { getDatabase: () => ({}) } },
      ],
    })
      .overrideComponent(ProductDetailComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(ProductDetailComponent);
    component = fixture.componentInstance;
    component.pSeleccionado = detail;
    component.productDetailTags = new Map();
    await component.ngOnInit();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('muestra conversión aunque userCanSelectIVA sea false', () => {
    expect(productServiceMock.userCanSelectIVA).toBeFalse();
    expect(component.showConversionInfo).toBeTrue();
    expect(component.basePriceHard).toBe(2.5);
    expect(component.hasConversionRate()).toBeTrue();
    expect(component.getDisplayPriceHard()).toBe(2.5);
  });

  it('openImageZoom abre en el índice pulsado y cierra el modal', () => {
    component.productImages = ['img://a.jpg', 'img://b.jpg', 'img://c.jpg'];
    component.openImageZoom(2);
    expect(component.imageZoomOpen).toBeTrue();
    expect(component.imageZoomStartIndex).toBe(2);
    component.closeImageZoom();
    expect(component.imageZoomOpen).toBeFalse();
  });

  it('openImageZoom acota el índice al rango de fotos', () => {
    component.productImages = ['img://a.jpg', 'img://b.jpg'];
    component.openImageZoom(99);
    expect(component.imageZoomStartIndex).toBe(1);
    component.openImageZoom(-3);
    expect(component.imageZoomStartIndex).toBe(0);
  });

  it('onZoomModalPresented llama slideTo al índice guardado', () => {
    const slideTo = jasmine.createSpy('slideTo');
    component.imageZoomStartIndex = 1;
    component.zoomSwiper = {
      nativeElement: { swiper: { slideTo } },
    } as any;
    component.onZoomModalPresented();
    expect(slideTo).toHaveBeenCalledWith(1, 0);
  });

  it('getZoomImages usa productImages o fallback', () => {
    component.productImages = ['img://a.jpg', 'img://b.jpg'];
    expect(component.getZoomImages()).toEqual(['img://a.jpg', 'img://b.jpg']);

    component.productImages = [];
    expect(component.getZoomImages()).toEqual(['img://a.jpg']);
  });
});
