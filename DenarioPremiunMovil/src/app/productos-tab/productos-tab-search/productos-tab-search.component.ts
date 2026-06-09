import { Component, Input, OnDestroy, OnInit, Output, EventEmitter, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { PedidosService } from 'src/app/pedidos/pedidos.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ProductStructureService } from 'src/app/services/productStructures/product-structure.service';
import { ProductService } from 'src/app/services/products/product.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { ReturnLogicService } from 'src/app/services/returns/return-logic.service';
@Component({
  selector: 'productos-tab-search',
  templateUrl: './productos-tab-search.component.html',
  styleUrls: ['./productos-tab-search.component.scss'],
  standalone: false
})
export class ProductosTabSearchComponent implements OnInit, OnDestroy {

  productStructureService = inject(ProductStructureService);
  db = inject(SynchronizationDBService);
  @Input()
  productsTabTags = new Map<string, string>([]);
  productService = inject(ProductService);
  orderServ = inject(PedidosService);
  message = inject(MessageService);

  returnLogic = inject(ReturnLogicService);
  @Input()
  showProductStructure: Boolean = false;
  @Input()
  empresaSeleccionada!: Enterprise;
  @Input()
  pedido: Boolean = false;
  @Input()
  devolucion: Boolean = false;
  @Input()
  showBackButton: Boolean = false;

  searchText: string = '';
  productStructures: Boolean = false;
  disabledSearchButton: Boolean = false;
  showBackIcon = false;
  private searchRequestId = 0;
  productStructuresSub: any;
  //searchSub: any;
  backButtonSub: any;
  productStructureClickedSub: any;
  searchClickedSub: any;
  featuredClickedSub: any;
  favoriteClickedSub: any;
  carritoClickedSub: any;
  inventoryClickedSub: any;

  constructor() { }

  ngOnInit() {
    if (this.showProductStructure) {
      this.productStructures = true;
    }

    this.productStructuresSub = this.productStructureService.productStructures.subscribe((data) => {
      this.productStructures = data;
      if (data) {
        this.showBackIcon = false;
      }
    });

    this.backButtonSub = this.productService.backButtonClicked.subscribe((data) => {
      this.searchText = '';
      this.productService.searchStructures = true;
      this.onSearchTextChanged();
    });

    this.productStructureClickedSub = this.productService.productStructureCLicked.subscribe(() => {
      this.productService.searchStructures = false;
      this.showBackIcon = true;
    });

    this.searchClickedSub = this.productService.onSearchClicked.subscribe(() => {
      this.showBackIcon = true;
    });

    this.featuredClickedSub = this.productService.featuredStructureClicked.subscribe(() => {
      this.showBackIcon = true;
    });

    this.favoriteClickedSub = this.productService.favoriteStructureClicked.subscribe(() => {
      this.showBackIcon = true;
    });

    this.carritoClickedSub = this.productService.carritoButtonClicked.subscribe(() => {
      this.showBackIcon = true;
    });

    this.inventoryClickedSub = this.productService.inventoryTabClicked.subscribe(() => {
      this.showBackIcon = true;
    });

    /*
    this.searchSub = this.productService.onSearchClicked.subscribe((data) => {
      this.productStructures = true;
    });
    */
  }

  ngOnDestroy(): void {
    this.productStructuresSub.unsubscribe();
    //this.searchSub.unsubscribe();
    this.backButtonSub.unsubscribe();
    this.productStructureClickedSub.unsubscribe();
    this.searchClickedSub.unsubscribe();
    this.featuredClickedSub.unsubscribe();
    this.favoriteClickedSub.unsubscribe();
    this.carritoClickedSub.unsubscribe();
    this.inventoryClickedSub.unsubscribe();
  }

  onSearchTextChanged() {
    //Cuidado al inabilitar esta funcion, ya que se sigue usando en ciertos casos
    //Ejemplo: Devoluciones con requeridedNroFactura, para evitar hacer una busqueda compleja por factura.
    this.productService.searchTextChanged.next(this.searchText);
  }

  clearSearch() {
    this.searchText = '';
    this.onSearchTextChanged();
  }

  async onSearchClicked(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.disabledSearchButton || this.searchText.trim().length === 0) {
      return;
    }
    this.productStructureService.nombreProductStructureSeleccionada = '';
    if (this.productService.searchStructures) {
      //reseteamos la seleccion de estructura de producto
      this.productStructureService.idProductStructureList = [];
    }

    const requestId = ++this.searchRequestId;
    this.disabledSearchButton = true;

    await this.message.showLoading();
    try {
      if (this.pedido) {
        await this.productService.getProductsSearchedByCoProductAndNaProductAndIdList(
          this.db.getDatabase(), this.searchText, this.empresaSeleccionada.idEnterprise,
          this.orderServ.monedaSeleccionada.coCurrency,
          this.orderServ.listaSeleccionada.idList, 0);
        if (requestId !== this.searchRequestId) {
          return;
        }
        this.productService.onProductTabSearchClicked();
      } else if (this.devolucion) {
        await this.productService.getProductsSearchedByCoProductAndNaProduct(
          this.db.getDatabase(), this.searchText, this.empresaSeleccionada.idEnterprise,
          this.empresaSeleccionada.coCurrencyDefault, 0);
        if (requestId !== this.searchRequestId) {
          return;
        }
        this.productService.onProductTabSearchClicked();
      } else if (this.devolucion && this.returnLogic.requeridedNroFactura) {
        await this.productService.searchProductsByIdInvoiceAndSearchText(
          this.db.getDatabase(), this.returnLogic.newReturn.idInvoice, this.searchText);
        if (requestId !== this.searchRequestId) {
          return;
        }
        this.returnLogic.validateReturnProductList = this.productService.productList;
        this.returnLogic.productsByInvoice.next(true);
      } else {
        await this.productService.getProductsSearchedByCoProductAndNaProduct(
          this.db.getDatabase(),
          this.searchText,
          this.empresaSeleccionada.idEnterprise,
          this.empresaSeleccionada.coCurrencyDefault, 0);
        if (requestId !== this.searchRequestId) {
          return;
        }
        this.productService.onProductTabSearchClicked();
      }
    } catch (error) {
      console.error('[ProductosTabSearch] Error en búsqueda de productos.', error);
    } finally {
      if (requestId === this.searchRequestId) {
        this.disabledSearchButton = false;
        await this.message.hideLoading();
      }
    }
  }

  onBackClicked() {
    this.showBackIcon = false;
    this.productService.onReturnBackClicked();
  }

}
