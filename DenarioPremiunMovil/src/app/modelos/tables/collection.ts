import { DocumentSale } from "./documentSale";

export class Collection {
  static collectionJson(obj: Collection) {
    return new Collection(
      obj['idUser'],
      obj['coUser'],
      obj['idCollection'],
      obj['coCollection'],
      obj['coOriginalCollection'],
      obj['daCollection'],
      obj['daRate'],
      obj['naResponsible'],
      obj['idCurrency'],
      obj['idCurrencyConversion'],
      obj['coCurrency'],
      obj['coCurrencyConversion'],
      obj['coType'],
      obj['txComment'],
      obj['lbClient'],
      obj['naClient'],
      obj['idClient'],
      obj['coClient'],
      obj['idEnterprise'],
      obj['coEnterprise'],
      obj['stCollection'],
      obj['isEdit'],
      obj['isEditTotal'],
      obj['isSave'],
      obj['nuValueLocal'],
      //obj['idConversionType'],
      obj['txConversion'],
      obj['nuAmountTotal'],
      obj['nuAmountTotalConversion'],
      obj['nuDifference'],
      obj['nuDifferenceConversion'],
      obj['nuIgtf'],
      obj['nuAmountFinal'],
      obj['nuAmountFinalConversion'],
      obj['nuAmountIgtf'],
      obj['nuAmountIgtfConversion'],
      obj['nuAmountPaid'],
      obj['nuAmountPaidConversion'],
      obj['nuAmountDiscountTotal'],
      obj['nuAmountDiscountTotalConversion'],
      obj['hasIGTF'],
      obj['document'],
      obj['coordenada'],
      obj['nuAttachments'],
      obj['hasAttachments'],
      //obj['daVoucher'],
      obj['collectionDetails'],
      obj['collectionPayments'],
      obj['stDelivery'],
    );
  }

  constructor(
    public idUser: number = 0,
    public coUser: string = "",
    public idCollection: number | null = null,
    public coCollection: string = "",
    public coOriginalCollection: string | null,
    public daCollection: string = "",
    public daRate: string = "",
    public naResponsible: string = "",
    public idCurrency: number = 0,
    public idCurrencyConversion: number = 0,
    public coCurrency: string = "",
    public coCurrencyConversion: string = "",
    public coType: string = "",
    public txComment: string = "",
    public lbClient: string = "",
    public naClient: string = "",
    public idClient: number = 0,
    public coClient: string = "",
    public idEnterprise: number = 0,
    public coEnterprise: string = "",
    public stCollection: number = 0,
    public isEdit: number = 0,
    public isEditTotal: number = 0,
    public isSave: number = 0,
    public nuValueLocal: number = 0,
    //public idConversionType: number = 0,
    public txConversion: string = "",
    public nuAmountTotal: number = 0,
    public nuAmountTotalConversion: number = 0,
    public nuDifference: number = 0,
    public nuDifferenceConversion: number = 0,
    public nuIgtf: number = 0,
    public nuAmountFinal: number = 0,
    public nuAmountFinalConversion: number = 0,
    public nuAmountIgtf: number = 0,
    public nuAmountIgtfConversion: number = 0,
    public nuAmountPaid: number = 0,
    public nuAmountPaidConversion: number = 0,
    public nuAmountDiscountTotal: number = 0,
    public nuAmountDiscountTotalConversion: number = 0,
    public hasIGTF: boolean = false,
    public document: DocumentSale | undefined,
    public coordenada: string = "",
    //public daVoucher: string = "",
    public nuAttachments: number = 0,
    public hasAttachments: boolean = false,
    public collectionDetails: CollectionDetail[],
    public collectionPayments: CollectionPayment[],
    public stDelivery: number = 0,
  ) { }
}

export class CollectionDetail {
  static collectionDetailJson(obj: CollectionDetail) {
    return new CollectionDetail(
      obj['idCollectionDetail'],
      obj['coCollection'],
      obj['coDocument'],
      obj['idDocument'],
      obj['inPaymentPartial'],
      obj['nuVoucherRetention'],
      obj['nuAmountRetention'], //iva
      obj['nuAmountRetention2'], //islr
      obj['nuAmountRetentionConversion'], //iva
      obj['nuAmountRetention2Conversion'], //islr
      obj['nuAmountRetentionIvaConversion'], //iva
      obj['nuAmountRetentionIslrConversion'], //islr
      obj['nuAmountPaid'],
      obj['nuAmountPaidConversion'],
      obj['nuAmountDiscount'],
      obj['nuAmountDiscountConversion'],
      obj['nuAmountDoc'],
      obj['nuAmountDocConversion'],
      obj['daDocument'],
      obj['nuBalanceDoc'],
      obj['nuBalanceDocConversion'],
      obj['nuBalanceDocOriginal'],
      obj['nuBalanceDocOriginalConversion'],
      obj['coOriginal'],
      obj['coTypeDoc'],
      obj['nuValueLocal'],
      obj['nuAmountIgtf'],
      obj['nuAmountIgtfConversion'],
      obj['st'],
      obj['isSave'],
      obj['daVoucher'],
      obj['hasDiscount'],
      obj['discountComment'],
      obj['nuAmountCollectDiscount'],
      obj['nuCollectDiscount'],
      obj['missingRetention'],
      obj['nuAmountCollectDiscountConversion'],
      obj['collectionDetailDiscounts'],
      obj['collectionDetailRetentions'],
    );
  }

  constructor(
    public idCollectionDetail?: number | null,
    public coCollection: string = "",
    public coDocument: string = "",
    public idDocument: number = 0,
    public inPaymentPartial: boolean = false,
    public nuVoucherRetention: string = "",
    public nuAmountRetention: number = 0, //iva
    public nuAmountRetention2: number = 0, //islr
    public nuAmountRetentionConversion: number = 0, //iva
    public nuAmountRetention2Conversion: number = 0, //islr
    public nuAmountRetentionIvaConversion: number = 0, //iva
    public nuAmountRetentionIslrConversion: number = 0, //islr
    public nuAmountPaid: number = 0,
    public nuAmountPaidConversion: number = 0,
    public nuAmountDiscount: number = 0,
    public nuAmountDiscountConversion: number = 0,
    public nuAmountDoc: number = 0,
    public nuAmountDocConversion: number = 0,
    public daDocument: string = "",
    public nuBalanceDoc: number = 0,
    public nuBalanceDocConversion: number = 0,
    public nuBalanceDocOriginal: number = 0,
    public nuBalanceDocOriginalConversion: number = 0,
    public coOriginal: string = "",
    public coTypeDoc: string = "",
    public nuValueLocal: number = 0,
    public nuAmountIgtf: number = 0,
    public nuAmountIgtfConversion: number = 0,
    public st: number = 0,
    public isSave: boolean = true,
    public daVoucher: string | null = "",
    public hasDiscount: boolean = false,
    public discountComment: string | null = "",
    public nuAmountCollectDiscount: number = 0,
    public nuCollectDiscount: number = 0,
    public missingRetention: boolean = false,
    public nuAmountCollectDiscountConversion: number = 0,
    public collectionDetailDiscounts?: CollectionDetailDiscounts[],
    public collectionDetailRetentions?: CollectionDetailRetentions[],
  ) { }
}

export class CollectionPayment {
  static collectionPaymentlJson(obj: CollectionPayment) {
    return new CollectionPayment(
      obj['idCollectionPayment'],
      obj['idCollectionDetail'],
      obj['coCollection'],
      obj['coPaymentMethod'],
      obj['idBank'],
      obj['nuPaymentDoc'],
      obj['naBank'],
      obj['coClientBankAccount'],
      obj['nuClientBankAccount'],
      obj['daValue'],
      obj['daCollectionPayment'],
      obj['nuCollectionPayment'],
      obj['newNuClientBankAccount'],
      obj['nuAmountPartial'],
      obj['nuAmountPartialConversion'],
      obj['coType'],
      obj['st'],
      obj['isSave'],
      obj['isAnticipoPrepaid'],
      obj['idDifferenceCode'],
      obj['coDifferenceCode'],
      obj['nuBankAccount'],
      obj['idTypeDocument'],
      obj['nuDocument'],
      obj['idCodePhoneNumber'],
      obj['nuPhoneNumber']

    );
  }

  constructor(
    public idCollectionPayment?: number | null,
    public idCollectionDetail: number | null = null,
    public coCollection: string = "",
    public coPaymentMethod: string = "", //cheque, efectivo, transferencia, deposito, otros
    public idBank: number = 0,
    public nuPaymentDoc: string = "",
    public naBank: string = "",
    public coClientBankAccount: string = "",
    public nuClientBankAccount: string = "",
    public daValue: string | null = "", //CAMBIAR A FECHA
    public daCollectionPayment: string | null = "",//cambiar a fecha
    public nuCollectionPayment: string = "",
    public newNuClientBankAccount: string = "",
    public nuAmountPartial: number = 0,
    public nuAmountPartialConversion: number = 0,
    public coType: string = "",
    public st: number = 0, // si es 0 se inserta, si es 1 se actualiza, si es 2 se elimina
    public isSave: boolean = true, // true se guarda el pedido, false se actualiza
    public isAnticipoPrepaid: boolean = false, // true se guarda el pedido, false se actualiza
    public idDifferenceCode: number | null = 0,
    public coDifferenceCode: string | null = "",
    public nuBankAccount: string | null = "",
    public idTypeDocument: number | null = null,
    public nuDocument: string | null = "",
    public idCodePhoneNumber: number | null = null,
    public nuPhoneNumber: string | null = ""



  ) { }
}

export class CollectionDetailDiscounts {
  static CollectionDetailDiscountsJson(obj: CollectionDetailDiscounts) {
    return new CollectionDetailDiscounts(
      obj['idCollectionDetailDiscount'],
      obj['idCollectionDetail'],
      obj['idCollectDiscount'],
      obj['nuCollectDiscountOther'],
      obj['naCollectDiscountOther'],
      obj['coCollection'],
      obj['coDocument'],
      obj['nuAmountCollectDiscountOther'],
      obj['nuAmountCollectDiscountOtherConversion'],
      obj['posicion'],
    );
  }

  constructor(
    public idCollectionDetailDiscount?: number | null,
    public idCollectionDetail: number = 0,
    public idCollectDiscount: number = 0,
    public nuCollectDiscountOther: number | null = null,
    public naCollectDiscountOther: string | null = "",
    public coCollection: string = "",
    public coDocument: string = "",
    public nuAmountCollectDiscountOther: number = 0,
    public nuAmountCollectDiscountOtherConversion: number = 0,
    public posicion: number = 0,

  ) { }
}

export class CollectionDetailRetentions {
  static CollectionDetailRetentionsJson(obj: CollectionDetailRetentions) {
    return new CollectionDetailRetentions(
      obj['idCollectionDetailRetention'],
      obj['idCollectionDetail'],
      obj['coCollection'],
      obj['coDocument'],
      obj['idCollectRetention'],
      obj['coCollectRetention'],
      obj['nuAmountRetention'],
      obj['nuAmountRetentionConversion'],
      obj['posicion'],
    );
  }

  constructor(
    public idCollectionDetailRetention?: number | null,
    public idCollectionDetail: number = 0,
    public coCollection: string = "",
    public coDocument?: string | null,
    public idCollectRetention: number = 0,
    public coCollectRetention: string = "",
    public nuAmountRetention: number = 0,
    public nuAmountRetentionConversion: number = 0,
    public posicion: number = 0,

  ) { }
}
