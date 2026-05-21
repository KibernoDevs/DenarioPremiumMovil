export class StraightSwap {
 static StraightSwapJson(obj: StraightSwap) {
    return new StraightSwap(
        obj['idSwap'],    
        obj['coSwap'],
        obj['idProduct'],
        obj['coProduct'],
        obj['daCambio'],
        obj['idUnit'],
        obj['coUnit'],
        obj['idProductUnit'],
        obj['coProductUnit'],
        obj['idEnterprise'],
        obj['coEnterprise'],
        obj['quSwap'],
        obj['idClient'],
        obj['idAddressClient'],
        obj['coClient'],
        obj['coAddressClient'],

    );
}

  constructor(
  public idSwap: number,
  public coSwap: string,
  public idProduct: number,
  public coProduct: string,
  public daCambio: string,
  public idUnit: number,
  public coUnit: string,
  public idProductUnit: number,
  public coProductUnit: string,
  public idEnterprise: number,
  public coEnterprise: string,
  public quSwap: number,
  public idClient: number,
  public idAddressClient: number,
  public coClient: string,
  public coAddressClient: string
  
  ) { }
}
