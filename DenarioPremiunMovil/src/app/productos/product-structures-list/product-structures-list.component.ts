import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { ProductStructureUtil } from 'src/app/modelos/ProductStructureUtil';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { ProductStructure } from 'src/app/modelos/tables/productStructure';
import { TypeProductStructure } from 'src/app/modelos/tables/typeProductStructure';
import { PedidosService } from 'src/app/pedidos/pedidos.service';
import { EnterpriseService } from 'src/app/services/enterprise/enterprise.service';
import { ProductService } from 'src/app/services/products/product.service';
import { ProductStructureService } from 'src/app/services/productStructures/product-structure.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';

@Component({
    selector: 'product-structures-list',
    templateUrl: './product-structures-list.component.html',
    styleUrls: ['./product-structures-list.component.scss'],
    standalone: false
})
export class ProductStructuresListComponent  implements OnInit {

  productStructureService = inject(ProductStructureService);
  enterpriseService = inject(EnterpriseService);
  productService = inject(ProductService);
  dbServ = inject(SynchronizationDBService);
  orderServ = inject(PedidosService);

  listaEmpresa: Enterprise[] = [];
  multiempresa: Boolean = false;
  @Input()
  empresaSeleccionada!: Enterprise;
  @Input()
  tpsSeleccionada!: TypeProductStructure;
  typeProductStructureList: TypeProductStructure[] = [];
  
  psSeleccionada!: ProductStructure;
  productStructureList: ProductStructure[] = [];

  @Output()
  selectedProductStructureChanged: EventEmitter<ProductStructureUtil> = new EventEmitter<ProductStructureUtil>();

  constructor() { }

  ngOnInit() {
    // if(!this.empresaSeleccionada){
      this.enterpriseService.setup(this.dbServ.getDatabase()).then(() => {
        this.listaEmpresa = this.enterpriseService.empresas;
        if(this.productService.empresaSeleccionada == null || this.productService.empresaSeleccionada == undefined){
        this.empresaSeleccionada = this.listaEmpresa[0];
        }else{
          this.empresaSeleccionada = this.productService.empresaSeleccionada;
        }
        //reseteamos busqueda.
        this.productService.searchStructures = true;
        this.productStructureService.idProductStructureList = [];
        this.multiempresa = this.enterpriseService.esMultiempresa();    
        this.getTypeProductStructures();
       }); 
    // }else{
    //   this.listaEmpresa = this.enterpriseService.empresas;      
    //   this.multiempresa = this.enterpriseService.esMultiempresa();    
    //   this.getTypeProductStructures();
    // }
    
  }

  async onEnterpriseChanged(ev: unknown): Promise<void> {
    const value = (ev as { detail?: { value?: Enterprise } }).detail?.value;
    if (value == null) {
      return;
    }
    this.empresaSeleccionada = value;
    this.productService.empresaSeleccionada = this.empresaSeleccionada;
    this.orderServ.empresaSeleccionada = this.empresaSeleccionada;
    await this.orderServ.setup();
    this.productService.syncOrderPresentationFromPedidos(this.orderServ);
    this.tpsSeleccionada = {} as TypeProductStructure;
    this.getTypeProductStructures();
  }

  onTypeProductStructureChanged(ev: any) {
    this.tpsSeleccionada = ev.target.value;    
    this.getProductStructures();
  }

  onProductStructureSelected(productStructure: ProductStructure){
    this.psSeleccionada = productStructure;
    let psu: ProductStructureUtil = new ProductStructureUtil(
      this.empresaSeleccionada,
      this.tpsSeleccionada,
      this.psSeleccionada,      
    )
    this.productStructureService.getLowestsProductStructuresByCoProductStructuresAndIdEnterprise(this.dbServ.getDatabase(),this.psSeleccionada.coProductStructure, this.psSeleccionada.idEnterprise).then(() => {
      this.selectedProductStructureChanged.emit(psu);
    }); 
  }

  getTypeProductStructures(){
    if(!this.tpsSeleccionada || !this.tpsSeleccionada.idTypeProductStructure){
      this.productStructureService.getTypeProductStructuresByIdEnterprise(this.dbServ.getDatabase(),this.empresaSeleccionada.idEnterprise).then(() => {
        this.typeProductStructureList = this.productStructureService.typeProductStructureList;
        this.tpsSeleccionada = this.typeProductStructureList[0];
        this.getProductStructures();
      }); 
    }else{
      this.typeProductStructureList = this.productStructureService.typeProductStructureList;
      this.productStructureList = this.productStructureService.productStructureList;
    }
    
  }

  getProductStructures(){
    this.productStructureService.getProductStructuresByIdTypeProductStructureAndIdEnterprise(this.dbServ.getDatabase(),this.tpsSeleccionada.idTypeProductStructure, this.empresaSeleccionada.idEnterprise).then(() => {
      this.productStructureList = this.productStructureService.productStructureList;
    });
  }

  

}
