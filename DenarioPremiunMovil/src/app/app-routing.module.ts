import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

import { ClientesComponent } from './clientes/clientes.component';
import { ClienteComponent } from './clientes/client-container/client-detail/client-detail.component';
import { HomePageModule } from './home/home.module';
import { LoginComponent } from './login/login.component';
import { PedidosComponent } from './pedidos/pedidos.component';
import { PedidoComponent } from './pedidos/pedido/pedido.component';
import { PedidosListaComponent } from './pedidos/pedidos-lista/pedidos-lista.component';
import { ProductosComponent } from './productos/productos.component';
import { SynchronizationComponent } from './synchronization/synchronization.component';
import { AyudaComponent } from './ayuda/ayuda.component';
import { PotentialClientComponent } from './clientes/client-container/client-potential-client/client-potential-client.component';
import { NewPotentialClientComponent } from './clientes/client-container/client-new-potential-client/client-new-potential-client.component';
import { VendedoresComponent } from './vendedores/vendedores.component';
import { VisitasComponent } from './visitas/visitas.component'
import { VisitaComponent } from './visitas/visita/visita.component';
import { ListaVisitaComponent } from './visitas/lista-visita/lista-visita.component';
import { ProductListComponent } from './productos/product-list/product-list.component';
import { CobrosComponent } from './cobros/cobros.component';
import { DevolucionesComponent } from './devoluciones/devoluciones.component';
import { InventariosComponent } from './inventarios/inventarios.component';
import { DepositosComponent } from './depositos/depositos.component';
import { promoterRestrictedRouteGuard } from './guards/promoter-hide-finance.guard';


const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./home/home.module').then(m => m.HomePageModule)
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  { path: 'vendedores', component: VendedoresComponent, canActivate: [promoterRestrictedRouteGuard] },
  { path: 'login', component: LoginComponent },
  { path: 'pedidos', component: PedidosComponent },
  { path: 'pedido', component: PedidoComponent },
  { path: 'pedidosLista', component: PedidosListaComponent },
  { path: 'clientes', component: ClientesComponent },
  { path: 'productos', component: ProductosComponent },
  { path: 'productList', component: ProductListComponent },
  { path: 'synchronization', component: SynchronizationComponent },  
  { path: 'synchronization/sincronizar', component: SynchronizationComponent },  
  { path: 'ayuda', component: AyudaComponent },
  { path: 'visitas', component: VisitasComponent },
  { path: 'visita', component: VisitaComponent },
  { path: 'listaVisitas', component: ListaVisitaComponent },
  { path: 'cobros', component: CobrosComponent, canActivate: [promoterRestrictedRouteGuard] },
  { path: 'devoluciones', component: DevolucionesComponent, canActivate: [promoterRestrictedRouteGuard] },
  { path: 'inventarios', component: InventariosComponent },
  { path: 'depositos', component: DepositosComponent, canActivate: [promoterRestrictedRouteGuard] },

];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
