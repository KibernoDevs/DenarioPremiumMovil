import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TextService {

  constructor() { }
/*
  convertToSqliteAccentGlob(search: string): string {

    /*Esta funcion convierte un texto de busqueda normal a un patron de busqueda 
     *que ignora acentos y mayusculas, para usarlo con el operador LIKE de sqlite. 
     *Ejemplo: "cafe" se convierte en "*[cC][aáàäâAÁÀÄÂ][fF][eéèëêEÉÈËÊ]*", 
     *lo que permite encontrar "Café", "cafe", "CAFÉ", etc.
     *
  const pattern = search.split('').map(char => {
        // Only wrap alphanumeric/special letters to avoid breaking syntax
        if (/[a-zA-ZñÑáéíóúÁÉÍÓÚ]/.test(char)) {
            return `[${char.toLowerCase()}${char.toUpperCase()}]`;
        }
        return char;
    }).join('');

    return `*${pattern}*`;
  }
  */

  convertToSqliteAccentGlob(search: string): string {
    const accentMap: Record<string, string> = {
        'a': 'aáàäâAÁÀÄÂ',
        'e': 'eéèëêEÉÈËÊ',
        'i': 'iíìïîIÍÌÏÎ',
        'o': 'oóòöôOÓÒÖÔ',
        'u': 'uúùüûUÚÙÜÛ',
        'n': 'nN',      // Strict: only matches n or N
        'ñ': 'ñÑ',      // Strict: only matches ñ or Ñ
        'c': 'cCçÇ'
    };

    const pattern = search.split('').map(char => {
        const lowerChar = char.toLowerCase();
        
        // Check if it exists in our map (either 'n' or 'ñ' now have their own entries)
        if (accentMap[lowerChar]) {
            return `[${accentMap[lowerChar]}]`;
        }
        
        // Default case-insensitivity for other letters
        if (/[a-z]/i.test(char)) {
            return `[${char.toLowerCase()}${char.toUpperCase()}]`;
        }
        
        return char;
    }).join('');

    return `*${pattern}*`;
}

//Check if a string is null, undefined, empty, or only whitespace, or says "null" or "undefined" (case-insensitive)
isNull(str: string | null | undefined): boolean {
  return str == null || /^\s*$/.test(str) || /^(null|undefined)$/i.test(str); 
}

}
