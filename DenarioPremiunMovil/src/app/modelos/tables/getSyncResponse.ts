import { AddresClient } from "./addresClient";
import { Client } from "./client";
import { DistributionChannel } from "./distributionChannel";
import { DocumentSaleType } from "./documentSaleType";
import { DocumentSale } from "./documentSale";
import { List } from "./list";
import { PriceList } from "./priceList";
import { PaymentCondition } from "./paymentCondition";
import { Product } from "./product";
import { Unit } from "./unit";
import { ProductUnit } from "./productUnit";
import { Bank } from "./bank";
import { Enterprise } from "./enterprise";
import { IncidenceMotive } from "./incidenceMotive";
import { IncidenceType } from "./incidenceType";
import { ReturnMotive } from "./returnMotive";
import { ReturnType } from "./returnType";
import { BankAccount } from "./bankAccount";
import { Stock } from "./stock";
import { Discount } from "./discount";
import { Visit } from "./visit";
import { IvaList } from "./iva";
import { Warehouse } from "./warehouse";
import { GlobalDiscount } from "./globalDiscount";
import { ClientBankAccount } from "./clientBankAccount";
import { ProductMinMulFav } from "./productMinMul";
import { ProductBonusFav } from "./productBonusFav";
import { UserInformation } from "./userInformation";
import { CurrencyEnterprise } from "./currencyEnterprise";
import { CurrencyRelation } from "./currencyRelation";
import { ConversionType } from "./conversionType";
import { TypeProductStructure } from "./typeProductStructure";
import { ProductStructure } from "./productStructure";
import { ProductStructureCount } from "./productStructureCount";
import { OrderType } from "./orderType";
import { UserProductFav } from "./userProductFav";
import { ClientAvgProduct } from "./clientAvgProduct";
import { IgtfList } from "./igtfList";
import { Invoice } from "./invoice";
import { InvoiceDetail } from "./invoiceDetail";
import { InvoiceDetailUnit } from "./invoiceDetailUnit";
import { ClientChannelOrderType } from "./clientChannelOrderType";
import { OrderTypeProductStructure } from "./orderTypeProductStructure";
import { Statuses } from "./statuses";
import { TransactionStatuses } from "./transactionStatuses";
import { TransactionTypes } from "./transactionTypes";
import { Orders } from "./orders";
import { Collection } from "./collection";
import { Return } from "./return";
import { ClientStocks } from "./client-stocks";
import { Deposit } from "./deposit";

export interface syncResponse {
    updateTime: string;
    serviceVersion: string;

    addressClientTable: AddressClientTable;
    bankTable: BanksTable;
    clientTable: ClientTable;
    distributionChannelTable: DistributionChannelTable;
    documentSaleTable: DocumentSaleTable;
    documentSaleTypeTable: DocumentSaleTypeTable;
    enterpriseTable: EnterpriseTable,
    incidenceMotiveTable: IncidenceMotiveTable,
    incidenceTypeTable: IncidenceTypeTable,
    priceListTable: PriceListTable,
    productTable: ProductTable,
    returnMotiveTable: ReturnMotiveTable,
    returnTypeTable: ReturnTypeTable,
    bankAccountTable: BankAccountTable,
    listTable: ListTable,
    stockTable: StockTable,
    discountTable: DiscountTable,
    paymentConditionTable: PaymentConditionTable,
    productUnitTable: ProductUnitTable,
    visitTable: VisitTable,
    ivaListTable: IvaListTable,
    warehouseTable: WarehouseTable,
    globalDiscountTable: GlobalDiscountTable,
    clientBankAccountTable: ClientBankAccountTable,
    productMinMulFavTable: ProductMinMulFavTable,
    productBonusFavTable: ProductBonusFavTable,
    userInformationTable: UserInformationTable,
    currencyEnterpriseTable: CurrencyEnterpriseTable,
    currencyRelationTable: CurrencyRelationTable,
    conversionTypeTable: ConversionTypeTable,
    typeProductStructureTable: TypeProductStructureTable,
    productStructureTable: ProductStructureTable,
    unitTable: UnitTable,
    productStructureCountTable: ProductStructureCountTable,
    orderTypeTable: OrderTypeTable,
    userProductFavTable: UserProductFavTable,
    clientAvgProductTable: ClientAvgProductTable,
    igtfListTable: IgtfListTable,
    invoiceTable: InvoiceTable,
    invoiceDetailTable: InvoiceDetailTable,
    invoiceDetailUnitTable: InvoiceDetailUnitTable,
    clientChannelOrderTypeTable: ClientChannelOrderTypeTable,
    orderTypeProductStructureTable: OrderTypeProductStructureTable,
    transactionStatusTable: TransactionStatusesTable,
    transactionTypeTable: TransactionTypeTable,
    statusTable: StatusesTable,
    orderTable: OrderTable,
    collectTable: CollectTable,
    returnTable: ReturnTable,
    clientStockTable: ClientStockTable,
    depositTable: DepositTable,
}

interface AddressClientTable {
    syncType: SyncType;
    id: string;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: AddresClient[];
}

interface BanksTable {
    id: string;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: Bank[];
}


enum SyncType {
    I = "I"
}

interface ClientTable {
    syncType: SyncType;
    id: string;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: Client[];
}


interface DistributionChannelTable {
    syncType: SyncType;
    id: string;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: DistributionChannel[];
}

interface DocumentSaleTypeTable {
    syncType: SyncType;
    id: string;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: DocumentSaleType[];
}

interface DocumentSaleTable {
    syncType: SyncType;
    id: string;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: DocumentSale[];
}

interface ListTable {
    syncType: SyncType;
    id: string;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: List[];
}

interface PriceListTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: PriceList[];
}

interface PaymentConditionTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: PaymentCondition[];
}

interface ProductTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: Product[];
}

interface UnitTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: Unit[];
}

interface ProductUnitTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: ProductUnit[];
}
interface EnterpriseTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: Enterprise[];
}
interface IncidenceMotiveTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: IncidenceMotive[];
}
interface IncidenceTypeTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: IncidenceType[];
}
interface ReturnMotiveTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: ReturnMotive[];
}
interface ReturnTypeTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: ReturnType[];
}
interface BankAccountTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: BankAccount[];
}
interface StockTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: Stock[];
}
interface DiscountTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: Discount[];
}
interface VisitTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: Visit[];
}
interface IvaListTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: IvaList[];
}
interface WarehouseTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: Warehouse[];
}

interface GlobalDiscountTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: GlobalDiscount[];
}
interface ClientBankAccountTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: ClientBankAccount[];
}
interface ProductMinMulFavTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: ProductMinMulFav[];
}

interface ProductBonusFavTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: ProductBonusFav[];
}

interface UserInformationTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: UserInformation[];
}
interface CurrencyEnterpriseTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: CurrencyEnterprise[];
}
interface CurrencyRelationTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: CurrencyRelation[];
}
interface ConversionTypeTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: ConversionType[];
}
interface TypeProductStructureTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: TypeProductStructure[];
}
interface ProductStructureTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: ProductStructure[];
}
interface ProductStructureCountTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: ProductStructureCount[];
}
interface OrderTypeTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: OrderType[];
}
interface UserProductFavTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: UserProductFav[];
}
interface ClientAvgProductTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: ClientAvgProduct[];
}
interface IgtfListTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: IgtfList[];
}
interface InvoiceTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: Invoice[];
}
interface InvoiceDetailTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: InvoiceDetail[];
}
interface InvoiceDetailUnitTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: InvoiceDetailUnit[];
}
interface ClientChannelOrderTypeTable {

    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: ClientChannelOrderType[];
}
interface OrderTypeProductStructureTable {

    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: OrderTypeProductStructure[];

}

interface TransactionStatusesTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: TransactionStatuses[];
}

interface TransactionTypeTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: TransactionTypes[];
}

interface StatusesTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: Statuses[];
}

interface OrderTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: Orders[];
}
interface CollectTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: Collection[];
}
interface ReturnTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: Return[];
}
interface ClientStockTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: ClientStocks[];
}
interface DepositTable {
    syncType: SyncType;
    id: number;
    tableName: string;
    updateTime: string;
    page: number;
    numberOfPages: number;
    deletedRowsIds: number[];
    row: Deposit[];
}
