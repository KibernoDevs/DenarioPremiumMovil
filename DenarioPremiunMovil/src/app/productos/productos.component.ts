import { Component, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { ServicesService } from '../services/services.service';
import { SynchronizationDBService } from '../services/synchronization/synchronization-db.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { Enterprise } from '../modelos/tables/enterprise';
import { EnterpriseService } from '../services/enterprise/enterprise.service';
import { ProductStructureUtil } from '../modelos/ProductStructureUtil';
import { TypeProductStructure } from '../modelos/tables/typeProductStructure';
import { ProductStructure } from '../modelos/tables/productStructure';
import { ProductStructureService } from '../services/productStructures/product-structure.service';
import { ProductListComponent } from './product-list/product-list.component';
import { Product } from '../modelos/tables/product';
import { ProductDetail } from '../modelos/ProductDetail';
import { ProductService } from '../services/products/product.service';
import { ImageServicesService } from '../services/imageServices/image-services.service';
import { CurrencyService } from 'src/app/services/currency/currency.service';
import { GlobalConfigService } from '../services/globalConfig/global-config.service';
import { PedidosService } from '../pedidos/pedidos.service';
import { ProductReportsService } from '../services/products/product-reports.service';

@Component({
  selector: 'app-productos',
  templateUrl: './productos.component.html',
  styleUrls: ['./productos.component.scss'],
  standalone: false
})
export class ProductosComponent {

  tags = new Map<string, string>([]);
  services = inject(ServicesService);
  db = inject(SynchronizationDBService);
  message = inject(MessageService);
  enterpriseService = inject(EnterpriseService);
  productStructureService = inject(ProductStructureService);
  productService = inject(ProductService);
  imageServices = inject(ImageServicesService);
  currencyService = inject(CurrencyService);
  public config = inject(GlobalConfigService);
  public orderService = inject(PedidosService);
  private productReportsService = inject(ProductReportsService);

  showProducts: Boolean = false;
  showProductDetail: Boolean = false;
  showProductStructures: Boolean = true;
  showProductReports: Boolean = false;
  showSearch: Boolean = true;
  psSelected: Boolean = false;
  productStructureList: ProductStructure[] = [];
  searchText: string = '';

  empresaSeleccionada!: Enterprise;
  tpsSeleccionada!: TypeProductStructure;
  psSeleccionada!: ProductStructure;
  selectedProduct!: ProductDetail;
  listaEmpresa: Enterprise[] = [];
  multiempresa: Boolean = false;
  allowProductReports = false;


  constructor(private router: Router,
    private route: ActivatedRoute,
  ) { }

  ngOnInit() {
    this.productService.productList = [];
    this.message.showLoading().then(() => {
      this.enterpriseService.setup(this.db.getDatabase()).then(async () => {
        this.productService.listaEmpresa = this.enterpriseService.empresas;
        this.productService.empresaSeleccionada = this.productService.listaEmpresa[0];
        this.orderService.empresaSeleccionada = this.productService.listaEmpresa[0];
        this.productService.multiempresa = this.enterpriseService.esMultiempresa();
        await this.productService.syncOrderPresentationFromPedidos(this.orderService);
      });
      this.currencyService.setup(this.db.getDatabase());

      this.getTags().then(() => {  //buscamos los tags
        this.imageServices.downloadWithConcurrency(this.imageServices.downloadFileList);
      });
    });
    this.productService.vatExemptProducts = this.config.get("vatExemptProducts").toLowerCase() === "true";
    this.productService.userCanSelectIVA = this.config.get("userCanSelectIVA").toLowerCase() === "true";
    this.allowProductReports = this.productReportsService.isProductReportsEnabled();
  }

  getTags(): Promise<void> {
    return this.services.getTags(this.db.getDatabase(), "PROD", "ESP").then(result => {
      for (var i = 0; i < result.length; i++) {
        this.tags.set(
          result[i].coApplicationTag, result[i].tag
        )
      }
      this.message.hideLoading();
    });
  }

  async onSelectedProductStructure(psUtil: ProductStructureUtil) {
    this.psSeleccionada = psUtil.productStructure;
    this.tpsSeleccionada = psUtil.typeProductStructure;
    this.empresaSeleccionada = psUtil.enterprise;
    this.productService.empresaSeleccionada = this.empresaSeleccionada;
    this.orderService.empresaSeleccionada = this.empresaSeleccionada;
    await this.productService.syncOrderPresentationFromPedidos(this.orderService);
    this.psSelected = true;
    this.showProducts = true;
    this.showProductStructures = false;
  }

  viewStructures(verEstructuras: Boolean) {
    this.showProducts = false;
    this.showProductStructures = true;
    this.showProductReports = false;
    this.psSelected = false;
    this.searchText = '';
    this.productService.productList = [];
    this.showSearch = true;
  }

  onSelectedProduct(product: ProductDetail) {
    this.selectedProduct = product;
    this.showProductDetail = true;
    this.showProducts = false;
  }

  onBackClicked(verListaProductos: Boolean) {
    if (this.showProductReports) {
      this.showProductReports = false;
      this.showProductStructures = true;
      this.showSearch = true;
      return;
    }
    if (this.showProductDetail) {
      this.showProductDetail = false;
      this.showProducts = true;
      return;
    }
    if (this.showProducts) {
      this.showProducts = false;
      this.showProductStructures = true;
      return;
    }
  }

  setSearchText(value: string) {
    this.searchText = value;
    this.showProductDetail = false;
    this.showProductReports = false;
    this.showProducts = true;
    this.showProductStructures = false;
    this.showSearch = true;
    // this.productService.getProductsSearchedByCoProductAndNaProduct(this.searchText, this.empresaSeleccionada.idEnterprise);
  }

  openProductReports(): void {
    if (!this.empresaSeleccionada?.idEnterprise && this.productService.empresaSeleccionada) {
      this.empresaSeleccionada = this.productService.empresaSeleccionada;
    }

    this.showProductDetail = false;
    this.showProducts = false;
    this.showProductStructures = false;
    this.showProductReports = true;
    this.showSearch = false;
  }
}
