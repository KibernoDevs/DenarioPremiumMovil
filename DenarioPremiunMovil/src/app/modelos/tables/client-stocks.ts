import { DELIVERY_STATUS_NEW } from 'src/app/utils/appConstants'
import { ProductUtil } from '../ProductUtil';
import { Inventarios } from '../inventarios';
export class ClientStocks {
    static clientStocksJson(obj: ClientStocks) {
        return new ClientStocks(
            obj["idClientStock"],
            obj["coClientStock"],
            obj["daClientStock"],
            obj["coordenada"],
            obj["idUser"],
            obj["coUser"],
            obj["idAddressClient"],
            obj["coAddressClient"],
            obj["lbClient"],
            obj["idClient"],
            obj["coClient"],
            obj["idEnterprise"],
            obj["coEnterprise"],
            obj["lbEnterprise"],
            obj["stClientStock"],
            obj["isEdit"],
            obj["isSave"],
            obj["txComment"],
            obj["clientStockDetails"],
            obj["productList"],
            obj["hasAttachments"],
            obj["nuAttachments"],
            obj["stDelivery"],
            obj["daysSinceLast"],
            obj["daysUntilNext"]
        );
    }

    constructor(
        public idClientStock: number | null = 0,
        public coClientStock: string = "",
        public daClientStock: string = "",
        public coordenada: string = "",
        public idUser: number = 0,
        public coUser: string = "",
        public idAddressClient: number = 0,
        public coAddressClient: string = "",
        public lbClient: string = "",
        public idClient: number = 0,
        public coClient: string = "",
        public idEnterprise: number = 0,
        public coEnterprise: string = "",
        public lbEnterprise: string = "",
        public stClientStock: number = DELIVERY_STATUS_NEW,
        public isEdit: Boolean = false,
        public isSave: Boolean = true,
        public txComment: string = "",
        public clientStockDetails: ClientStocksDetail[],
        public productList: ProductUtil[],
        public hasAttachments: boolean,
        public nuAttachments: number,
        public stDelivery: number = DELIVERY_STATUS_NEW,
        public daysSinceLast: number = 1,
        public daysUntilNext: number = 1,
    ) { }
}

export class ClientStocksDetail {
    static clientStocksDetailJson(obj: ClientStocksDetail) {
        return new ClientStocksDetail(
            obj["idClientStockDetail"],
            obj["coClientStockDetail"],
            obj["coClientStock"],
            obj["idProduct"],
            obj["coProduct"],
            obj["naProduct"],
            obj["idEnterprise"],
            obj["coEnterprise"],
            obj["isEdit"],
            obj["posicion"],
            obj["isSave"],
            obj["clientStockDetailUnits"],
            obj["typeStocks"],
        );
    }

    constructor(
        public idClientStockDetail: number | null = 0,
        public coClientStockDetail: string = "",
        public coClientStock: string = "",
        public idProduct: number = 0,
        public coProduct: string = "",
        public naProduct: string = "",
        public idEnterprise: number = 0,
        public coEnterprise: string = "",
        public isEdit: Boolean = false,
        public posicion: number = 0,
        public isSave: Boolean = true,
        public clientStockDetailUnits: ClientStocksDetailUnits[],
        public typeStocks: Inventarios[],

    ) { }
}

export class ClientStocksDetailUnits {
    static clientStocksDetaiUnitslJson(obj: ClientStocksDetailUnits) {
        return new ClientStocksDetailUnits(
            obj["idClientStockDetailUnit"],
            obj["coClientStockDetailUnit"],
            obj["coClientStockDetail"],
            obj["coProductUnit"],
            obj["idUnit"],
            obj["coUnit"],
            obj["idProductUnit"],
            obj["naUnit"],
            obj["quStock"],
            obj["quSuggested"],
            obj["coEnterprise"],
            obj["idEnterprise"],
            obj["quUnit"],
            obj["ubicacion"],
            obj["isEdit"],
            obj["nuBatch"],
            obj["daExpiration"],
            obj["posicion"],
            obj["isSave"],
        );
    }

    constructor(
        public idClientStockDetailUnit: number = 0,
        public coClientStockDetailUnit: string = "",
        public coClientStockDetail: string = "",
        public coProductUnit: string = "",
        public idUnit: number = 0,
        public coUnit: string = "",
        public idProductUnit: number = 0,
        public naUnit: string = "",
        public quStock: number = 0,
        public quSuggested: number = 0,
        public coEnterprise: string = "",
        public idEnterprise: number = 0,
        public quUnit: number = 0,
        public ubicacion: string = "",
        public isEdit: Boolean = false,
        public nuBatch: string = "",
        public daExpiration: string = "",
        public posicion: number = 0,
        public isSave: Boolean = true,

    ) { }
}
