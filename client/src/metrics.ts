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

export const METRICS: Record<string, MetricInfo> = {
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
  forwardPe: {
    name: 'P/E proyectado (forward)',
    what: 'Precio dividido por la ganancia por acción que estiman los analistas para los próximos 12 meses.',
    use: 'Muestra la valuación mirando hacia adelante. Si es menor que el P/E actual, se esperan ganancias mayores.',
    comparable: true, better: 'low', peerKey: 'forwardPe',
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
}
