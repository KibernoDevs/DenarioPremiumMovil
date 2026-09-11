# Cómo compilar una APK para QA

**Para pedírselo a Cursor (o a quien compile), basta con decir:**

> Compila APK siguiendo `qa-piloto-automatizacion/COMPILAR-APK.md`. Cliente: **{slug}**.
> Código: **main** *(o: la rama `{nombre}`)*.

---

## El procedimiento

**1 · Usar SIEMPRE esta carpeta.** No otra copia del repositorio:

```
C:\Users\Personal\OneDrive\Documentos\kiberno\DenarioPremium
rama de trabajo: feature/qa-guiones-regresion
```

**2 · Poner el código que toca**, según el caso:

**Caso A — se compila `main`** (lo habitual):

```bash
git fetch origin
git merge origin/main
```

Sin `git push`. Sin `git checkout main`. Sin rebase. Si hay conflictos, resolverlos
**solo** en archivos de producto (`src/`, `android/`, `package.json`); en
`qa-piloto-automatizacion/` manda siempre la versión de QA.

**Caso B — se compila una rama especial** (un REQ que aún no está en main):

```bash
git fetch origin {nombre-de-la-rama}
git checkout {nombre-de-la-rama}      # solo para compilar
```

🔴 **NO mergear la rama especial dentro de `feature/qa-guiones-regresion`.** Esa rama
lleva código que todavía no está aprobado; si se mezcla con el trabajo de QA, después
no hay forma limpia de separarlo. Se compila desde la rama y se vuelve:

```bash
git checkout feature/qa-guiones-regresion
```

**3 · Compilar desde esa misma carpeta.**

**4 · Reportar tres datos al terminar:**

```bash
pwd                       # la ruta usada
git log --oneline -1      # el commit exacto que se compiló
git branch --show-current # de qué rama salió
```

Y en el caso A, además: `git rev-list --count HEAD..origin/main` **tiene que dar 0**.

---

## Qué hace QA con esos tres datos

Los necesita para leer el código correcto al verificar un fix:

| Se compiló | QA lee el código con |
|---|---|
| `main` | `git show origin/main:<ruta>` |
| rama `{nombre}` | `git show origin/{nombre}:<ruta>` |

**Nunca leer el working tree** para verificar comportamiento: puede estar en otra rama
o ir atrasado. La referencia es siempre la rama de la que salió la APK, y por eso hay
que decir cuál fue.

---

## Por qué existe este archivo

**10/09/2026 — una hora perdida.** Se validó el umbral del anticipo automático contra
una APK compilada desde **otra copia** del repositorio. El teléfono corría `main`; el
repo que QA consultaba iba **tres días atrasado**. Resultado: se concluyó «a la APK le
falta el fix» cuando en realidad el fix se había revertido a propósito el 09/09
(commit `72177ec6`), y esa versión revertida era la que llevaba el teléfono.

Los dos estaban bien. Estaban en momentos distintos, y nadie lo sabía.

⇒ **La APK y el repositorio que QA consulta tienen que ser el mismo código.** Ese es
todo el objetivo de este procedimiento.

## Y del lado de QA

Antes de medir un fix, comprobar que la build lo trae: leer la función del **bundle
vivo** del equipo por CDP y contrastarla con `origin/main` — **no** con el working
tree, que puede ir atrasado. Si no coinciden, parar y preguntar de dónde salió la APK
antes de medir nada.
