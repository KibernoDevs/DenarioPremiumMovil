import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { BrowserModule, HammerModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy, Platform } from '@ionic/angular';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
//plugins
import { SQLite, SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';
import { SignaturePadModule } from 'angular-signature-pad-v2';
//modulos o componentes
import { LoginComponent } from './login/login.component';
import { PedidosComponent } from './pedidos/pedidos.component';
import { ClientesComponent } from './clientes/clientes.component';
import { ClienteComponent } from './clientes/client-container/client-detail/client-detail.component';
import { ProductosComponent } from './productos/productos.component';
import { SynchronizationComponent } from './synchronization/synchronization.component';
import { AyudaComponent } from './ayuda/ayuda.component';
import { PotentialClientComponent } from './clientes/client-container/client-potential-client/client-potential-client.component';
import { NewPotentialClientComponent } from './clientes/client-container/client-new-potential-client/client-new-potential-client.component';
import { ServicesService } from './services/services.service';
import { ClientesDatabaseServicesService } from './services/clientes/clientes-database-services.service';
import { PotentialClientDatabaseServicesService } from './services/clientes/potentialClient/potential-client-database-services.service';
import { MessageModule } from './message/message.module';
import { MessageService } from 'src/app/services/messageService/message.service';
import { VendedoresComponent } from './vendedores/vendedores.component';
import { VisitasComponent } from './visitas/visitas.component';
import { VisitaComponent } from './visitas/visita/visita.component';
import { ClienteSelectorComponent } from './cliente-selector/cliente-selector.component';
import { AdjuntoComponent } from './adjuntos/adjunto/adjunto.component';
import { ProductosSearchComponent } from './productos/productos-search/productos-search.component';
import { ProductosHeaderComponent } from './productos/productos-header/productos-header.component';
import { ProductStructuresListComponent } from './productos/product-structures-list/product-structures-list.component';
import { ListaVisitaComponent } from './visitas/lista-visita/lista-visita.component';
import { ProductListComponent } from './productos/product-list/product-list.component';
import { ProductDetailComponent } from './productos/product-detail/product-detail.component';
import { ClientesHeaderComponent } from './clientes/client-header/client-header.component';
import { ClientListComponent } from './clientes/client-container/client-list/client-list.component';
import { ClientSearchComponent } from './clientes/client-search/client-search.component';
import { ClientDocumentSaleComponent } from './clientes/client-container/client-document-sale/client-document-sale.component';
import { ClientLocationComponent } from './clientes/client-container/client-location/client-location.component';
import { ClientShareModalComponent } from './clientes/client-container/client-share-modal/client-share-modal.component';
import { ClientLocationService } from './services/clientes/locationClient/client-location.service';
import { PedidosHeaderComponent } from './pedidos/pedidos-header/pedidos-header.component';
import { PedidoComponent } from './pedidos/pedido/pedido.component';
import { PedidosListaComponent } from './pedidos/pedidos-lista/pedidos-lista.component';
import { HomePage } from './home/home.page';

import { CobrosHeaderComponent } from './cobros/cobros-header/cobros-header.component';
import { CobrosComponent } from './cobros/cobros.component';
import { CobrosGeneralComponent } from './cobros/cobros-container/cobro-general/cobro-general.component';
import { CobroPagosComponent } from './cobros/cobros-container/cobro-pagos/cobro-pagos.component';
import { CobroTotalComponent } from './cobros/cobros-container/cobro-total/cobro-total.component';
import { CobrosDocumentComponent } from './cobros/cobros-container/cobro-documents/cobro-documents.component';
import { CobrosContainerComponent } from './cobros/cobros-container/cobros-container.component';
import { CobroComponent } from './cobros/cobros-container/cobro/cobro.component';
import { CobrosListComponent } from './cobros/cobros-container/cobro-list/cobros-list/cobros-list.component';

import { DevolucionesComponent } from './devoluciones/devoluciones.component';
import { DevolucionesHeaderComponent } from './devoluciones/devoluciones-header/devoluciones-header.component';
import { DevolucionesContainerComponent } from './devoluciones/devoluciones-container/devoluciones-container.component';
import { DevolucionesSearchComponent } from './devoluciones/devoluciones-container/devoluciones-search/devoluciones-search.component';
import { DevolucionComponent } from './devoluciones/devoluciones-container/devolucion/devolucion.component';
import { DevolucionGeneralComponent } from './devoluciones/devoluciones-container/devolucion/devolucion-general/devolucion-general.component';
import { ProductosTabComponent } from './productos-tab/productos-tab.component';
import { ProductosTabSearchComponent } from './productos-tab/productos-tab-search/productos-tab-search.component';
import { ProductosTabStructureListComponent } from './productos-tab/productos-tab-structure-list/productos-tab-structure-list.component';

import { DevolucionProductListComponent } from './productos-tab/devolucion-product-list/devolucion-product-list.component';
import { ProductosTabReturnProductListComponent } from './productos-tab/productos-tab-return-product-list/productos-tab-return-product-list.component';
import { ProductosTabOrderProductListComponent } from './productos-tab/productos-tab-order-product-list/productos-tab-order-product-list.component';

import { InventariosComponent } from './inventarios/inventarios.component';
import { InventarioContainerComponent } from './inventarios/inventario-container/inventario-container.component';
import { InventarioHeaderComponent } from './inventarios/inventario-header/inventario-header.component';
import { InventarioComponent } from './inventarios/inventario-container/inventario/inventario.component';
import { InventariosLogicService } from './services/inventarios/inventarios-logic.service';
import { InventarioGeneralComponent } from './inventarios/inventario-container/inventario-general/inventario-general.component';
import { InventarioInventarioComponent } from './inventarios/inventario-container/inventario-inventario/inventario-inventario.component';
import { InventarioActividadesComponent } from './inventarios/inventario-container/inventario-actividades/inventario-actividades.component';
import { InventarioProductListComponent } from './productos-tab/inventario-product-list/inventario-product-list.component';
import { LoginLogicService } from './services/login/login-logic.service';
import { DevolucionListComponent } from './devoluciones/devoluciones-container/devolucion-list/devolucion-list.component';
import { InventarioListComponent } from './inventarios/inventario-container/inventario-list/inventario-list/inventario-list.component';
import { ClienteContainerComponent } from './clientes/client-container/client-container.component';
import { InvoiceSelectorComponent } from './devoluciones/devoluciones-container/devolucion/devolucion-general/invoice-selector/invoice-selector.component';
import { DepositosContainerComponent } from './depositos/depositos-container/depositos-container/depositos-container.component';
import { DepositService } from './services/deposit/deposit.service';
import { DepositosComponent } from './depositos/depositos.component';
import { DepositosHeaderComponent } from './depositos/depositos-header/depositos-header.component';
import { DepositoListComponent } from './depositos/depositos-container/deposito-list/deposito-list.component';
import { DepositoComponent } from './depositos/depositos-container/deposito/deposito.component';
import { DepositoGeneralComponent } from './depositos/depositos-container/deposito-general/deposito-general.component';
import { DepositoCobrosComponent } from './depositos/depositos-container/deposito-cobros/deposito-cobros.component';
import { DepositoTotalComponent } from './depositos/depositos-container/deposito-total/deposito-total.component';
import { GoogleMapsModule } from '@angular/google-maps'
import { HistoryTransaction } from './services/historyTransaction/historyTransaction';
import { FileOpener } from '@awesome-cordova-plugins/file-opener/ngx';
import { VisitaPdfModalComponent } from './visitas/vista-pdfComponent/visitaPdfModal.component';
import { ConversionService } from './services/conversion/conversion.service';
import { installGlobalClipboardEnablers } from 'src/app/utils/clipboard-enablers';
import { CalculatorComponent } from './calculator/calculator.component';
import { InventarioSugeridoPreviewComponent } from './inventarios/inventario-container/inventario-sugerido-preview/inventario-sugerido-preview.component';
//import { HomeSidebarComponent } from './home-sidebar/home-sidebar.component';



@NgModule({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  declarations: [
    AppComponent,
    LoginComponent,
    PedidosComponent,
    PedidosHeaderComponent,
    PedidoComponent,
    PedidosListaComponent,
    CobrosComponent,
    CobrosContainerComponent,
    CobroComponent,
    CobrosHeaderComponent,
    CobrosGeneralComponent,
    CobrosDocumentComponent,
    CobroPagosComponent,
    CobroTotalComponent,
    CobrosListComponent,
    AdjuntoComponent,
    ProductosComponent,
    ProductosSearchComponent,
    ProductosHeaderComponent,
    ProductStructuresListComponent,
    ProductListComponent,
    ProductDetailComponent,
    ProductosTabComponent,
    ProductosTabSearchComponent,
    ProductosTabStructureListComponent,
    ProductosTabReturnProductListComponent,
    ProductosTabOrderProductListComponent,
    SynchronizationComponent,
    AyudaComponent,
    //MessageComponent,
    VendedoresComponent,
    VisitasComponent,
    VisitaComponent,
    ListaVisitaComponent,
    ClienteComponent,
    ClientesComponent,
    ClienteContainerComponent,
    ClienteSelectorComponent,
    ClientesHeaderComponent,
    ClientListComponent,
    ClientSearchComponent,
    PotentialClientComponent,
    NewPotentialClientComponent,
    ClientDocumentSaleComponent,
    ClientLocationComponent,
    ClientShareModalComponent,
    DevolucionesComponent,
    DevolucionesHeaderComponent,
    DevolucionesContainerComponent,
    DevolucionesSearchComponent,
    DevolucionComponent,
    DevolucionGeneralComponent,
    DevolucionProductListComponent,
    DevolucionListComponent,
    InvoiceSelectorComponent,
    InventariosComponent,
    InventarioContainerComponent,
    InventarioHeaderComponent,
    InventarioComponent,
    InventarioSugeridoPreviewComponent,
    InventarioGeneralComponent,
    InventarioInventarioComponent,
    InventarioActividadesComponent,
    InventarioProductListComponent,
    InventarioListComponent,
    DepositosComponent,
    DepositosContainerComponent,
    DepositosHeaderComponent,
    DepositosComponent,
    DepositoComponent,
    DepositoListComponent,
    DepositoGeneralComponent,
    DepositoCobrosComponent,
    DepositoTotalComponent,
    //VisitaPdfModalComponent,
    //HomeSidebarComponent
  ],
  bootstrap: [AppComponent], imports: [
    //HomePageModule,
    IonicModule,
    VisitaPdfModalComponent,
    MessageModule,
    BrowserModule,
  IonicModule.forRoot({ swipeBackEnabled: false }),
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    BrowserAnimationsModule,
    RouterModule,
    SignaturePadModule,
    HammerModule,
    GoogleMapsModule,
    CalculatorComponent],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    SQLite,
    ServicesService,
    ClientesDatabaseServicesService,
    PotentialClientDatabaseServicesService,
    MessageService,
    ClientLocationService,
    InventariosLogicService,
    LoginLogicService,
    HistoryTransaction,
    FileOpener,
    DepositService,
    ConversionService,
  provideHttpClient(withInterceptorsFromDi())]
})
export class AppModule {
  constructor(private platform: Platform) {
    this.platform.ready().then(() => {
      // Desactiva el swipe para volver atrás
      document.querySelector('ion-router-outlet')?.setAttribute('swipeGesture', 'false');
      // Habilita copiar/pegar/seleccionar en todos los inputs de forma global
      try { installGlobalClipboardEnablers(); } catch {}
    });
  }
}
