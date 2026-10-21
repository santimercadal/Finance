# CLAUDE.md

Guía para trabajar en este repositorio. Para el usuario final ver [README.md](README.md).

## Qué es

**Mi Portafolio**: PWA personal de inversiones (se usa sobre todo desde el teléfono). Un servidor Express consulta Yahoo Finance y otras fuentes, y sirve también la app React ya compilada. Se publica gratis en Render; el portafolio se guarda en Upstash Redis.

- La interfaz y los mensajes de error que ve el usuario van **en español**. Los comentarios del código y los nombres van en inglés.
- Todo debe funcionar con servicios **gratuitos** (Render free, Upstash free, Groq free).

## Comandos

Requiere Node 22+. Desde la raíz:

```bash
npm install && npm run install:all   # dependencias de raíz, server y client
npm run dev                          # API en :3001 (node --watch) + Vite en :5173 (proxy /api → :3001)
npm run build                        # lo que corre Render: deps del server + build del client
npm start                            # producción: el server sirve client/dist
npm run lint --prefix client         # oxlint
npm run build --prefix client        # tsc -b + vite build (sirve como chequeo de tipos)
```

No hay tests. Para verificar cambios: `npm run build --prefix client` (tipos) y la vista previa (`.claude/launch.json` define `api`, `web` y `app-built`).

## Estructura

```
server/src/          API (Express 5, ESM, JavaScript sin build)
  index.js           rutas /api/*, contraseña, sirve client/dist en producción
  yahoo.js           cliente yahoo-finance2, caché en memoria `cached()`, cotizaciones sin crumb, FX
  storage.js         clave-valor: Upstash Redis (REST) o JSON en server/data/ (local)
  portfolio.js       posiciones, snapshot (valor, P&L, beta ponderada) e historial vs. S&P 500
  stock.js           detalle de una acción/ETF/cripto e informe trimestral (CSV/PDF)
  company.js         estados contables (fundamentals time series), beta, métricas
  peers.js           competencia y score 0-100
  estimates.js       pestaña Proyecciones: Yahoo quoteSummary → Nasdaq API → objetivo de Argus
  etf.js             indicadores de fondos/cripto (rendimiento, volatilidad, Sharpe…)
  analysts.js        pros/contras Morningstar, Argus y Trading Central (traducidos con IA)
  news.js            feed de noticias, resumen de artículos y resumen del día
  ai.js              Groq (askAI, parseJsonAnswer); pausa automática tras un 429
  sec.js             SEC EDGAR (10-Q/10-K/6-K…); solo empresas que reportan ante la SEC
  etoro.js           sincronización de solo lectura con eToro
  screener.js        buscador: filtros (screener público de Nasdaq) y estilos (pantallas predefinidas de Yahoo)
  ideas.js           ideas de analistas por plazo (Nasdaq + Trading Central + Argus), guardadas 6 h en Upstash
  preferences.js     preferencias (pantalla inicial, tema, orden de paneles), validadas y guardadas en storage
  util.js            num, div, ratioPct, changePct, isoDate, httpError
client/src/          React 19 + TypeScript + Vite 8 (rolldown) + Recharts + React Router 7
  App.tsx            rutas: / (Dashboard), /noticias, /ideas, /explorar, /accion/:symbol, /accion/:symbol/informe; abre la pantalla inicial elegida
  api.ts             tipos de la API, fetch con x-app-key, hook de datos, AUTH_EVENT, CUSTOMIZE_EVENT
  prefs.ts           tipos, paneles del inicio y contexto de preferencias (PrefsProvider en components/)
  icons.tsx          íconos de línea compartidos (<Icon name="…" />)
  metrics.ts         catálogo de métricas: nombre, explicación, si se compara con la competencia
  format.ts          formato de dinero, porcentajes, fechas, montos grandes
  pages/             Dashboard, Stock (pestañas), News, ReportPrint (informe imprimible)
  components/        tarjetas, gráficos, diálogos, búsqueda, login
  index.css          todo el estilo: sistema "Terminal Editorial" de Stitch (Space Grotesk para texto, Space Mono para cifras); tokens en :root = oscuro, :root[data-theme='light'] = claro
client/public/       manifest PWA, íconos, logo.svg
design/              referencias de diseño (Stitch: stitch/terminal-editorial/ es el diseño actual, oscuro y claro; Romer, logos); no se publica
render.yaml          Blueprint de Render
```

## Cosas a tener en cuenta

- **El crumb de Yahoo está bloqueado en Render** (HTTP 429 a hosts en la nube). `quote` y `quoteSummary` pueden fallar en producción aunque funcionen en local. Lo esencial se construye sobre endpoints que no lo necesitan (chart, search, fundamentals time series); `quoteSummary` solo se usa como opcional (`optionalSummary`, `crumbBlocked()`) con alternativa. Cualquier dato nuevo debe tener un camino que funcione sin crumb o degradar con un aviso.
- **Caché**: `cached(key, ttl, fn)` en `yahoo.js` (memoria, deduplica pedidos concurrentes). Las respuestas de IA se guardan en Upstash con `recall`/`remember` (en local son no-ops) para no gastar la cuota gratuita de Groq.
- **Monedas**: los activos pueden cotizar en otra moneda (acciones europeas, ADRs). `fxPerUsd` convierte a USD; el detalle muestra el precio en moneda nativa y en USD. En ADRs no mezclar BPA en moneda local con estimaciones en dólares.
- **Tipos de activo**: `kind === 'equity'` muestra todas las pestañas de `Stock.tsx`; ETF/cripto solo Resumen y Noticias (`FUND_TABS`). Si falta un estado contable se muestra un aviso, no una pestaña vacía.
- **Seguridad**: con `APP_PASSWORD` todas las rutas `/api` (salvo `/api/health`) piden el header `x-app-key`. `/api/filing` solo descarga del archivo de la SEC y `/api/news/summary` solo de yahoo.com: no abrir proxies a URLs arbitrarias.
- **Errores**: en las rutas usar `wrap()` y `httpError(status, mensajeEnEspañol)`.
- **Temas claro y oscuro**: en el CSS y en los gráficos usar siempre los tokens (`var(--text)`, `color-mix(in srgb, var(--gain) 12%, transparent)`…), nunca colores fijos, y probar los dos temas. `index.html` aplica el tema guardado antes de cargar la app.
- **Móvil primero**: probar a 375 px de ancho. Las páginas secundarias se cargan con `lazy()` y las librerías van en chunks aparte (`vite.config.ts`) para que el teléfono las mantenga en caché.
- **Datos locales**: sin Upstash, el portafolio queda en `server/data/portfolio.json` (ignorado por git). Si no existe se crea con posiciones de ejemplo.

## Variables de entorno

En `server/.env` (local, ver `server/.env.example`) o en Render → *Environment*:

| Variable | Uso |
| --- | --- |
| `APP_PASSWORD` | Contraseña de acceso; vacía = sin contraseña (solo local) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Base de datos; el token debe ser de escritura (`/api/health` lo verifica) |
| `GROQ_API_KEY`, `GROQ_MODEL` | Resúmenes y traducciones con IA (por defecto `openai/gpt-oss-120b`) |
| `GROQ_DAILY_TOKENS` | Opcional: tope diario de tokens para el indicador de consumo (si el modelo no está en la tabla de `ai.js`) |
| `ETORO_API_KEY`, `ETORO_USER_KEY` | Botón Sincronizar eToro (solo lectura) |
| `SEC_USER_AGENT` | User-Agent para SEC EDGAR (tiene valor por defecto) |
| `PORT` | Puerto del server (3001 por defecto) |

## Deploy

Cada push a `main` publica en Render automáticamente (`render.yaml`: `npm run build`, `npm start`, health check `/api/health`). En el plan gratuito el servidor se duerme tras 15 minutos sin uso.

## Commits

Mensajes en español, título corto con lo que cambia para el usuario y una lista de puntos en el cuerpo.
