import { NumberSymbol } from "@angular/common"

export interface Response {
    errorCode: string,
    errorMessage: string,
    idClient: number,
    idVisit: number,
    orderId: number,
    serviceVersion: string,
    coTransaction: string,
    userAddressClientId: number,
    returnId: number,
    clientStockId: number,
    clientStockSuggestedOrderId?: number,
    collectionId: number,
    depositId: number,
    type: string
}