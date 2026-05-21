import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { ProductStructureUtil } from 'src/app/modelos/ProductStructureUtil';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { ProductStructure } from 'src/app/modelos/tables/productStructure';
import { TypeProductStructure } from 'src/app/modelos/tables/typeProductStructure';
import { PedidosService } from 'src/app/pedidos/pedidos.service';
import { GlobalConfigService } from 'src/app/services/globalConfig/global-config.service';
import { ProductStructureService } from 'src/app/services/productStructures/product-structure.service';
import { ProductService } from 'src/app/services/products/product.service';
import { ReturnLogicService } from 'src/app/services/returns/return-logic.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { InventariosLogicService } from 'src/app/services/inventarios/inventarios-logic.service';

@Component({
  selector: 'productos-tab-structure-list',
  templateUrl: './productos-tab-structure-list.component.html',
  styleUrls: ['./productos-tab-structure-list.component.scss'],
  standalone: false
})
export class ProductosTabStructureListComponent implements OnInit, OnDestroy {
  public cdr: ChangeDetectorRef;

  productStructureService = inject(ProductStructureService);
  productService = inject(ProductService);
  returnLogic = inject(ReturnLogicService);
  orderServ = inject(PedidosService);
  inventariosLogicService = inject(InventariosLogicService);
  dbServ = inject(SynchronizationDBService);
  public config = inject(GlobalConfigService);

  @Input()
  empresaSeleccionada!: Enterprise;
  @Input()
  showProductStructure: Boolean = false;
  @Input()
  productsTabTags = new Map<string, string>([]);
  @Input()
  devolucion: Boolean = false;
  @Input()
  pedido: Boolean = false;
  @Input()
  inventario: Boolean = false;

  tpsSeleccionada!: TypeProductStructure;
  typeProductStructureList: TypeProductStructure[] = [];
  psSeleccionada!: ProductStructure;
  featuredButtonLabel = '';
  featuredButtonCount = 0;
  favoriteButtonLabel = '';
  favoriteButtonCount = 0;
  //config options
  public featuredProducts: Boolean = false;
  public nameProductLine = '';

  productStructureList: ProductStructure[] = [];
  productStructures: Boolean = false;
  buttonSize = 6;
  sub: any;
  searchSub: any;
  validateReturnSub: any;
  returnBackSub: any;

  constructor() {
    this.cdr = inject(ChangeDetectorRef);
  }


  ngOnInit() {
    //config options
    this.featuredProducts = this.config.get("featuredProducts").toLowerCase() === 'true';
    this.nameProductLine = this.config.get("nameProductLine");

    if (this.showProductStructure) {
      this.productStructures = true;
      this.productService.searchStructures = true;
      this.getTypeProductStructures();
    }
    this.sub = this.productStructureService.productStructures.subscribe((data) => {
      this.productStructures = data;
      if (this.productStructures) {
        this.getTypeProductStructures();
      }
    });

    this.searchSub = this.productService.onSearchClicked.subscribe((data) => {
      this.productStructures = false;
      //this.productService.searchStructures = false;
    });

    this.validateReturnSub = this.returnLogic.productsByInvoice.subscribe((data) => {
      this.productStructures = false;
      this.productService.searchStructures = false;
    });

    this.returnBackSub = this.productService.returnBackClicked.subscribe(() => {
      if (this.devolucion) {
        this.onReturnProductTab();
      }
    });



    if (this.pedido) {
      //hacemos espacio para el boton de carrito
      this.buttonSize = 5;
    }


  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.searchSub.unsubscribe();
    this.validateReturnSub.unsubscribe();
    this.returnBackSub.unsubscribe();
  }

  getTypeProductStructures() {
    this.productStructureService.getTypeProductStructuresByIdEnterprise(this.dbServ.getDatabase(), this.empresaSeleccionada.idEnterprise).then(() => {
      this.typeProductStructureList = this.productStructureService.typeProductStructureList;
      //this.tpsSeleccionada = this.typeProductStructureList[0];
      if (!this.tpsSeleccionada && this.typeProductStructureList.length > 0) {
        this.tpsSeleccionada = this.typeProductStructureList[0];
      }
      this.getProductStructures();
    });
  }

  getProductStructures() {
    this.productStructureService.getProductStructuresByIdTypeProductStructureAndIdEnterprise(this.dbServ.getDatabase(), this.tpsSeleccionada.idTypeProductStructure, this.empresaSeleccionada.idEnterprise).then(() => {
      this.productStructureList = [];

      if (this.pedido && this.orderServ.userCanSelectChannel) {
        // [userCanSelectChannel] hay que filtrar por orderType
        let structs = this.orderServ.orderTypeProductStructure.filter((s) => s.idOrderType === this.orderServ.tipoOrden.idOrderType)
        this.productStructureList = this.productStructureService.productStructureList.filter((ps) => structs.find((s) => s.coProductStructure === ps.coProductStructure));
        /* quizas innecesario
        //filtramos los productStructures que corresponden al orderType
        let idProductStructureList: number[] = [];
        structs.forEach((ps) => idProductStructureList.push(ps.idProductStructure));
        const set = new Set(idProductStructureList);
        this.productStructureService.idProductStructureList = this.productStructureService.idProductStructureList.filter(id => set.has(id));
        */
      } else {
        //caso regular
        this.productStructureList = this.productStructureService.productStructureList;
      }
      this.productService.getFavoriteProductCount(this.dbServ.getDatabase(), this.empresaSeleccionada.idEnterprise).then(count => {
        let favname = this.orderServ.tags.get("PED_FAVORITO");
        this.favoriteButtonLabel = (favname != undefined) ? favname : 'Favoritos';
        //this.favoriteButtonLabel += ' (' + count + ')';
        this.favoriteButtonCount = count;
      })


      if (this.featuredProducts) {
        this.productService.getFeaturedProductCount(this.dbServ.getDatabase(), this.empresaSeleccionada.idEnterprise).then(count => {
          this.featuredButtonLabel = this.nameProductLine// + ' (' + count + ')';
          this.featuredButtonCount = count;
        })

      }


    });
  }

  tpsCompare(a: TypeProductStructure, b: TypeProductStructure) {
    return a && b ? a.idTypeProductStructure === b.idTypeProductStructure : a === b;
  }

  onTypeProductStructureChanged(ev: any) {
    this.tpsSeleccionada = ev.target.value;
    this.getProductStructures();
  }

  onProductStructureSelected(productStructure: ProductStructure) {
    this.psSeleccionada = productStructure;
    this.productStructureService.nombreProductStructureSeleccionada = productStructure.naProductStructure;
    this.productService.searchStructures = false;

    let psu: ProductStructureUtil = new ProductStructureUtil(
      this.empresaSeleccionada,
      this.tpsSeleccionada,
      this.psSeleccionada,
    )
    this.productStructureService.getLowestsProductStructuresByCoProductStructuresAndIdEnterprise(this.dbServ.getDatabase(), this.psSeleccionada.coProductStructure, this.psSeleccionada.idEnterprise).then(() => {
      this.productStructures = false;
      this.productService.onProductStructureCLicked();
      this.productService.searchStructures = false;
      this.cdr.detectChanges();
    });
    this.cdr.detectChanges();

  }

  onFeaturedProductSelected() {
    this.productStructures = false;
    this.productStructureService.nombreProductStructureSeleccionada = this.featuredButtonLabel.split('(')[0];
    this.productStructureService.idProductStructureList = [];
    this.productService.onFeaturedStructureClicked();
  }

  onFavoriteProductSelected() {
    this.productStructures = false;
    this.productStructureService.nombreProductStructureSeleccionada = this.favoriteButtonLabel.split('(')[0];
    this.productStructureService.idProductStructureList = [];
    this.productService.onFavoriteStructureClicked();
  }

  onCartSelected() {
    this.productStructures = false;
    this.productService.onCarritoButtonClicked();
  }

  onInventorySelected() {
    this.productStructures = false;
    this.productStructureService.nombreProductStructureSeleccionada = 'Inventario';
    this.productService.searchStructures = false;
    this.productService.onInventoryTabClicked();
  }

  getInventoryCount(): number {
    return this.inventariosLogicService.newClientStock?.clientStockDetails?.length || 0;
  }

  hasItemsLimit(): boolean {
    const t = this.orderServ.tipoOrden;
    if (!t) {
      return false;
    }
    const limitOn =
      t.itemsLimit === true ||
      (t.itemsLimit as unknown) === 1 ||
      (t.itemsLimit as unknown) === '1';
    return limitOn && t.quItems > 0;
  }

  cartBadgeText(): string {
    const n = this.orderServ.carrito.length;
    if (this.hasItemsLimit()) {
      return `${n}/${this.orderServ.tipoOrden.quItems}`;
    }
    return String(n);
  }

  onReturnProductTab() {
    this.productStructures = false;
    this.productStructureService.onReturnProductTabClicked();
  }

}
