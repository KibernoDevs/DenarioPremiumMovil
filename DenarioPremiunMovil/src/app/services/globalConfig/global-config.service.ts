import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GlobalConfigService {
  public variables = new Map<string, string>([]);
  constructor() {

  }

  setVars(vars: any[]) {
    var str = localStorage.getItem("globalConfiguration");
    if (str === null) {
      //this.variables = new Map<string, string>([]);
      //deberia setearse aca, pero igual se inicia durante la creacion...
    } else {
      this.variables = new Map(JSON.parse(str));
    }
    if (vars.length > 0) {
      for (let index = 0; index < vars.length; index++) {
      this.variables.set(vars[index].clave, vars[index].valor == null ? '' : String(vars[index].valor));
      }
      //guardamos el map como un string en local storage
      localStorage.setItem('globalConfiguration', JSON.stringify([...this.variables]));
    }

    //diagnostico
    console.log("globalConfig map:");
    console.log(this.variables);


  }

  get(clave: string): string {
    let v = this.variables.get(clave);
    if (v == undefined) {
      return '';
    } else {
      return v
    }
  }
}
