# Mi Portafolio — app de finanzas

Dashboard personal de inversiones con datos de mercado de Yahoo Finance. Se instala en el teléfono como una app (PWA).

## Qué incluye

- **Inicio**: indicadores clave del mercado, KPIs del portafolio (valor, variación del día, ganancia total, mejor/peor, **beta del portafolio**), rendimiento vs. S&P 500, posiciones y, debajo, noticias con resumen.
- **Posiciones**: se cargan a mano, pegando una lista (`TICKER UNIDADES PRECIO_PROMEDIO`) o con el botón **Sincronizar eToro**.
- **ETF y cripto** tienen su propia vista: rendimiento total (1M a 5 años), volatilidad, caída máxima, beta, correlación con el S&P 500, ratio de Sharpe, dividendos y, cuando está disponible, costo anual (TER), patrimonio, principales posiciones y sectores.
- **Análisis de cada acción**:
  - *Resumen*: precio 12 meses y métricas clave. Toca el nombre de cualquier métrica para ver **qué es y para qué sirve**; las métricas que se leen en relación con otras empresas muestran automáticamente la **mediana de la competencia** y si la empresa está mejor o peor.
  - *Competencia*: comparación contra las principales empresas de la misma industria y un **score 0-100** (valuación, rentabilidad, crecimiento, salud financiera). Se pueden agregar competidores a mano.
  - *Estructura patrimonial*: Activos = Pasivos + Patrimonio, proporciones y evolución.
  - *Flujo de fondos*: operativo, inversión, financiamiento y flujo libre.
  - *Deuda*: costo de la deuda (Kd), Kd después de impuestos, cobertura de intereses, deuda neta / EBITDA.
  - *Informes*: descarga del **informe trimestral oficial** (10-Q / 6-K ante la SEC), informe resumido en PDF y datos trimestrales en CSV para Excel.
  - *Pros y contras según analistas* (en el Resumen).
  - *Noticias* del ticker.
- **Noticias**: feed del portafolio + mercado con resúmenes en español generados con IA gratuita (Groq), si configuras la clave, y **pros y contras de los analistas** para cada posición.

## Fuentes de datos

| Dato | Fuente | Notas |
| --- | --- | --- |
| Precios, históricos, dividendos, índices, tipo de cambio | [Yahoo Finance](https://finance.yahoo.com) (API no oficial, vía [`yahoo-finance2`](https://github.com/gadicc/node-yahoo-finance2)) | Pueden tener demoras de hasta 15-20 minutos. |
| Estados contables (balance, resultados, flujo de fondos) | Yahoo Finance — *fundamentals time series* | Base de las métricas de valuación, rentabilidad, deuda y competencia. |
| Industria, sector y competidores | Yahoo Finance — búsqueda | Competidores = mayores empresas de la misma industria. |
| Pros y contras de cada empresa | [Morningstar](https://www.morningstar.com) (bull/bear case), vía Yahoo Finance *insights* | Traducidos al español con IA; solo acciones con cobertura. |
| Calificación y precio objetivo | [Argus Research](https://www.argusresearch.com), vía Yahoo Finance *insights* | |
| Perspectiva técnica y valuación relativa | [Trading Central](https://www.tradingcentral.com), vía Yahoo Finance *insights* | Corto, mediano y largo plazo. |
| Costo, patrimonio y composición de ETF | Yahoo Finance — *quoteSummary* | Yahoo lo bloquea para servidores en la nube: en Render puede no aparecer. |
| Informes oficiales (10-Q, 10-K, 6-K) | [SEC EDGAR](https://www.sec.gov/edgar) | Solo empresas que reportan ante la SEC. |
| Noticias | Yahoo Finance — búsqueda de noticias | Resúmenes y resumen del día con [Groq](https://console.groq.com) (opcional). |
| Posiciones de eToro | [eToro Public API](https://api-portal.etoro.com) | Solo lectura, con tus claves (opcional). |
| Tasa libre de riesgo (Sharpe) | Letra del Tesoro de EE.UU. a 13 semanas (`^IRX`) vía Yahoo Finance | |

**Cálculos propios de la app** (a partir de los datos anteriores):
- **Beta** de cada activo: 5 años de rendimientos mensuales contra el S&P 500. **Beta del portafolio**: promedio ponderado por el valor de cada posición.
- **Volatilidad**: desvío estándar anualizado de los rendimientos diarios del último año. **Caída máxima**: mayor caída desde un pico. **Sharpe**: (rendimiento 1 año − tasa libre de riesgo) / volatilidad.
- **Rendimiento total** de ETF y cripto: con dividendos reinvertidos; 3 y 5 años anualizados.
- Valores en otras monedas se convierten a USD al tipo de cambio actual.

## Uso local

Requiere Node 22+.

```bash
npm install
npm run install:all
npm run dev
```

Abre http://localhost:5173. Opcional: copia `server/.env.example` a `server/.env` y completa las variables.

## Publicar en internet (para usarla desde el teléfono)

La app necesita un servidor (consulta Yahoo Finance), así que GitHub guarda el código y **Render** la ejecuta gratis.

1. **GitHub**: crea un repositorio (puede ser privado) y sube este proyecto.
2. **Base de datos (Upstash)**: crea una cuenta gratis en https://upstash.com → *Create Database* (Redis). En la pestaña *REST API* copia `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`. Ahí se guarda tu portafolio.
3. **Render**: crea una cuenta en https://render.com con tu GitHub → *New* → *Blueprint* → elige el repositorio. Render lee `render.yaml` y te pide:
   - `APP_PASSWORD`: la contraseña para entrar a la app (elige una segura: la app es pública en internet).
   - `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`: los del paso 2.
   - `GROQ_API_KEY`: opcional y gratis, para resúmenes con IA. Se obtiene en https://console.groq.com → *API Keys* (sin tarjeta).
4. Al terminar el deploy, Render te da una URL `https://mi-portafolio-xxxx.onrender.com`.
5. **En el teléfono**: abre la URL, ingresa la contraseña y usa *Agregar a pantalla de inicio* (Safari: botón compartir; Chrome Android: menú ⋮ → *Instalar app*).

Cada `git push` a la rama principal vuelve a publicar la app automáticamente.

### Sincronizar con eToro (opcional)

El botón **Sincronizar eToro** reemplaza el portafolio por las posiciones abiertas de tu cuenta real de eToro (agrupa varias posiciones del mismo activo con su precio promedio). La app solo **lee** la cuenta: no puede operar.

1. En eToro: *Configuración → Trading → Gestión de claves de API* → crea una clave para la cuenta **Real** con permiso de **solo lectura**. Esa es la `ETORO_USER_KEY`.
2. La `ETORO_API_KEY` (clave de la aplicación) se obtiene en el portal de la API de eToro: https://api-portal.etoro.com.
3. En Render → tu servicio → *Environment*, agrega `ETORO_API_KEY` y `ETORO_USER_KEY` y guarda (Render vuelve a publicar solo).

Notas: las posiciones en corto se omiten; los activos que Yahoo Finance no reconoce se informan y quedan afuera; el efectivo disponible no se incluye.

> En el plan gratuito de Render el servidor se "duerme" tras 15 minutos sin uso; la primera carga después tarda unos 30-60 segundos.

## Notas

- Los datos de Yahoo Finance (no oficial) pueden tener demoras o faltar para algunos tickers.
- Las opiniones de analistas son de sus autores (Morningstar, Argus, Trading Central). Nada de esta app constituye una recomendación de inversión.
