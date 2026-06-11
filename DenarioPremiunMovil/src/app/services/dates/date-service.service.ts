import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DateServiceService {

  dateFormatComplete = new Intl.DateTimeFormat("es-VE", {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });

  public dateFormatOptionsShort: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }

  dateFormatShort = new Intl.DateTimeFormat("es-VE", this.dateFormatOptionsShort);



  constructor() { }

  now() {
    var r = new Date();

    return r.toLocaleString();
  }

  // ...existing code...
  dateFrom(input: string) {
    // Si no hay input, devuelve ahora
    if (!input) {
      return new Date();
    }

    // Detectamos formatos sin zona horaria explícita:
    // - "YYYY-MM-DD"
    // - "YYYY-MM-DD HH:mm"
    // - "YYYY-MM-DD HH:mm:ss"
    // - "YYYY-MM-DDTHH:mm"  (sin zona)
    // Si hay zona ('Z' o +hh:mm o -hh:mm) dejamos que Date.parse maneje la zona.
    const localDateRegex = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?(?:\.\d+)?$/;

    const m = input.match(localDateRegex);
    if (m) {
      const year = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      const day = parseInt(m[3], 10);
      const hour = m[4] ? parseInt(m[4], 10) : 0;
      const minute = m[5] ? parseInt(m[5], 10) : 0;
      const second = m[6] ? parseInt(m[6], 10) : 0;
      // Construimos en HORARIO LOCAL para evitar el desfase de zona (off-by-one día)
      return new Date(year, month - 1, day, hour, minute, second);
    }

    // Fallback: si el string contiene zona horaria o no coincide con el regex,
    // usamos Date.parse para respetar offsets y formatos complejos.
    const ts = Date.parse(input);
    if (!isNaN(ts)) {
      return new Date(ts);
    }

    // Último recurso: constructor directo (puede producir Invalid Date si es inválido)
    return new Date(input);
  }
  // ...existing code...

  hoyISO() {
    //devuelve un string ISO 8601 que representa la fecha de hoy, a la medianoche
    //para usar con componentes ion-datetime
    var r = new Date();
    r.setHours(0, 0, 0, 0);
    return r.toISOString().substring(0, 19);//.replace("T"," ");
  }
  toISOString(input: string) {
    // tranforma una fecha en un string ISO 8601
    //para usar con componentes ion-datetime
    var r = this.dateFrom(input);
    return r.toISOString().substring(0, 19);
  }

  futureDaysISO(days: number) {
    //devuelve un string ISO 8601 que representa la fecha de hoy + days, a la medianoche
    //para usar con componentes ion-datetime
    var r = new Date();
    r.setHours(0, 0, 0, 0);
    r.setDate(r.getDate() + days);
    return r.toISOString().substring(0, 19);//.replace("T"," ");
  }

  pastDaysISO(days: number) {
    //devuelve un string ISO 8601 que representa la fecha de hoy - days, a la medianoche
    //para usar con componentes ion-datetime
    var r = new Date();
    r.setHours(0, 0, 0, 0);
    r.setDate(r.getDate() - days);
    return r.toISOString().substring(0, 19);//.replace("T"," ");
  }

  onlyDateHoyISO() {
    //devuelve un string ISO 8601 que representa la fecha de hoy, a la medianoche
    //esta funcion remueve la hora
    var r = new Date();
    //r.setHours(0, 0, 0, 0); //esto jode cuando se usa para comparar fechas en españa. yo tampoco se porqué.

    // Usamos los componentes locales (getFullYear, getMonth, getDate) en lugar de toISOString
    // para evitar que la conversión a UTC cambie el día si es tarde en la noche.
    const year = r.getFullYear();
    const month = (r.getMonth() + 1).toString().padStart(2, '0');
    const day = r.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  hoyISOFullTime() {
    //devuelve un string ISO 8601 que representa la fecha de hoy, hora actual
    //para usar en fechas de bd (da_visit, da_order, etc)
    var r = new Date();
    var s = r.getFullYear() + "-" +
      (r.getMonth() + 1).toString().padStart(2, '0') + "-" +
      r.getDate().toString().padStart(2, '0') + " " +
      r.getHours().toString().padStart(2, '0') + ":" +
      r.getMinutes().toString().padStart(2, '0') + ":" +
      r.getSeconds().toString().padStart(2, '0');
    return s;
    //return r.toISOString().substring(0,19).replace("T"," "); << esto da una hora UTC, o sea, 4 horas en el futuro (en vzla)

    //NOTA: con los cambios que se han hecho, ya no es ISO,
    //pero si le cambio el nombre a estas alturas rompo todo el proyecto,
    // si lo vuelvo ISO, el webService no lo acepta.
  }




  toMidnight(input: string) {
    //devuelve la misma fecha, pero a la media noche
    var r = this.dateFrom(input);
    r.setHours(0, 0, 0, 0);
    return r.toISOString().substring(0, 19);
  }

  formatComplete(input: string) {
    var r = this.dateFrom(input);

    return this.dateFormatComplete.format(r);
  }

  formatShort(input: string) {
    if (!input) {
      return '';
    }

    const r = this.dateFrom(input);
    if (isNaN(r.getTime())) {
      return '';
    }

    return this.dateFormatShort.format(r);
  }

  /**
   * Normaliza dateRate del cobro a formato BD: YYYY-MM-DD HH:mm:ss
   */
  normalizeDateRateToDbDateTime(dateRate: string | null | undefined): string {
    const raw = (dateRate ?? '').toString().trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return `${raw} 00:00:00`;
    }
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(raw)) {
      return raw;
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) {
      return raw.replace('T', ' ');
    }
    if (raw) {
      const parsed = this.dateFrom(raw);
      if (!isNaN(parsed.getTime())) {
        return this.formatDbDateTime(parsed);
      }
    }
    return this.toDbDateTime(this.hoyISO());
  }

  /**
   * Convierte ISO (T), fecha simple o datetime local a YYYY-MM-DD HH:mm:ss
   */
  toDbDateTime(input: string | null | undefined): string {
    const trimmed = (input ?? '').toString().trim();
    if (!trimmed) {
      return this.normalizeDateRateToDbDateTime(this.onlyDateHoyISO());
    }
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return `${trimmed} 00:00:00`;
    }
    if (trimmed.includes('T')) {
      const [datePart, timePart = '00:00:00'] = trimmed.split('T');
      return `${datePart} ${timePart.substring(0, 8)}`;
    }
    const parsed = this.dateFrom(trimmed);
    if (!isNaN(parsed.getTime())) {
      return this.formatDbDateTime(parsed);
    }
    return this.normalizeDateRateToDbDateTime(this.onlyDateHoyISO());
  }

  private formatDbDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    const second = date.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  generateCO(i: number) {
    //genera un CO (coOrder, coVisit, etc)
    //el i se usa para evitar conflictos si se generan muchos en el mismo instante
    //resultado es algo como 123456789.i
    //recomiendo usar el i del for(...){} si estas generando muchos documentos. Si no, un 0 sirve.
    var co = new Date().getTime().toString() + "." + i.toString();
    //console.log("generateCO: "+co);
    return co;
  }

  compareDates(min: string, date: string) {
    //compara dos fechas, devuelve true si la fecha es mayor o igual a la minima
    //min y date son strings ISO 8601 (yyyy-mm-dd hh:mm:ss)
    //console.log("compareDates: "+min+" > "+date+" = "+(min>date));
    return min.substring(0, 10) <= date.substring(0, 10);
  }

  daysSince(input: string) {
    //devuelve cuantos dias han pasado desde la fecha recibida hasta hoy
    //si la fecha es futura, devuelve un numero negativo
    var d = this.dateFrom(input);
    var today = new Date();
    var msPerDay = 24 * 60 * 60 * 1000;

    //Comparamos solo la parte de fecha para evitar errores por horas/minutos y cambios de DST
    var fromUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    var toUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

    return Math.floor((toUtc - fromUtc) / msPerDay);
  }




}
