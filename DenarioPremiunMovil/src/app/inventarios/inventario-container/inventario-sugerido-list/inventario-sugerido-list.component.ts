import { Component, OnInit, inject } from '@angular/core';
import { InfiniteScrollCustomEvent, ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { ItemListaPedidoSugerido } from 'src/app/inventarios/item-lista-pedido-sugerido';
import { InventarioSugeridoPreviewComponent } from '../inventario-sugerido-preview/inventario-sugerido-preview.component';
import { CurrencyEnterprise } from 'src/app/modelos/tables/currencyEnterprise';
import { ClientStockSuggestedOrder } from 'src/app/modelos/tables/client-stock-suggested-order';
import { List } from 'src/app/modelos/tables/list';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { InventariosLogicService } from 'src/app/services/inventarios/inventarios-logic.service';
import { EnterpriseService } from 'src/app/services/enterprise/enterprise.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { PedidosService } from 'src/app/pedidos/pedidos.service';
import { PedidosDbService } from 'src/app/pedidos/pedidos-db.service';
import { LOCAL_LIST_PAGE_SIZE, paginateFilteredList } from 'src/app/utils/local-paginated-list.util';

@Component({
  selector: 'app-inventario-sugerido-list',
  templateUrl: './inventario-sugerido-list.component.html',
  styleUrls: ['./inventario-sugerido-list.component.scss'],
  standalone: false,
})
export class InventarioSugeridoListComponent implements OnInit {
  public inventariosLogicService = inject(InventariosLogicService);
  private message = inject(MessageService);
  private dbServ = inject(SynchronizationDBService);
  private modalCtrl = inject(ModalController);
  private orderServ = inject(PedidosService);
  private orderDbServ = inject(PedidosDbService);
  private enterpriseServ = inject(EnterpriseService);
  private router = inject(Router);

  listItems: ItemListaPedidoSugerido[] = [];
  searchText = '';
  displayedItems: ItemListaPedidoSugerido[] = [];
  scrollDisable = false;

  private readonly pageSize = LOCAL_LIST_PAGE_SIZE;
  private filteredItems: ItemListaPedidoSugerido[] = [];
  private currentPage = 0;

  ngOnInit(): void {
    void this.loadList();
  }

  private async loadList(): Promise<void> {
    await this.message.showLoading();
    try {
      this.listItems = await this.inventariosLogicService.getAllSuggestedOrderSnapshots(
        this.dbServ.getDatabase(),
      );
      this.resetListPagination();
    } finally {
      this.message.hideLoading();
    }
  }

  private matchesSearch(item: ItemListaPedidoSugerido): boolean {
    if (!this.searchText) {
      return true;
    }
    const coClient = (item.coClient ?? '').toLowerCase();
    const lbClient = (item.lbClient ?? '').toLowerCase();
    const idSuggested = String(item.idClientStockSuggestedOrder ?? 0);
    const coStock = (item.coClientStock ?? '').toLowerCase();
    const coSuggested = (item.coClientStockSuggestedOrder ?? '').toLowerCase();
    return coClient.includes(this.searchText)
      || lbClient.includes(this.searchText)
      || idSuggested.includes(this.searchText)
      || coStock.includes(this.searchText)
      || coSuggested.includes(this.searchText);
  }

  private buildFilteredItems(): ItemListaPedidoSugerido[] {
    return this.listItems.filter(item => this.matchesSearch(item));
  }

  private resetListPagination(): void {
    this.filteredItems = this.buildFilteredItems();
    this.currentPage = 0;
    this.refreshDisplayedItems();
  }

  private refreshDisplayedItems(): void {
    const page = paginateFilteredList(this.filteredItems, this.currentPage, this.pageSize);
    this.displayedItems = page.items;
    this.scrollDisable = page.scrollDisable;
  }

  handleInput(event: Event): void {
    const target = event.target as HTMLIonSearchbarElement;
    this.searchText = (target.value ?? '').toLowerCase();
    this.resetListPagination();
  }

  onIonInfinite(event: InfiniteScrollCustomEvent): void {
    this.currentPage++;
    this.refreshDisplayedItems();
    event.target.complete();
  }

  hasNoVisibleItems(): boolean {
    return this.filteredItems.length === 0;
  }

  getEmptyListLabel(): string {
    return this.inventariosLogicService.inventarioTags.get('INV_PED_SUG_LIST_EMPTY')
      ?? 'No hay pedidos sugeridos guardados';
  }

  getStatusLabel(item: ItemListaPedidoSugerido): string {
    if (this.inventariosLogicService.isSuggestedOrderSent(item)) {
      return this.inventariosLogicService.inventarioTags.get('INV_DEV_SENDED') ?? 'Enviado';
    }
    return this.inventariosLogicService.inventarioTags.get('INV_PED_SUG_PENDING')
      ?? 'Pendiente';
  }

  async openSuggestedOrderPreview(item: ItemListaPedidoSugerido): Promise<void> {
    const snapshot = await this.inventariosLogicService.getSuggestedOrderSnapshotByCo(
      this.dbServ.getDatabase(),
      item.coClientStockSuggestedOrder,
    );
    if (!snapshot) {
      return;
    }

    const previewData = this.inventariosLogicService.mapSnapshotToPreviewData(snapshot);
    const modal = await this.modalCtrl.create({
      component: InventarioSugeridoPreviewComponent,
      cssClass: 'inventario-sugerido-modal',
      componentProps: {
        productsSuggested: previewData.productsSuggested,
        clientStockDetails: previewData.clientStockDetails,
        inventarioTags: this.inventariosLogicService.inventarioTags,
        diasDesdeUltimoInventario: previewData.diasDesdeUltimoInventario,
        diasHastaSiguienteInventario: previewData.diasHastaSiguienteInventario,
        empresaSeleccionada: previewData.empresaSeleccionada,
        monedaLabel: this.orderServ.getTag('PED_MONEDA'),
        blockCreateSuggestedOrder: previewData.blockCreateSuggestedOrder,
        monedaInicial: previewData.monedaInicial,
        suggestedOrderByDispatchAndReturnOverride: previewData.suggestedOrderByDispatchAndReturn,
      },
    });

    await modal.present();
    const dismiss = await modal.onDidDismiss<{ monedaSeleccionada?: CurrencyEnterprise }>();
    if (dismiss.role === 'confirm' && !this.inventariosLogicService.isSuggestedOrderSent(snapshot)) {
      await this.launchPedidoFromSuggestedSnapshot(
        snapshot,
        dismiss.data?.monedaSeleccionada,
      );
    }
  }

  private resolveEnterpriseFromSnapshot(snapshot: ClientStockSuggestedOrder): Enterprise {
    const fromDb = this.enterpriseServ.empresas.find(
      (emp) => emp.idEnterprise === snapshot.idEnterprise,
    );
    if (fromDb) {
      return fromDb;
    }
    return {
      idEnterprise: snapshot.idEnterprise,
      coEnterprise: snapshot.coEnterprise,
    } as Enterprise;
  }

  private async launchPedidoFromSuggestedSnapshot(
    snapshot: ClientStockSuggestedOrder,
    monedaSeleccionadaSugerencia?: CurrencyEnterprise,
  ): Promise<void> {
    if (this.inventariosLogicService.isSuggestedOrderSent(snapshot)) {
      return;
    }

    const db = this.dbServ.getDatabase();
    await this.orderServ.ensureModuleReady(db);
    await this.enterpriseServ.setup(db);
    const empresa = this.resolveEnterpriseFromSnapshot(snapshot);
    this.orderServ.empresaSeleccionada = empresa;
    await this.orderServ.setup();
    const monedaPersistida = await this.inventariosLogicService.persistSuggestedOrderHeaderCurrency(
      db,
      snapshot,
      monedaSeleccionadaSugerencia,
      empresa,
    );
    if (monedaPersistida) {
      monedaSeleccionadaSugerencia = monedaPersistida;
    }

    const preview = this.inventariosLogicService.mapSnapshotToPreviewData(snapshot);
    const cliente = await this.orderServ.getClient(snapshot.idClient);
    const addresses = await this.orderDbServ.getAddressClient(db, snapshot.idClient);
    const direccion = addresses.find(a => a.idAddress === snapshot.idAddressClient) ?? addresses[0];
    if (!direccion) {
      console.log('[launchPedidoFromSuggestedSnapshot] sin dirección');
      return;
    }

    this.orderServ.desdeSugerencia = true;
    this.orderServ.openOrder = true;
    this.orderServ.pedidoModificable = true;

    let list = this.orderServ.listaList.find(l => l.idList === cliente.idList);
    if (!list) {
      const refreshedClient = await this.orderServ.getClient(snapshot.idClient);
      list = this.orderServ.listaList.find(l => l.idList === refreshedClient.idList);
    }
    if (!list) {
      list = {} as List;
    } else {
      this.orderServ.listaSeleccionada = list;
      this.orderServ.listaPriceListFiltrada = this.orderServ.listaPricelist.filter(pl => pl.idList === list?.idList);
    }

    const idProducts = preview.productsSuggested.map(p => p.idProduct);
    const idProductUnits: number[] = [];
    const idUnits: number[] = [];
    for (const product of preview.productsSuggested) {
      for (const unit of product.unitsSuggested) {
        idProductUnits.push(unit.idProductUnit);
        idUnits.push(unit.idUnit);
      }
    }

    this.orderServ.datosPedidoSugerido = {
      empresa,
      cliente,
      direccion,
      productUtils: preview.productsSuggested,
      list: JSON.parse(JSON.stringify(list)),
      enviar: false,
      coClientStock: snapshot.coClientStock,
      idClientStock: snapshot.idClientStock,
      idProducts,
      idUnits,
      idProductUnits,
      ...(monedaSeleccionadaSugerencia
        ? { monedaSeleccionadaSugerencia }
        : {}),
    };

    this.inventariosLogicService.inventarioSuggestedList = false;
    this.inventariosLogicService.containerComp = true;
    this.inventariosLogicService.inventarioComp = false;
    this.inventariosLogicService.inventarioList = false;
    this.inventariosLogicService.showHeaderButtonsFunction(false);
    this.router.navigate(['pedido']);
  }
}
