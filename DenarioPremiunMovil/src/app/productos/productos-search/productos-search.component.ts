import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ProductService } from 'src/app/services/products/product.service';

@Component({
    selector: 'productos-search',
    templateUrl: './productos-search.component.html',
    styleUrls: ['./productos-search.component.scss'],
    standalone: false
})
export class ProductosSearchComponent{
  @Input()
  searchTags = new Map<string, string>([]);
  router = inject(Router);


  @Input()
  mostrarVolver: Boolean = false;
  @Input()
  searchText: string = '';
  @Input()
  showSearch!: Boolean;
  @Input()
  productStructureSelected!: Boolean;
  @Input()
  allowProductReports = false;

  @Output()
  viewStructuresClicked: EventEmitter<Boolean> = new EventEmitter<Boolean>();
  @Output()
  searchTextChanged: EventEmitter<string> = new EventEmitter<string>();
  @Output()
  reportsClicked: EventEmitter<void> = new EventEmitter<void>();

  productoService = inject(ProductService);
  messageService = inject(MessageService);

  ngOnInit() {

  }

  async onSearchClicked(event?: Event){
    event?.preventDefault();

    const normalizedSearch = (this.searchText ?? '').toString().trim();
    this.searchText = normalizedSearch;

    if (!this.searchText) {
      this.searchTextChanged.emit('');
      this.productoService.onProductSearch('');
      await this.messageService.hideLoading();
      return;
    }

    await this.messageService.showLoading();
    this.searchTextChanged.emit(this.searchText);
    this.productoService.onProductSearch(this.searchText);
  }

  onReturnStructures(){
    this.viewStructuresClicked.emit(true);
  }

  onSearchTextChanged(){
    this.searchTextChanged.emit(this.searchText);
    this.productoService.onProductSearch(this.searchText);
  }

  clearSearch(){
    this.searchText = '';
    this.onSearchTextChanged();
  }

  onReportsClicked(): void {
    this.reportsClicked.emit();
  }

}
