// Glossary of every measure shown in the app: what it is, what it is used for,
// and whether it only makes sense compared against other companies.
export interface MetricInfo {
  name: string
  what: string
  use: string
  /** Relative measure: read it against competitors, not in isolation. */
  comparable?: boolean
  better?: 'high' | 'low'
  /** Key in the peer comparison data, when competitors' values are available. */
  peerKey?: string
  /** Rule of thumb shown after the explanation. */
  ref?: string
}

export const METRICS = {
  marketCap: {
    name: 'Capitalización bursátil',
    what: 'Valor de mercado de todas las acciones de la empresa (precio × cantidad de acciones).',
    use: 'Indica el tamaño de la empresa. Las grandes suelen ser más estables; las chicas, más volátiles y con más potencial de crecimiento.',
  },
  pe: {
    name: 'P/E (precio / ganancia)',
    what: 'Cuántas veces paga el mercado las ganancias de los últimos 12 meses.',
    use: 'Mide si la acción está cara o barata respecto de lo que gana. Un P/E alto implica que el mercado espera crecimiento.',
    comparable: true, better: 'low', peerKey: 'pe',
    ref: 'Depende mucho del sector: compárala siempre con empresas similares.',
  },
  pb: {
    name: 'Precio / Valor libro (P/B)',
    what: 'Precio de la acción dividido por el patrimonio contable por acción.',
    use: 'Compara lo que paga el mercado contra el valor contable. Útil en bancos e industrias con muchos activos; poco útil en empresas de marca o tecnología.',
    comparable: true, better: 'low', peerKey: 'pb',
  },
  evToEbitda: {
    name: 'EV / EBITDA',
    what: 'Valor de la empresa (capitalización + deuda − caja) dividido por el EBITDA anual.',
    use: 'Valuación que incluye la deuda y no depende de la estructura de capital ni de los impuestos. Es la más usada para comparar empresas del mismo rubro.',
    comparable: true, better: 'low', peerKey: 'evToEbitda',
  },
  evToRevenue: {
    name: 'EV / Ventas',
    what: 'Valor de la empresa dividido por sus ingresos anuales.',
    use: 'Sirve para valuar empresas con poca o ninguna ganancia (por ejemplo, en crecimiento).',
    comparable: true, better: 'low', peerKey: 'evToRevenue',
  },
  dividendYield: {
    name: 'Rendimiento por dividendo',
    what: 'Dividendos anuales por acción divididos por el precio actual.',
    use: 'Indica cuánto efectivo te devuelve la empresa por año sobre lo que pagas. Un rendimiento muy alto puede anticipar un recorte.',
    comparable: true, better: 'high', peerKey: 'dividendYield',
  },
  beta: {
    name: 'Beta',
    what: 'Sensibilidad de la acción a los movimientos del mercado (S&P 500 = 1).',
    use: 'Mide el riesgo de mercado: beta 1,5 suele moverse un 50% más que el índice; beta 0,5, la mitad.',
    comparable: true, better: 'low', peerKey: 'beta',
  },
  roe: {
    name: 'ROE (rentabilidad sobre patrimonio)',
    what: 'Ganancia neta dividida por el patrimonio de los accionistas.',
    use: 'Mide cuánto gana la empresa con el dinero de sus dueños. Ojo: un ROE muy alto puede deberse a mucha deuda o a un patrimonio chico.',
    comparable: true, better: 'high', peerKey: 'roe',
    ref: 'Más de 15% suele considerarse bueno.',
  },
  roa: {
    name: 'ROA (rentabilidad sobre activos)',
    what: 'Ganancia neta dividida por el total de activos.',
    use: 'Mide qué tan eficientemente usa sus activos para generar ganancias, sin importar cómo se financia.',
    comparable: true, better: 'high', peerKey: 'roa',
  },
  grossMargin: {
    name: 'Margen bruto',
    what: 'Ventas menos costo de ventas, como % de las ventas.',
    use: 'Refleja el poder de fijar precios y la ventaja competitiva del producto.',
    comparable: true, better: 'high', peerKey: 'grossMargin',
  },
  operatingMargin: {
    name: 'Margen operativo',
    what: 'Resultado operativo (antes de intereses e impuestos) como % de las ventas.',
    use: 'Muestra la rentabilidad del negocio principal después de todos los gastos operativos.',
    comparable: true, better: 'high', peerKey: 'operatingMargin',
  },
  profitMargin: {
    name: 'Margen neto',
    what: 'Ganancia neta como % de las ventas.',
    use: 'De cada $100 vendidos, cuántos quedan como ganancia final para los accionistas.',
    comparable: true, better: 'high', peerKey: 'profitMargin',
  },
  revenueGrowth: {
    name: 'Crecimiento de ingresos',
    what: 'Variación de las ventas del último trimestre contra el mismo trimestre del año anterior.',
    use: 'Indica si el negocio se está expandiendo. Compáralo con la competencia para ver si gana o pierde mercado.',
    comparable: true, better: 'high', peerKey: 'revenueGrowth',
  },
  earningsGrowth: {
    name: 'Crecimiento de ganancias',
    what: 'Variación de la ganancia del último trimestre contra el mismo trimestre del año anterior.',
    use: 'Muestra si las ganancias acompañan (o superan) el crecimiento de las ventas.',
    comparable: true, better: 'high', peerKey: 'earningsGrowth',
  },
  currentRatio: {
    name: 'Liquidez corriente',
    what: 'Activo corriente dividido por pasivo corriente.',
    use: 'Capacidad de pagar las deudas de corto plazo con los activos de corto plazo.',
    comparable: true, better: 'high', peerKey: 'currentRatio',
    ref: 'Por encima de 1 es cómodo; por debajo de 1 depende del flujo de caja.',
  },
  quickRatio: {
    name: 'Prueba ácida',
    what: 'Como la liquidez corriente, pero sin contar inventarios.',
    use: 'Prueba más estricta de liquidez: qué pasa si no se pueden vender los inventarios rápido.',
    comparable: true, better: 'high', peerKey: 'quickRatio',
  },
  range52: {
    name: 'Rango de 52 semanas',
    what: 'Precio mínimo y máximo del último año.',
    use: 'Ubica el precio actual: cerca del máximo indica fortaleza; cerca del mínimo, debilidad o una posible oportunidad.',
  },
  targetMean: {
    name: 'Precio objetivo de analistas',
    what: 'Promedio de los precios objetivo a 12 meses de los analistas que cubren la acción.',
    use: 'Referencia del consenso. Compáralo con el precio actual para ver el potencial que esperan; no es una garantía.',
  },
  liabilitiesToAssets: {
    name: 'Pasivo / Activo',
    what: 'Porcentaje de los activos financiado con deudas y obligaciones con terceros.',
    use: 'Mide el endeudamiento total. Cuanto más alto, más depende la empresa de terceros.',
    comparable: true, better: 'low',
  },
  equityToAssets: {
    name: 'Patrimonio / Activo',
    what: 'Porcentaje de los activos financiado con capital propio.',
    use: 'Mide la autonomía financiera. Es el complemento de Pasivo / Activo.',
    comparable: true, better: 'high',
  },
  debtToEquity: {
    name: 'Deuda / Patrimonio (D/E)',
    what: 'Deuda financiera dividida por el patrimonio neto.',
    use: 'Mide el apalancamiento: cuánta deuda usa la empresa por cada peso de capital propio.',
    comparable: true, better: 'low', peerKey: 'debtToEquity',
    ref: 'Varía mucho por industria: los servicios públicos y bancos operan con más deuda.',
  },
  liabilitiesToEquity: {
    name: 'Pasivo / Patrimonio',
    what: 'Pasivo total dividido por el patrimonio neto.',
    use: 'Mide la solvencia: cuántos pesos de terceros hay por cada peso de los accionistas.',
    comparable: true, better: 'low',
  },
  workingCapital: {
    name: 'Capital de trabajo',
    what: 'Activo corriente menos pasivo corriente.',
    use: 'Colchón disponible para operar en el corto plazo. Negativo no siempre es malo (empresas que cobran antes de pagar).',
  },
  operatingCF: {
    name: 'Flujo operativo',
    what: 'Efectivo generado por el negocio principal en el período.',
    use: 'Es la fuente genuina de dinero de la empresa. Debería ser positivo y crecer en el tiempo.',
  },
  investingCF: {
    name: 'Flujo de inversión',
    what: 'Efectivo usado en (o recibido por) inversiones: CapEx, compras de empresas, inversiones financieras.',
    use: 'Suele ser negativo: indica que la empresa invierte para crecer o mantener sus activos.',
  },
  financingCF: {
    name: 'Flujo de financiamiento',
    what: 'Efectivo de deuda tomada o pagada, emisión o recompra de acciones y dividendos.',
    use: 'Negativo indica que devuelve dinero a acreedores o accionistas; positivo, que se está financiando.',
  },
  fcf: {
    name: 'Flujo libre (FCF)',
    what: 'Flujo operativo menos inversiones en capital (CapEx).',
    use: 'El dinero que queda disponible para dividendos, recompras, pagar deuda o adquisiciones. Base de muchas valuaciones.',
  },
  fcfMargin: {
    name: 'Margen de flujo libre',
    what: 'Flujo libre como % de las ventas.',
    use: 'Cuánto efectivo libre genera cada peso vendido.',
    comparable: true, better: 'high',
  },
  earningsQuality: {
    name: 'Calidad de las ganancias',
    what: 'Flujo operativo dividido por la ganancia neta.',
    use: 'Si es mayor a 1, las ganancias contables están respaldadas por efectivo. Valores bajos sostenidos son una alerta.',
    comparable: true, better: 'high',
  },
  shareholderReturn: {
    name: 'Retorno al accionista',
    what: 'Dividendos pagados más recompras de acciones del ejercicio.',
    use: 'Efectivo que la empresa devolvió a sus dueños en el año.',
  },
  kd: {
    name: 'Costo de la deuda (Kd)',
    what: 'Gastos por intereses del año divididos por la deuda financiera promedio.',
    use: 'Tasa de interés efectiva que paga la empresa. Sirve para calcular el WACC y para ver si se endeuda barato o caro.',
    comparable: true, better: 'low',
  },
  kdAfterTax: {
    name: 'Kd después de impuestos',
    what: 'Costo de la deuda × (1 − tasa impositiva).',
    use: 'Costo real de la deuda, ya que los intereses reducen el impuesto a las ganancias. Es el que se usa en el WACC.',
    comparable: true, better: 'low',
  },
  interestExpense: {
    name: 'Gastos por intereses',
    what: 'Intereses pagados por la deuda en el año.',
    use: 'Costo absoluto del endeudamiento.',
  },
  interestCoverage: {
    name: 'Cobertura de intereses',
    what: 'EBIT (resultado operativo) dividido por los gastos por intereses.',
    use: 'Cuántas veces pueden pagarse los intereses con las ganancias operativas.',
    comparable: true, better: 'high',
    ref: 'Más de 8x es holgado; menos de 1,5x es riesgoso.',
  },
  totalDebt: {
    name: 'Deuda total',
    what: 'Deuda financiera de corto y largo plazo (incluye arrendamientos).',
    use: 'Monto total adeudado a bancos y bonistas.',
  },
  netDebt: {
    name: 'Deuda neta',
    what: 'Deuda total menos caja e inversiones de corto plazo.',
    use: 'La deuda que quedaría si se usara toda la caja para pagarla. Negativa = la empresa tiene más caja que deuda.',
  },
  netDebtToEbitda: {
    name: 'Deuda neta / EBITDA',
    what: 'Años de EBITDA necesarios para cancelar la deuda neta.',
    use: 'Indicador de solvencia más usado por bancos y calificadoras.',
    comparable: true, better: 'low',
    ref: 'Menos de 2x es conservador; más de 4x es elevado.',
  },
  debtToAssets: {
    name: 'Deuda / Activos',
    what: 'Deuda financiera como % de los activos totales.',
    use: 'Qué parte de los activos se financia con deuda que paga intereses.',
    comparable: true, better: 'low',
  },
  portfolioBeta: {
    name: 'Beta del portafolio',
    what: 'Promedio de la beta de cada posición, ponderado por su peso en el portafolio. Cada beta se calcula con 5 años de rendimientos mensuales contra el S&P 500.',
    use: 'Indica cuánto se mueve tu portafolio cuando se mueve el mercado: con beta 1,2, si el S&P 500 cae 10% tu portafolio tiende a caer alrededor de 12%.',
    ref: 'Menos de 0,8 es defensivo; entre 0,8 y 1,2 se mueve parecido al mercado; más de 1,2 es agresivo.',
  },
  // ETF / cripto
  assetBeta: {
    name: 'Beta',
    what: 'Sensibilidad del activo a los movimientos del S&P 500 (= 1), con 5 años de rendimientos mensuales.',
    use: 'Mide el riesgo de mercado: beta 1,5 suele moverse un 50% más que el índice; beta 0,5, la mitad.',
  },
  expenseRatio: {
    name: 'Costo anual (TER)',
    what: 'Porcentaje del patrimonio que el fondo cobra cada año para cubrir sus gastos. Se descuenta del precio, no se paga aparte.',
    use: 'Es el costo seguro de tener el ETF: entre dos fondos que replican lo mismo, conviene el más barato.',
    ref: 'Los ETF de índices amplios cuestan menos de 0,10%; los temáticos o de nicho suelen superar 0,40%.',
  },
  fundAssets: {
    name: 'Patrimonio del fondo (AUM)',
    what: 'Valor total de los activos que administra el ETF.',
    use: 'Un fondo grande suele tener más liquidez, spreads más chicos y menos riesgo de que lo cierren.',
  },
  totalReturn: {
    name: 'Rendimiento total',
    what: 'Variación del precio incluyendo los dividendos reinvertidos. Los plazos de 3 y 5 años se muestran anualizados.',
    use: 'Es la ganancia real que tuvo el fondo en cada período. Compáralo con el S&P 500 para ver si te convino frente al índice.',
  },
  volatility: {
    name: 'Volatilidad (1 año)',
    what: 'Desvío estándar anualizado de los rendimientos diarios del último año.',
    use: 'Mide cuánto oscila el precio. A mayor volatilidad, más amplias las subas y bajas que hay que tolerar.',
    ref: 'El S&P 500 suele estar entre 12% y 20%. Las cripto, por encima de 40%.',
  },
  maxDrawdown: {
    name: 'Caída máxima',
    what: 'La mayor caída desde un máximo hasta un mínimo posterior dentro del período.',
    use: 'Muestra el peor momento que habría vivido alguien que compró en el pico. Sirve para medir si podrías tolerar ese riesgo.',
  },
  correlation: {
    name: 'Correlación con el S&P 500',
    what: 'Qué tan parecidos son los movimientos diarios del activo y del S&P 500 en el último año (de −1 a 1).',
    use: 'Cerca de 1 el activo se mueve como el mercado y aporta poca diversificación; cerca de 0 se mueve por su cuenta.',
  },
  sharpe: {
    name: 'Ratio de Sharpe (1 año)',
    what: '(Rendimiento del último año − tasa libre de riesgo) / volatilidad. La tasa libre de riesgo es la Letra del Tesoro de EE.UU. a 13 semanas.',
    use: 'Mide cuánto rendimiento extra obtuviste por cada unidad de riesgo asumido.',
    ref: 'Mayor a 1 es bueno; negativo significa que rindió menos que un bono sin riesgo.',
  },
  fundYield: {
    name: 'Rendimiento por dividendos',
    what: 'Dividendos pagados en los últimos 12 meses divididos por el precio actual.',
    use: 'Cuánto efectivo distribuye el fondo por año sobre lo que pagas.',
  },
  divFrequency: {
    name: 'Frecuencia de pago',
    what: 'Cada cuánto distribuye dividendos el fondo, según los pagos de los últimos 3 años.',
    use: 'Útil si buscas un flujo de ingresos regular.',
  },
  inception: {
    name: 'Cotiza desde',
    what: 'Primer día de cotización del activo según Yahoo Finance.',
    use: 'Un historial más largo da más confianza a los indicadores de riesgo y rendimiento.',
  },
} satisfies Record<string, MetricInfo>

export type MetricId = keyof typeof METRICS

// Lookup by a key that comes from the API (not checked at compile time).
export const metricInfo = (key: string): MetricInfo | undefined => (METRICS as Record<string, MetricInfo>)[key]
