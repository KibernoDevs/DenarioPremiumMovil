import { ClientStocks } from "./tables/client-stocks";
import { Collection } from "./tables/collection";
import { Deposit } from "./tables/deposit";
import { DocumentSale } from "./tables/documentSale";
import { Orders } from "./tables/orders";
import { Return } from "./tables/return";
import { UserAddresClients } from "./tables/userAddresClients";
import { Visit } from "./tables/visit";
import { ClientStockSuggestedOrder } from "./tables/client-stock-suggested-order";

export interface Request {
    collection?: Collection;
    document?: DocumentSale; // 'document' ahora es opcional
    potentialClient?: {},
    visit?: Visit,
    order?: Orders,
    deposit?: Deposit,
    collectionIds?: {},
    userAddressClient?: UserAddresClients,
    returns?: Return,
    clientStock?: ClientStocks,
    clientStockSuggestedOrder?: ClientStockSuggestedOrder,

}