# El Trébol FC — app del equipo (versión de un solo archivo)

Esta es una reconstrucción de la app en un formato mucho más simple de
mantener: **toda la aplicación vive en un solo archivo, `index.html`**, que
habla directo con una base de datos gratuita (Firebase Firestore) desde el
navegador. Ya no hay Next.js, ni Prisma, ni migraciones SQL, ni build de por
medio — de acá en más, actualizar la app casi siempre va a significar
"reemplazar `index.html`", nada más.

Sigue teniendo exactamente las mismas funciones que ya conocías: elegir tu
nombre sin login, votar Voy/No voy/Tal vez con lista de confirmados en vivo,
PIN de administrador, plantel, partido de la semana, carga de goles/
asistencias/tarjetas, y estadísticas históricas públicas. Y sigue
instalándose como PWA en la pantalla de inicio.

## Por qué cambia la arquitectura

En la versión anterior, cada cambio chico requería: escribir varios archivos
de servidor, a veces una migración de base de datos en Supabase, subir todo
a GitHub, y esperar un build de Next.js en Vercel que podía fallar por
detalles de configuración. Acá en cambio:

- **Un solo archivo** (`index.html`) contiene el HTML, el diseño y toda la
  lógica. Actualizar la app = reemplazar ese archivo.
- **Firebase Firestore** guarda los datos (jugadores, partidos, votos,
  goles, tarjetas) — el navegador de cada persona habla directo con la base,
  no hace falta un servidor propio.
- **No hay build**: es un sitio estático. Cualquier hosting gratuito lo
  sirve tal cual (seguimos usando Vercel, para no perder el dominio
  `trebol-fc.vercel.app` que ya conoce el equipo).
- `manifest.json`, `sw.js` y la carpeta `icons/` son los únicos archivos
  "de acompañamiento" — casi nunca se tocan una vez configurados.

## El PIN de administrador, sin servidor propio

Como no hay backend, el PIN se valida con las **reglas de seguridad de
Firestore** (archivo `firestore.rules`, que pegás una sola vez en la consola
de Firebase). Funciona así: todos los que abren la app quedan identificados
de forma anónima y automática (sin que nadie note nada, no es un login).
Cuando alguien escribe el PIN correcto, Firestore se lo confirma y ese
navegador queda "como admin" hasta que cierre esa sesión. El PIN en sí nunca
se guarda en el código ni queda visible para nadie — está atado a un único
documento (`config/admin`) que ni siquiera la propia app puede leer.

## Paso 1 — Crear el proyecto de Firebase

1. Entrá a [console.firebase.google.com](https://console.firebase.google.com)
   con una cuenta de Google y creá un proyecto nuevo (por ejemplo,
   "trebol-fc"). No hace falta habilitar Google Analytics, podés
   destildarlo.
2. En el menú de la izquierda, andá a **Compilación → Firestore Database** →
   **Crear base de datos** → modo **producción** → elegí una región (por
   ejemplo `southamerica-east1`, San Pablo) → **Habilitar**.
3. Andá a la pestaña **Reglas** (dentro de Firestore Database). Borrá lo que
   haya y pegá **todo** el contenido del archivo `firestore.rules` de esta
   carpeta. Tocá **Publicar**.
4. Andá a **Compilación → Authentication** → **Comenzar** → en la lista de
   proveedores, elegí **Anónimo** → **Habilitar** → **Guardar**. (Esto es lo
   que permite identificar cada navegador sin pedirle contraseña a nadie.)
5. Volvé a Firestore Database → pestaña **Datos** → **Iniciar colección** →
   ID de la colección: `config` → ID del documento: `admin` → agregá un
   campo: nombre `pin`, tipo `string`, valor: el PIN que quieras usar (por
   ejemplo `2580`) → **Guardar**. Este es el único dato que cargás a mano
   desde acá; la app nunca lo toca.
6. Andá a **Configuración del proyecto** (ícono de engranaje, arriba a la
   izquierda) → pestaña **General** → bajá hasta "Tus apps" → tocá el
   ícono `</>` (Web) → ponele un nombre (por ejemplo "trebol-fc-web") → NO
   hace falta tildar "Firebase Hosting" → **Registrar app**. Te va a
   mostrar un bloque de código con un objeto `firebaseConfig` — copialo
   completo y pasámelo (no es información secreta, pero preferí pasármelo
   por acá antes que por otro lado para que lo pegue yo directamente en
   `index.html`).

## Paso 2 — Subir el sitio a GitHub y Vercel (conservando el mismo dominio)

Para no tener que borrar a mano los ~70 archivos del proyecto anterior de
Next.js, es más simple crear un repositorio nuevo y limpio, y decirle a
Vercel que ahora sirva desde ahí:

1. En [github.com](https://github.com), creá un repositorio nuevo y vacío
   (botón verde **New**) — por ejemplo `trebol-fc-web`. Privado o público,
   como prefieras. No tildes "agregar README".
2. Entrá al repo recién creado, buscá **"uploading an existing file"**, y
   arrastrá ahí **todo el contenido** de esta carpeta (`index.html`,
   `manifest.json`, `sw.js`, la carpeta `icons/`, y `firestore.rules` de
   referencia) — no hace falta subir la carpeta `_test` si la ves, es solo
   para mis pruebas internas. Confirmá el commit.
3. En [vercel.com](https://vercel.com), entrá al proyecto `trebol-fc` que
   ya tenías → **Settings** → **Git** → vas a ver el repositorio conectado
   actualmente; buscá la opción para **desconectarlo** y conectar en su
   lugar el nuevo repo `trebol-fc-web`.
4. Vercel va a detectar que ahora es un sitio estático (sin build) y
   desplegar solo. El dominio sigue siendo el mismo, `trebol-fc.vercel.app`
   — no hay que avisarle nada nuevo al equipo.
5. (Opcional, para prolijidad) En **Settings → Environment Variables** del
   proyecto de Vercel, podés borrar `DATABASE_URL`, `DIRECT_URL` y
   `ADMIN_PIN` — ya no se usan.

## Paso 3 — Los datos que ya tenías cargados

Actualmente en Supabase ya tenés cargados los jugadores del plantel y el
próximo partido (con algunos votos). Como es poca información, lo más
simple es volver a cargarlos a mano desde la nueva pantalla de **Plantel**
y **Partido** (2-3 minutos). Si preferís no re-escribirlos, avisame y te
guío para exportarlos de Supabase (Table Editor → Export) y te ayudo a
importarlos directamente a Firestore sin perder nada.

## Estructura de esta carpeta

```
index.html         toda la app (HTML + CSS + JS) — el archivo que vas a
                    actualizar de acá en adelante
manifest.json       metadata de la PWA (nombre, ícono, colores)
sw.js               service worker mínimo, para poder instalar la app
icons/              ícono de la app (el escudo real del equipo)
firestore.rules     reglas de seguridad — se pegan una sola vez en Firebase
README.md           este archivo
```

## Qué sigue

Con esto llegamos a la misma funcionalidad que ya tenías. Lo que queda
pendiente para más adelante (igual que antes):
- Registro real de asistencia post-partido (más allá de quién había
  votado) → ranking de asistencia de la temporada y ranking histórico.
- Vallas invictas.
- Tabla de posiciones y fixture de la Liga Vasco Germana, traídos
  automáticamente  .
