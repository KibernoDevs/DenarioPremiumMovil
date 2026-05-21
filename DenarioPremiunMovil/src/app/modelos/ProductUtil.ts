import { Inventarios } from "./inventarios";
import { Unit } from "./tables/unit";

export class ProductUtil {
  static productUtilJson(obj: ProductUtil) {
    return new ProductUtil(
      obj['idProduct'],
      obj['coProduct'],
      obj['naProduct'],
      obj['txDescription'],
      obj['points'],
      obj['idList'],
      obj['price'],
      obj['coCurrency'],
      obj['priceOpposite'],
      obj['coCurrencyOpposite'],
      obj['stock'],
      obj['coEnterprise'],
      obj['idEnterprise'],
      obj['images'],
      obj['typeStocks'],
      obj['productUnitList'],
      obj['idProductStructure'],
      obj['nuTax'],
    );
  }


  constructor(
    public idProduct: number,
    public coProduct: string,
    public naProduct: string,
    public txDescription: string,
    public points: number,
    public idList: number,
    public price: number,
    public coCurrency: string,
    public priceOpposite: number,
    public coCurrencyOpposite: string,
    public stock: number,
    public coEnterprise: string,
    public idEnterprise: number,
    public images: string | undefined,
    public typeStocks: Inventarios[] | undefined,
    public productUnitList: Unit[] | undefined,
    public idProductStructure: number,
    public nuTax: number,
    public imgName?: string, // <-- propiedad opcional para reactividad de imagen
    
    public listPrices?: {idList: number, naList: string, nuPrice: number, coUnit: string, naUnit: string, coCurrency: string}[], // <-- [unitByPriceList] propiedad opcional para lista de precios

  
  ) { }
}