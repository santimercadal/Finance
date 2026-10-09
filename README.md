# Mi Portafolio — app de finanzas

Dashboard personal de inversiones con datos de mercado de Yahoo Finance. Se instala en el teléfono como una app (PWA).

## Qué incluye

- **Inicio**: indicadores clave del mercado, KPIs del portafolio (valor, variación del día, ganancia total, mejor/peor), rendimiento vs. S&P 500, posiciones y noticias con resumen.
- **Análisis de cada acción**:
  - *Resumen*: precio 12 meses y métricas clave. Toca el nombre de cualquier métrica para ver **qué es y para qué sirve**; las métricas que se leen en relación con otras empresas muestran automáticamente la **mediana de la competencia** y si la empresa está mejor o peor.
  - *Competencia*: comparación contra las principales empresas de la misma industria y un **score 0-100** (valuación, rentabilidad, crecimiento, salud financiera). Se pueden agregar competidores a mano.
  - *Estructura patrimonial*: Activos = Pasivos + Patrimonio, proporciones y evolución.
  - *Flujo de fondos*: operativo, inversión, financiamiento y flujo libre.
  - *Deuda*: costo de la deuda (Kd), Kd después de impuestos, cobertura de intereses, deuda neta / EBITDA.
  - *Informes*: descarga del **informe trimestral oficial** (10-Q / 6-K ante la SEC), informe resumido en PDF y datos trimestrales en CSV para Excel.
  - *Noticias* del ticker.
- **Noticias**: feed del portafolio + mercado con resúmenes en español generados con IA gratuita (Groq), si configuras la clave.

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

> En el plan gratuito de Render el servidor se "duerme" tras 15 minutos sin uso; la primera carga después tarda unos 30-60 segundos.

## Notas

- Posiciones en otras monedas se convierten a USD al tipo de cambio actual.
- Los competidores se toman de las mayores empresas de la misma industria según Yahoo Finance.
- Datos de Yahoo Finance (no oficial): pueden tener demoras o faltar para algunos tickers. No constituye recomendación de inversión.
