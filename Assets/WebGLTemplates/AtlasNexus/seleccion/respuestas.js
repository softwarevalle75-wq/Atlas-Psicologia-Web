(function (root) {
  'use strict';

  const VERSION = 2;
  const MAX_FOLLOW_UPS = 2;
  const dimensions = [
    {id: 'context', label: 'Situación y restricción', description: 'Describe un problema del cargo y la condición que afectaba la decisión.'},
    {id: 'action', label: 'Acción propia', description: 'Explica qué hiciste tú y en qué concentrabas tu intervención.'},
    {id: 'result', label: 'Resultado concreto', description: 'Expón qué cambió o, en un caso hipotético, qué meta concreta propones.'},
    {id: 'verification', label: 'Cómo comprobarlo', description: 'Relaciona el resultado con un indicador, registro, comparación o prueba que lo pueda respaldar.'},
  ];
  const OPEN_MAX = dimensions.length;

  // The cues support an orientative review in Spanish. They are not competence
  // measurements, employment decisions, or substitutes for the supplied anchors.
  const scenarios = {
    general: {
      topic: /\b(caja|liquidez|inversion(?:es)?|capital|sostenib\w*|plazos?|proyecto\w*|presupuest\w*|contratos?|riesg\w*)\b/u,
      context: '¿Qué restricción de caja, sostenibilidad o plazo condicionaba esa decisión?',
      action: '¿Qué decisión tomaste tú y qué alternativa descartaste?',
      result: '¿Qué cambió en caja, sostenibilidad o plazo después de la decisión?',
      verification: '¿Con qué dato de caja, informe o hito del proyecto comprobarías ese cambio?',
    },
    finance: {
      topic: /\b(caja|liquidez|efectivo|flujo|pagos?|cobros?|vencimient\w*|tesoreria|presupuest\w*|factur\w*|proveedor\w*)\b/u,
      context: '¿Qué movimiento de caja o vencimiento indicó que había un problema?',
      action: '¿Qué decisión tomaste tú para corregir o prevenir ese problema de caja?',
      result: '¿Qué cambió en el saldo, los vencimientos o el riesgo de liquidez?',
      verification: '¿Qué conciliación, registro de tesorería o comparación de saldos usarías para comprobar el efecto?',
    },
    sales: {
      topic: /\b(campan\w*|embud\w*|publicidad|conversion\w*|ventas?|marketing|clientes?|prospect\w*|segment\w*|leads?|crm)\b/u,
      context: '¿En qué etapa de la campaña o del embudo estaba el problema?',
      action: '¿Qué ajuste hiciste tú en el mensaje, la segmentación o el proceso de ventas?',
      result: '¿Qué indicador se movió y cuál fue el valor de partida y el de cierre?',
      verification: '¿Qué comparación o prueba te permitiría atribuir el cambio al ajuste de la campaña?',
    },
    procurement: {
      topic: /\b(suministr\w*|proveedor\w*|insum\w*|obra|material\w*|entreg\w*|inventari\w*|compras?|plazos?)\b/u,
      context: '¿Qué material necesitaba la obra y cuál era el límite de entrega?',
      action: '¿Qué negociaste tú con el proveedor o qué contingencia organizaste?',
      result: '¿Qué cambió en el plazo de entrega, el costo o la calidad?',
      verification: '¿Con qué acta de recepción, orden de compra o registro de entrega lo demostrarías?',
    },
    hr: {
      topic: /\b(seleccion|formacion|clima|contrat\w*|equipos?|rotacion|capacit\w*|encuest\w*|personal|ingresos?)\b/u,
      context: '¿Qué necesidad se observaba en selección, formación o clima laboral?',
      action: '¿Qué intervención coordinaste tú para atender esa necesidad?',
      result: '¿Qué cambio observaste o esperabas medir después de intervenir?',
      verification: '¿Qué comparación o registro usarías para verificar el cambio y cuidar la confidencialidad?',
    },
    projects: {
      topic: /\b(alcance|obras?|cronogram\w*|costo\w*|presupuest\w*|gerencia|plazos?|calidad|client\w*|contratos?|proyecto\w*)\b/u,
      context: '¿Qué cambió en el alcance de la obra y quién pidió el cambio?',
      action: '¿Qué hiciste tú para evaluar los impactos y conseguir la aprobación?',
      result: '¿Qué pasó después con el plazo, el costo o la calidad de la obra?',
      verification: '¿Qué acta o línea base permite contrastar el resultado y la aprobación?',
    },
    quality: {
      topic: /\b(conformidad|defect\w*|calidad|produccion|especificaci\w*|lotes?|causa\w*|suministr\w*|requisit\w*|norma\w*|retrabajo)\b/u,
      context: '¿Qué requisito debía cumplir el proceso y qué observaste que no coincidía?',
      action: '¿Qué hiciste tú para comprobar la causa y corregir el proceso?',
      result: '¿Qué cambió en el proceso después de aplicar la corrección?',
      verification: '¿Qué prueba o registro usarías para confirmar que la corrección sigue siendo eficaz?',
    },
    admin: {
      topic: /\b(solicitu\w*|pendient\w*|tarea\w*|reunion\w*|correos?|document\w*|actas?|agendas?|plazos?|entreg\w*)\b/u,
      context: '¿Qué solicitudes coincidieron y qué plazos o dependencias tenían?',
      action: '¿Qué priorizaste tú y cómo informaste a las personas que esperaban?',
      result: '¿Qué solicitudes quedaron atendidas y en qué plazo?',
      verification: '¿En qué agenda, acta o lista quedaron registrados el seguimiento y el cierre?',
    },
  };

  const generic = {
    topic: /\b(trabajo|proyecto\w*|equipo\w*|tarea\w*|proceso\w*|problema\w*|client\w*)\b/u,
    context: '¿Qué problema encontraste y qué restricción tenía el trabajo?',
    action: '¿Qué hiciste tú para resolverlo?',
    result: '¿Qué cambió después de tu acción?',
    verification: '¿Con qué registro o comparación se podría respaldar ese cambio?',
  };
  const normalize = text => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/gu, ' ').trim();
  const stop = new Set(('a al con de del el en era es esa ese esta este fue ha la lo los las le les me mi mis no nos o para por que se si sobre su sus te tu un una y yo').split(' '));
  const templateTerms = new Set(('contexto accion acciones meta objetivo resultado resultados evidencia evidencias verificable verificacion indicador indicadores situacion competencia dato datos decision problema hecho cumple respuesta respuesta abierta ejemplo situacional').split(' '));
  const contextCue = /\b(habia|teniamos|tenia|faltaba|estaba|estaban|ocurrio|paso|durante|solicito|encontre|observo|debia|debiamos|quedaban|enfrentabamos|enfrente|surgio|se detecto|aplazo|cayo|ven[cç]ia|subia|con un limite|al revisar|mucho antes|al comenzar|recibi|quedaba|les faltaba|no llegaba|se agoto|se retras\w*|aument\w*|procedian|aparecio|pedi\w*)\b/u;
  const priorityCue = /\b(limite|conflicto|falla|atraso|perdida|demora|faltante|urgencia|desfase|interrupcion|reduccion|deficit|diferencia|solapamiento|incumplimiento|riesgo|sin acceso|sin aprobar|fuera de plazo|no conformidad)\b/u;
  const wordPattern = variants => new RegExp('\\b(?:' + variants.join('|') + ')\\b', 'u');
  const actionCue = wordPattern([
    "ajust(?:e|aria)", "acord(?:e|aria)", "actualic(?:e|aria)", "alinee", "analic(?:e|aria)",
    "aprob(?:e|aria)", "arm(?:e|aria)", "asign(?:e|aria)", "audit(?:e|aria)", "avis(?:e|aria)",
    "calcul(?:e|aria)", "cambi(?:e|aria)", "cancel(?:e|aria)", "clasifiqu(?:e|aria)", "compar(?:e|aria)",
    "comuniqu(?:e|aria)", "concili(?:e|aria)", "confirm(?:e|aria)", "contrat(?:e|aria)",
    "coordin(?:e|aria)", "corregi(?:ria)?", "decidi(?:ria)?", "defini(?:ria)?", "delegu(?:e|aria)",
    "descart(?:e|aria)", "detect(?:e|aria)", "detuve", "detendria", "distribui(?:ria)?",
    "document(?:e|aria)", "ejecut(?:e|aria)", "elabor(?:e|aria)", "entregu(?:e|aria)", "escal(?:e|aria)",
    "establ(?:eci|eceria)", "evalu(?:e|aria)", "gener(?:e|aria)", "guard(?:e|aria)", "hice", "haria",
    "identifiqu(?:e|aria)", "implement(?:e|aria)", "inform(?:e|aria)", "investigu(?:e|aria)",
    "limit(?:e|aria)", "medi(?:ria)?", "movi(?:ria)?", "negoci(?:e|aria)", "notifiqu(?:e|aria)",
    "organic(?:e|aria)", "pact(?:e|aria)", "pedi(?:ria)?", "planific(?:e|aria)", "pospus(?:e|iera)",
    "predije", "prepar(?:e|aria)", "prioric(?:e|aria)", "program(?:e|aria)", "propus(?:e|iera)",
    "propondria", "prob(?:e|aria)", "proyect(?:e|aria)", "realic(?:e|aria)", "recotiz(?:e|aria)",
    "reduj(?:e|era)", "reduciria", "registr(?:e|aria)", "rechac(?:e|aria)", "renegoci(?:e|aria)",
    "reorganic(?:e|aria)", "reparti(?:ria)?", "resolvi", "resolveria", "revis(?:e|aria)",
    "segment(?:e|aria)", "separ(?:e|aria)", "solicit(?:e|aria)", "suspendi", "tom(?:e|aria)",
    "tramit(?:e|aria)", "valid(?:e|aria)", "verifiqu(?:e|aria)", "me reuni(?:ria)?", "lo que hice fue",
    "dej(?:e|aria)", "me encargu(?:e|aria)", "planifique",
  ]);
  const resultCue = wordPattern([
    "paso", "subi[oó]", "baj[oó]", "cambi[oó]", "mejor[oó]", "empeor[oó]", "disminuy[oó]", "aument[oó]",
    "reduj(?:e|o|imos|eron)", "ahorr(?:e|o|amos|aron)", "evit(?:e|o|amos|aron)", "obtuv(?:e|o|imos|ieron)",
    "logr(?:e|o|amos|aron)", "cerr(?:e|o|amos|aron)", "alcanz(?:o|amos|aron)", "resolv(?:i|io|imos|ieron)",
    "corrigi(?:o|mos|eron)", "solucion[oó]", "recuper(?:o|amos|aron)", "elimin(?:o|amos|aron)",
    "cumpli(?:o|mos|eron)", "sal(?:io|ieron)", "entreg(?:ue|o|amos|aron)", "lleg(?:o|aron)", "quedo",
    "quedaron", "complet(?:o|amos|aron)", "termin(?:o|amos|aron)", "mantuvo", "freno", "se reduj\\w*",
    "se aprobo", "se mantienen", "se mantuv\\w*", "se cumpli\\w*", "el resultado fue", "la meta seria",
    "mi meta seria", "el objetivo seria", "mostr(?:o|aron)", "quedo constancia", "resultaron", "se decidio",
    "quedo resuelto",
  ]);
  const amounts = /\b(?:\d+(?:[.,]\d+)?|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte)\s*(?:%|por ciento|horas?|puntos?|dias?|semanas?|meses?|millones?|mil|cop\b|pesos?|ventas?|lotes?|pedidos?|tareas?|entregas?|documentos?|solicitudes?|casos?|clientes?|fallas?|defectos?|errores?|proyectos?)/u;
  const comparison = /\bde(?:l)? (?:\d+(?:[.,]\d+)?|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte)(?:\s*(?:%|por ciento|dias?|horas?|pesos?|unidades?|millones?))? a(?:l)? (?:\d+(?:[.,]\d+)?|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte)\b/u;
  const observableOutcome = wordPattern([
    'a tiempo', 'sin pendientes', 'sin retras\\w*', 'sin atras\\w*', 'sin fallas',
    'dentro d(?:el|e los) plazos?', 'antes del corte', 'el plazo acordado', 'el mismo plazo',
    'la inspeccion', 'el requisito', 'las pruebas', 'qued\\w* aprob\\w*', 'aprob\\w* el cambio',
    'cerr\\w* el incidente', 'servicio restablecido', 'respuesta a todos', 'las solicitudes',
  ]);
  const verificationCue = wordPattern([
    "compar(?:e|amos|aria|arian|ando)", "concili(?:e|amos|aria|ando)", "contrast(?:e|amos|aria|ando)",
    "comprob(?:e|amos|aria|ando)", "consult(?:e|amos|aria|ando)", "confirm(?:e|amos|aria|ando)", "audite",
    "cruce", "revise", "revisaria", "medi(?:ria|mos)?", "registre", "registraria", "verifiqu\\w*",
    "verificari\\w*", "valid\\w*", "document\\w*", "qued\\w* registr\\w*", "qued\\w* anot\\w*", "consta",
    "constaba", "constatar\\w*", "segun", "como muestra", "surgio del", "se ve en", "respald\\w*",
    "deje constancia", "dejaria constancia", "hice seguimiento", "contrastaria",
  ]);
  const source = wordPattern([
    'actas?', 'informes?', 'registros?', 'estados?', 'extractos?', 'cronogramas?', 'bitacoras?',
    'ordenes? de compra', 'linea base', 'conciliacion\\w*', 'hojas? de calculo', 'tableros?', 'encuestas?',
    'medicion\\w*', 'crm', 'erp', 'pruebas?', 'auditor\\w*', 'paneles?', 'inventarios?', 'comparativa',
    'tablas?', 'historial', 'correos? de confirmacion', 'agenda', 'reporte\\w*', 'captur\\w*',
    'aprobacion\\w*', 'expedientes?', 'checklist', 'listado', 'tickets?', 'archivo de seguimiento',
  ]);
  const weakList = /\b(?:contexto\s+accion\s+resultado|mucho mucho|bla bla)\b/u;
  const connector = /\b(?:a|al|con|de|del|en|el|la|las|los|un|una|para|por|porque|durante|cuando|segun|mientras|despues|antes)\b/u;

  function usefulWords(text) {
    const words = text.match(/[a-z]+/gu) || [];
    return new Set(words.filter(word => word.length > 2 && !stop.has(word) && !templateTerms.has(word)));
  }

  function isSpecific(text) {
    return !weakList.test(text) && connector.test(text) && usefulWords(text).size >= 4;
  }

  function clauses(answers) {
    return (Array.isArray(answers) ? answers : []).flatMap(answer => {
      if (typeof answer !== 'string') return [];
      return answer.slice(0, 3000).split(/[\r\n]+|[.!?;](?:\s+|$)/gu)
        .map(text => text.trim()).filter(Boolean).map(raw => ({raw, text: normalize(raw)}))
        .filter(clause => isSpecific(clause.text));
    });
  }

  function affirmative(pattern, text, verbOnly = false) {
    const matches = text.matchAll(new RegExp(pattern.source, 'gu'));
    for (const match of matches) {
      const leading = text.slice(Math.max(0, match.index - 42), match.index);
      if (/\b(?:no|nunca|tampoco|ni)(?: (?:lo|la|los|las|se|me|pude|pudimos|logre|llegue|quisimos|quise|podia|a|ni)){0,5} $/u.test(leading)) continue;
      if (verbOnly && /\b(?:el|un|mi|este|ese|su|del|al) $/u.test(leading)) continue;
      return true;
    }
    return false;
  }

  function hasWorkOutcome(text, role) {
    return affirmative(resultCue, text) && (
      comparison.test(text) || amounts.test(text) || (role.topic.test(text) && observableOutcome.test(text))
    );
  }

  function hasVerification(text) {
    if (!affirmative(verificationCue, text)) return false;
    if (source.test(text)) return true;
    return /\b(compar\w*|contrast\w*|cruce|cruzaria|concili\w*)\b/u.test(text) &&
      (comparison.test(text) || (/\b(antes|base|inicio)\b/u.test(text) && /\b(despues|actual|cierre|final)\b/u.test(text)));
  }

  function assess(profile, answers, prompt = '') {
    const scenario = scenarios[profile?.id] || generic;
    const promptTerms = [...usefulWords(normalize(prompt))].filter(word => word.length >= 5);
    const isRelevant = text => {
      if (scenario.topic.test(text)) return true;
      const words = usefulWords(text);
      return promptTerms.filter(word => words.has(word)).length >= 2;
    };
    const parts = clauses(answers);
    const relevant = parts.some(part => isRelevant(part.text));
    const checks = {
      context: text => isRelevant(text) && (contextCue.test(text) || priorityCue.test(text)),
      action: text => affirmative(actionCue, text, true),
      result: text => hasWorkOutcome(text, scenario),
      verification: hasVerification,
    };
    const criteria = dimensions.map(dimension => {
      const witness = relevant && parts.find(part => checks[dimension.id](part.text));
      return {...dimension, met: !!witness, evidence: witness ? witness.raw.slice(0, 200) : ''};
    });
    return {points: criteria.filter(item => item.met).length, max: OPEN_MAX, criteria, complete: criteria.every(item => item.met)};
  }

  function followUp(profile, answers, previous = [], {prompt = '', hypothetical = false} = {}) {
    if (!Array.isArray(previous) || previous.length >= MAX_FOLLOW_UPS) return null;
    const role = hypothetical ? {
      context: '¿Qué condición del caso influiría más en tu decisión?',
      action: '¿Qué harías primero en esa situación y por qué?',
      result: '¿Qué resultado concreto buscarías con esa decisión?',
      verification: '¿Qué dato o registro usarías para comprobar el resultado?',
    } : scenarios[profile?.id] || generic;
    const missing = assess(profile, answers, prompt).criteria.filter(item => !item.met);
    if (missing.length === OPEN_MAX && !previous.includes('detail') && clauses(answers).length === 0) {
      return {id: 'detail', text: hypothetical ? role.context : 'Pensemos en un ejemplo concreto. ' + role.context};
    }
    const next = ['action', 'context', 'result', 'verification'].find(id => !previous.includes(id) && missing.some(item => item.id === id));
    return next ? {id: next, text: role[next]} : null;
  }

  function summarize(assessment) {
    const criteria = Object.fromEntries(dimensions.map(({id}) => [id, assessment.criteria.some(item => item.id === id && item.met === true)]));
    return {version: VERSION, criteria};
  }

  function isSummary(summary) {
    return !!summary && summary.version === VERSION && dimensions.every(({id}) => typeof summary.criteria?.[id] === 'boolean');
  }

  function override(summary, criterionId, met) {
    if (!isSummary(summary) || !dimensions.some(({id}) => id === criterionId) || typeof met !== 'boolean') return summary;
    return {
      version: VERSION,
      criteria: {...summary.criteria, [criterionId]: met},
      reviewed: {...summary.reviewed, [criterionId]: true},
    };
  }

  function combine(closed, summary) {
    if (!isSummary(summary)) return {...closed, open: null};
    const openPoints = summaryPoints(summary);
    const points = closed.points + openPoints;
    const max = closed.max + OPEN_MAX;
    return {...closed, points, max, percent: Math.round(100 * points / max), open: {
      points: openPoints, max: OPEN_MAX, percent: Math.round(100 * openPoints / OPEN_MAX),
    }};
  }

  function summaryPoints(summary) {
    return dimensions.reduce((points, {id}) => points + Number(summary.criteria[id]), 0);
  }

  root.AtlasOpenResponse = Object.freeze({
    VERSION, OPEN_MAX, MAX_FOLLOW_UPS, assess, followUp, summarize, isSummary, override, combine, summaryPoints,
  });
})(globalThis);
