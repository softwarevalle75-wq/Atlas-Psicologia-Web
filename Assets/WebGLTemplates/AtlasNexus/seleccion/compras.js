(function (root) {
  'use strict';

  // INNOVARQ, Gerente de Compras y Logística, pp. 10–12. All case data are fictional.
  const competencies = [
    {id: 'continuidad', label: 'Planificación y continuidad del suministro'},
    {id: 'proveedores', label: 'Evaluación y negociación con proveedores'},
    {id: 'costos', label: 'Análisis de costos'},
    {id: 'calidad', label: 'Calidad y trazabilidad del material'},
    {id: 'coordinacion', label: 'Coordinación y comunicación con obra'},
  ];

  const cases = [
    {
      id: 'retraso',
      title: 'Una entrega que detendría la obra',
      method: 'Juicio situacional',
      brief: 'Es lunes. Obra necesita 70 kits el miércoles a las 8 a. m. Hay 20 disponibles. ' +
        'El proveedor adjudicado entregará el viernes los 80 kits de la orden. Puede adelantar hasta 30 al martes con un flete fijo de $180.000 COP y acepta reducir la orden por las unidades que compres por fuera. ' +
        'Otro proveedor homologado entrega hasta 50 kits el martes por $9.000 COP adicionales por kit, con flete incluido. Ambos materiales cumplen la ficha técnica. Un turno de obra parado cuesta $1.200.000 COP.',
      prompt: '¿Qué plan pondrías en marcha hoy? Indica cantidades, costo adicional y cómo sabría obra si puede mantener su turno.',
      followUp: 'Son las cuatro de la tarde del lunes. ¿Qué revisarías para decidir si mantienes o cambias tu plan?',
      criteria: [
        {competencyId: 'continuidad', anchors: [
          'Programa el turno con menos de 70 kits disponibles o cuenta la entrega del viernes para cubrir el miércoles.',
          'Identifica el faltante de 50 kits y plantea una entrega anterior al turno. Deja cantidades o fechas por confirmar.',
          'Cubre los 50 kits antes del miércoles con cantidades y fechas viables, o justifica una reprogramación acordada que protege la actividad crítica.',
        ]},
        {competencyId: 'proveedores', anchors: [
          'Compromete cantidades superiores a las ofrecidas o decide duplicar pedidos a pesar del acuerdo de reducción.',
          'Solicita un adelanto o una compra alternativa dentro de la capacidad ofrecida y explica qué negociaría.',
          'Concreta cantidad y fecha con los proveedores pertinentes, ajusta el saldo de la orden y pide una confirmación que permita activar un respaldo.',
        ]},
        {competencyId: 'costos', anchors: [
          'Confunde el flete fijo con el costo por kit o basa su elección en una comparación de costos incompatible con las cantidades que propone.',
          'Calcula de forma coherente el costo adicional de al menos una opción viable.',
          'Compara alternativas viables y justifica el costo o el riesgo asumido. Por ejemplo, adelantar 30 y comprar 20 cuesta $360.000 adicionales, y comprar 50 al alterno cuesta $450.000.',
        ]},
        {competencyId: 'coordinacion', anchors: [
          'Indica a obra que el suministro está asegurado aunque su propio plan deja unidades pendientes, o posterga el aviso hasta después del turno.',
          'Informa a obra del atraso y comunica una nueva fecha o una alternativa concreta.',
          'Acuerda con el residente quién confirmará cantidades y a qué hora. Define qué aviso o cambio de secuencia pondrá en marcha si falla una entrega.',
        ]},
      ],
    },
    {
      id: 'ofertas',
      title: 'Tres ofertas para una misma compra',
      method: 'Muestra de trabajo con cotizaciones',
      brief: 'Debes adjudicar 100 paneles. Se requieren 40 al inicio del lunes y los 60 restantes antes del viernes al mediodía. Las condiciones de compra exigen el certificado de conformidad del lote antes de adjudicar. Los precios son finales en COP y los fletes se pagan una sola vez por oferta.\n' +
        'Oferta A · $80.000 por panel + $600.000 de flete. Entrega completa el jueves. Certificado verificado.\n' +
        'Oferta B · $87.000 por panel + $200.000 de flete. Entrega 40 el lunes a primera hora y 60 el jueves. Certificado verificado.\n' +
        'Oferta C · $82.000 por panel + $300.000 de flete. Entrega los 100 el lunes a primera hora. Certificado pendiente.',
      prompt: '¿Qué recomendarías al comité de compras con la información disponible? Compara las tres ofertas y explica qué dejarías registrado antes de adjudicar.',
      followUp: '¿Qué dato o compromiso de un proveedor podría cambiar tu recomendación y cómo lo comprobarías?',
      criteria: [
        {competencyId: 'costos', anchors: [
          'Recomienda una oferta por precio unitario y afirma un total u orden de costos que contradice los datos.',
          'Calcula el costo puesto en obra de la opción elegida incluyendo las 100 unidades y el flete.',
          'Contrasta los totales puestos en obra (A $8,6 millones, B $8,9 millones y C $8,5 millones) y explica el costo de elegir una opción que cumpla plazo y calidad.',
        ]},
        {competencyId: 'proveedores', anchors: [
          'Adjudica A en sus términos actuales afirmando que cubre el lunes, o da por confirmado un cambio de plazo que ningún proveedor ha aceptado.',
          'Identifica una oferta viable o una negociación condicionada y señala la restricción de entrega o documental que debe resolver.',
          'Sustenta la decisión con precio, calendario y conformidad. Distingue los compromisos confirmados de las mejoras que negociaría y verificaría antes de cambiar la adjudicación.',
        ]},
        {competencyId: 'calidad', anchors: [
          'Propone adjudicar C con el certificado pendiente y aceptar la verificación después de contratar.',
          'Reconoce el certificado como condición previa y mantiene en espera la oferta que carece de él.',
          'Comprueba que el documento corresponde al lote ofertado, identifica quién verifica y deja constancia de su vigencia o aceptación antes de autorizar la adjudicación.',
        ]},
      ],
    },
    {
      id: 'recepcion',
      title: 'La remisión y la bodega no coinciden',
      method: 'Bandeja de entrada de logística',
      brief: 'Son las 3 p. m. Tienes tres mensajes para resolver antes del cierre.\n' +
        'Bodega · La orden y la remisión indican 120 válvulas. Contamos 108 en la descarga, incluidas ocho con la carcasa dañada.\n' +
        'Finanzas · El sistema registró automáticamente las 120 como disponibles. La factura por 120 está lista para aprobación.\n' +
        'Obra · Debemos retirar 104 válvulas conformes mañana a las 7 a. m. No hay otras existencias disponibles.',
      prompt: '¿Qué instrucciones darías primero a bodega, finanzas y obra? Explica las cifras que usarías y cómo cerrarías la incidencia.',
      followUp: 'Al cierre del día tienes que entregar el caso al siguiente turno. ¿Qué quedaría registrado y qué decisión seguiría pendiente?',
      criteria: [
        {competencyId: 'calidad', anchors: [
          'Autoriza el uso de las unidades dañadas o da conformidad a las 120 basándose únicamente en la remisión.',
          'Separa las unidades dañadas e identifica una diferencia que debe volver a contar o documentar.',
          'Distingue 12 faltantes, ocho dañadas y 100 utilizables. Contrasta el conteo con los documentos, identifica el lote y registra la retención y corrección autorizada.',
        ]},
        {competencyId: 'continuidad', anchors: [
          'Promete despachar las 104 válvulas usando las dañadas o toma como disponible el saldo automático de 120.',
          'Reconoce que hay menos de 104 utilizables y plantea conseguir una reposición o cambiar la secuencia.',
          'Precisa que faltan cuatro utilizables para el retiro. Fija un responsable y un plazo para confirmar reposición, préstamo conforme o reprogramación con obra.',
        ]},
        {competencyId: 'coordinacion', anchors: [
          'Autoriza el pago completo o informa a obra que puede retirar 104 pese al conteo real.',
          'Avisa de la incidencia a bodega, finanzas u obra y asigna una acción inmediata coherente.',
          'Alinea el inventario con bodega, acuerda con finanzas la retención o conciliación del pago y confirma con obra el disponible y el siguiente aviso. Deja un responsable del cierre.',
        ]},
      ],
    },
  ];

  function summarize(reviews = {}) {
    return competencies.map(({id, label}) => {
      let points = 0;
      let reviewed = 0;
      let total = 0;
      for (const scenario of cases) {
        if (!scenario.criteria.some(criterion => criterion.competencyId === id)) continue;
        total++;
        const entry = reviews?.[scenario.id]?.[id];
        if (!entry || !Number.isInteger(entry.score) || entry.score < 0 || entry.score > 2) continue;
        if (typeof entry.evidence !== 'string' || !entry.evidence.trim() || entry.evidence.length > 600) continue;
        reviewed++;
        points += entry.score;
      }
      const max = 2 * reviewed;
      return {id, label, points, max, reviewed, total, percent: max ? Math.round(100 * points / max) : null};
    });
  }

  root.AtlasComprasPilot = Object.freeze({version: 1, profileId: 'procurement', competencies, cases, summarize});
})(globalThis);
