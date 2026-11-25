/* Contenido original de la práctica INNOVARQ. Referencias de página según la ficha del cargo. */
(function () {
  'use strict';

  function item(id, group, skill, prompt, options) {
    return { id, group, skill, prompt, options: options.map(([text, points, note]) => ({ text, points, note })) };
  }

  window.AtlasHiringProfiles = [
    {
      id: 'general',
      title: 'Gerente General',
      pages: [1, 2, 3],
      education: 'Administración de Empresas, Ingeniería Industrial o formación similar. MBA o formación ejecutiva deseable.',
      educationTerms: ['administración de empresas', 'ingeniería industrial', 'administración empresarial'],
      years: 10,
      experience: 'Mínimo 10 años en cargos ejecutivos con desarrollo de negocios, planificación estratégica y gestión de operaciones.',
      objective: 'Dirigir la estrategia de vivienda sostenible y coordinar operaciones, alianzas y gestión de riesgos.',
      evidence: [
        { label: 'Estrategia y desarrollo de negocios', terms: ['plan estratégico', 'planificación estratégica', 'desarrollo de negocios', 'estrategia corporativa'] },
        { label: 'Gestión financiera y viabilidad', terms: ['presupuesto', 'modelado financiero', 'viabilidad', 'flujo de caja', 'rentabilidad'] },
        { label: 'Gestión operativa y de proyectos', terms: ['gestión de operaciones', 'gerencia de proyectos', 'lean construction', 'bim', 'erp'] },
        { label: 'Sostenibilidad, riesgos o alianzas', terms: ['construcción sostenible', 'vivienda sostenible', 'evaluación de riesgos', 'alianza estratégica', 'negociación de contratos'] }
      ],
      questions: [
        item('general-inversion', 'hard', 'Viabilidad y liquidez', 'Hay 900 millones COP de caja y una reserva mínima de 200. El piloto A exige 760 y aporta 160 en el primer año. El piloto B exige 650 y aporta 125. Ambos cumplen los requisitos técnicos. ¿Qué elevarías al comité?', [
          ['El piloto A por su mayor aporte anual.', 0, 'Deja 140 disponibles, por debajo de la reserva de 200.'],
          ['El piloto B y un análisis de sensibilidad antes de comprometer capital.', 2, 'B deja 250, cumple la reserva y permite revisar el riesgo del proyecto.'],
          ['A con financiamiento por validar y sin emitir todavía una orden de compra.', 1, 'Reconoce el problema de liquidez. Falta un escenario financiable confirmado.']
        ]),
        item('general-indicadores', 'hard', 'Gestión estratégica', 'La meta es entregar viviendas sostenibles a tiempo. ¿Qué tablero mensual usarías para decidir ajustes?', [
          ['Avance del cronograma, costo proyectado y consumo de energía frente a metas verificables, con responsables.', 2, 'Relaciona la entrega con el costo y el desempeño sostenible.'],
          ['Cronograma y presupuesto por proyecto.', 1, 'Permite ver plazo y costo. Falta medir el objetivo de sostenibilidad.'],
          ['Número de reuniones y publicaciones de la empresa.', 0, 'Mide actividad y deja sin seguimiento los resultados del proyecto.']
        ]),
        item('general-liderazgo', 'soft', 'Liderazgo interáreas', 'Finanzas plantea recortar un componente. Diseño advierte que el cambio reduce el desempeño energético. ¿Cómo conduces la decisión?', [
          ['Pido a cada área una recomendación escrita y pospongo la decisión sin fijar fecha.', 1, 'Recoge perspectivas. Falta un mecanismo de resolución y seguimiento.'],
          ['Autorizo el recorte con la cifra de ahorro y aviso a Diseño tras la compra.', 0, 'La decisión omite el efecto técnico y deja a Diseño sin oportunidad de intervenir.'],
          ['Reúno a ambas áreas, fijo requisitos comunes y comparo alternativas de costo, energía y plazo con una fecha de decisión.', 2, 'Construye una decisión conjunta, trazable y centrada en los requisitos.']
        ]),
        item('general-alianza', 'soft', 'Negociación responsable', 'Un inversor exige anunciar entregas en una fecha aún no respaldada por el cronograma. ¿Qué respondes?', [
          ['Expongo los hitos confirmados y propongo un compromiso condicionado con revisiones acordadas.', 2, 'Protege la confianza y ofrece una alternativa negociable, medible y realista.'],
          ['Acepto la fecha y pido al equipo que la cumpla después de anunciarla.', 0, 'Compromete al equipo sin evidencia de viabilidad.'],
          ['Evito comprometer la fecha y pido más tiempo para revisar el cronograma.', 1, 'Evita una promesa infundada. Falta acordar el siguiente paso con el inversor.']
        ])
      ],
      open: {
        prompt: 'Cuéntame una decisión ejecutiva en la que debiste equilibrar caja, sostenibilidad y plazo. Describe la situación, tu decisión y un resultado que se pudo verificar.',
        anchors: ['Describe un contexto general y deja sin precisar su decisión.', 'Explica su decisión y una condición del negocio que consideró.', 'Expone alternativas y condiciones, atribuye su decisión y aporta un resultado con indicador o registro verificable.']
      }
    },
    {
      id: 'finance',
      title: 'Gerente de Finanzas (CFO)',
      pages: [4, 5, 6],
      education: 'Finanzas, Contabilidad o Economía. Maestría o certificación como CPA preferible.',
      educationTerms: ['finanzas', 'contabilidad', 'contaduría', 'economía'],
      years: 8,
      experience: 'Mínimo 8 años en gestión financiera y contable. Se prefiere experiencia en construcción o tecnología.',
      objective: 'Gestionar la liquidez, la rentabilidad, los riesgos y la asignación de recursos financieros.',
      evidence: [
        { label: 'Información financiera y contabilidad', terms: ['estados financieros', 'contabilidad', 'reportes financieros', 'informes financieros', 'cierre contable'] },
        { label: 'Liquidez o tesorería', terms: ['tesorería', 'liquidez', 'flujo de caja', 'capital de trabajo'] },
        { label: 'Presupuesto y evaluación de inversiones', terms: ['presupuesto', 'van', 'tir', 'modelado financiero', 'evaluación de inversiones'] },
        { label: 'Control interno y gestión de riesgos', terms: ['control interno', 'segregación de funciones', 'riesgo financiero', 'auditoría financiera'] }
      ],
      questions: [
        item('finanzas-liquidez', 'hard', 'Flujo de caja', 'La caja inicial es de 420 millones COP, los cobros confirmados suman 180 y los pagos 505. La reserva mínima es de 120. ¿Qué reportas?', [
          ['Caja final de 95 y brecha de 25. Preparo una previsión y alternativas para cubrirla antes de los pagos.', 2, 'Calcula 420 + 180 − 505 = 95 y 120 − 95 = 25. Actúa sobre el faltante.'],
          ['Caja final de 95. Como es positiva, no reviso la reserva.', 1, 'El saldo es correcto. Ignora el mínimo de caja requerido.'],
          ['Caja final de 600. Los pagos pueden quedar fuera del cálculo.', 0, 'La previsión requiere incluir egresos confirmados.']
        ]),
        item('finanzas-control', 'hard', 'Control interno', 'Una persona puede cambiar la cuenta bancaria de un proveedor y autorizar el pago. ¿Qué control aplicas?', [
          ['Requiero una firma digital de la misma persona para ambas operaciones.', 0, 'La firma deja registro, pero no separa las responsabilidades.'],
          ['Reviso al cierre del mes las operaciones que esa persona realizó.', 1, 'Detecta cambios a posteriori. El pago se podría ejecutar antes de la revisión.'],
          ['Separo autorización y modificación, confirmo el cambio por un canal conocido y guardo trazabilidad.', 2, 'Previene la ejecución unilateral y deja evidencia revisable.']
        ]),
        item('finanzas-comunica', 'soft', 'Comunicación financiera', 'El margen cayó y necesitas presentar el problema a jefes de obra que no trabajan con estados financieros. ¿Cómo lo explicas?', [
          ['Envío el estado de resultados completo y les pido que lo interpreten.', 0, 'Transfiere datos y deja sin aclarar su impacto ni las decisiones necesarias.'],
          ['Muestro las dos desviaciones principales con ejemplos y cierro con acciones, responsables y fecha de revisión.', 2, 'Traduce los datos en acciones y verifica quién hará el seguimiento.'],
          ['Comparo margen real y presupuesto con un gráfico.', 1, 'Ubica la desviación. Falta explicar sus causas y acordar acciones.']
        ]),
        item('finanzas-acuerdo', 'soft', 'Negociación interáreas', 'Dos áreas necesitan pagar esta semana y la caja no alcanza. ¿Cómo construyes un acuerdo?', [
          ['Convoco a ambas con el flujo, priorizo vencimientos y riesgos, y acuerdo qué reprogramar con responsables.', 2, 'Combina evidencia, escucha y compromisos verificables.'],
          ['Divido la caja por mitades sin revisar condiciones de los pagos.', 0, 'Una distribución pareja no refleja vencimientos o impactos distintos.'],
          ['Pido a cada área que identifique pagos aplazables y espero sus listados.', 1, 'Recoge datos. Falta comparar impactos y cerrar el calendario.']
        ])
      ],
      open: {
        prompt: 'Describe un problema real o simulado de caja. Explica cómo lo detectaste, qué hiciste y cómo verificaste el efecto de tu decisión.',
        anchors: ['Menciona un problema de caja sin cifras ni acción propia.', 'Usa un dato para explicar su acción o una medida de seguimiento.', 'Identifica el riesgo con datos, explica su acción y presenta un resultado o control contrastable.']
      }
    },
    {
      id: 'sales',
      title: 'Gerente de Ventas y Marketing',
      pages: [7, 8, 9],
      education: 'Marketing, Comunicación, Administración de Empresas o formación afín.',
      educationTerms: ['marketing', 'mercadeo', 'comunicación', 'administración de empresas'],
      years: 5,
      experience: 'La ficha indica 5 a 8 años en ventas y marketing. Se prefieren bienes raíces, construcción o mercados afines.',
      objective: 'Posicionar la marca, ampliar la cartera de clientes y convertir oportunidades en ventas sostenibles.',
      evidence: [
        { label: 'Gestión comercial y embudo', terms: ['crm', 'embudo', 'prospectos', 'equipo comercial', 'gestión comercial'] },
        { label: 'Investigación y segmentación de mercado', terms: ['segmentación', 'investigación de mercado', 'análisis de mercado', 'perfil del cliente'] },
        { label: 'Marketing digital o asignación de presupuesto', terms: ['campaña digital', 'marketing digital', 'presupuesto comercial', 'adquisición'] },
        { label: 'Resultados de ventas', terms: ['tasa de cierre', 'conversión', 'costo de adquisición', 'ventas incrementales', 'crecimiento de ventas'] }
      ],
      questions: [
        item('ventas-adquisicion', 'hard', 'Costo de adquisición', 'El canal A costó 6 millones COP y generó 3 ventas. B costó 8 millones y logró 5. Si ambos tienen el mismo margen promedio por venta, ¿cuál muestra menor costo de adquisición?', [
          ['A, porque su gasto total es inferior.', 0, 'El gasto por canal no equivale al gasto medio por venta.'],
          ['B, con 1,6 millones por venta frente a 2 millones de A. Verifico atribución antes de reasignar presupuesto.', 2, 'Calcula el costo por venta para ambas campañas y comprueba comparabilidad.'],
          ['B, porque vendió más, sin calcular el costo por venta.', 1, 'Identifica el canal correcto. Falta el cálculo que respalda la decisión.']
        ]),
        item('ventas-crm', 'hard', 'Gestión de CRM', 'De 200 prospectos, 80 agendan visita, 40 visitan y 20 compran. ¿Dónde está la menor conversión entre etapas?', [
          ['Entre prospecto y visita agendada, con 40%. Reviso calidad y tiempo del primer contacto.', 2, 'Los pasos siguientes convierten al 50%; la primera transición tiene el 40%.'],
          ['Entre visita y compra, porque allí quedan 20 personas.', 0, 'Confunde el número final con un porcentaje de transición.'],
          ['El resultado total es 10%. Analizaría cada etapa antes de proponer cambios.', 1, 'Calcula la conversión global. Falta identificar la transición crítica.']
        ]),
        item('ventas-cliente', 'soft', 'Comunicación con clientes', 'Un cliente pide un ahorro energético exacto para reservar una vivienda. Solo tienes una estimación con supuestos. ¿Qué dices?', [
          ['Doy un valor único y lo anuncio como ahorro garantizado.', 0, 'Crea una expectativa que los datos disponibles no respaldan.'],
          ['Digo que la cifra es aproximada y ofrezco enviar el folleto.', 1, 'Reconoce la incertidumbre. Falta explicar qué afecta el resultado.'],
          ['Explico el rango y sus condiciones, aclaro lo que puede verificarse y ofrezco soporte técnico.', 2, 'Comunica el valor sin ocultar los supuestos ni prometer más de lo medido.']
        ]),
        item('ventas-equipos', 'soft', 'Coordinación comercial', 'Ventas promete un acabado que producción todavía no puede confirmar. ¿Cómo corriges la situación?', [
          ['Verifico opciones con producción, acuerdo un plazo y comunico al cliente las alternativas confirmadas.', 2, 'Coordina la capacidad operativa y gestiona la expectativa con claridad.'],
          ['Mantengo la promesa y pido que producción la resuelva después.', 0, 'Repite el compromiso sin comprobar capacidad.'],
          ['Escalo la discrepancia a gerencia y pido una decisión.', 1, 'Identifica que hace falta resolver. Falta recopilar opciones y atender al cliente.']
        ])
      ],
      open: {
        prompt: 'Cuéntame sobre una campaña o un embudo que mejoraste. ¿Qué indicador cambió, qué ajustaste personalmente y cuál fue el resultado?',
        anchors: ['Describe la campaña de forma genérica.', 'Señala una acción propia y al menos un dato de partida o cierre.', 'Vincula el problema con una acción propia y compara el resultado con una línea base o una prueba controlada.']
      }
    },
    {
      id: 'procurement',
      title: 'Gerente de Compras y Logística',
      pages: [10, 11, 12],
      education: 'Ingeniería Industrial, Administración de Empresas, Logística o áreas relacionadas.',
      educationTerms: ['ingeniería industrial', 'administración de empresas', 'logística', 'ingeniería logística'],
      years: 5,
      experience: 'La ficha indica 5 a 8 años en compras o logística en construcción o manufactura.',
      objective: 'Asegurar el suministro oportuno, reducir costos y coordinar compras sostenibles para los proyectos.',
      evidence: [
        { label: 'Compras y negociación con proveedores', terms: ['compras', 'negociación con proveedores', 'adquisiciones', 'evaluación de proveedores'] },
        { label: 'Inventarios y logística', terms: ['inventario', 'cadena de suministro', 'gestión logística', 'nivel de servicio', 'punto de pedido'] },
        { label: 'Análisis de costos o software de suministro', terms: ['costo total', 'análisis de costos', 'erp', 'gestión de almacenes'] },
        { label: 'Calidad o trazabilidad de suministros', terms: ['trazabilidad', 'calidad de proveedores', 'recepción de materiales', 'control de suministros'] }
      ],
      questions: [
        item('compras-costos', 'hard', 'Costo total y plazo', 'Se necesitan 500 unidades antes del viernes. A cobra 94 mil COP por unidad y 2,2 millones de transporte, con entrega el jueves. B cobra 98 mil y 0,2 millones de transporte, con entrega el lunes siguiente. Ambos cumplen la especificación. ¿Qué eliges?', [
          ['A, solo porque su precio unitario es menor.', 1, 'Llega a tiempo, pero comparar solo el precio unitario oculta el costo total.'],
          ['B, porque su transporte cuesta menos.', 0, 'B incumple el plazo y cuesta lo mismo que A en total.'],
          ['A. Ambos cuestan 49,2 millones en total, pero A cumple el plazo.', 2, 'Compara el costo integral y atiende la restricción operativa.']
        ]),
        item('compras-inventario', 'hard', 'Punto de pedido', 'Se consumen 20 unidades por día. El proveedor tarda 5 días y se requieren 30 unidades de seguridad. ¿Cuándo se genera la orden?', [
          ['Al llegar a 130 unidades de posición de inventario.', 2, '20 × 5 + 30 = 130. Incluye la cobertura del plazo y el stock de seguridad.'],
          ['Al llegar a 100 unidades.', 1, 'Cubre el plazo nominal y omite el stock de seguridad.'],
          ['Al llegar a 30 unidades.', 0, 'Confunde la reserva con el punto de pedido.']
        ]),
        item('compras-proveedor', 'soft', 'Negociación de contingencia', 'Un proveedor anuncia que la entrega completa se atrasará tres días. ¿Qué negocias primero?', [
          ['Solicito un descuento por el atraso y dejo la recuperación del plazo para después.', 1, 'Atiende el costo. La continuidad de obra sigue sin resolverse.'],
          ['Le exijo mantener la fecha original sin revisar alternativas.', 0, 'No identifica un plan viable para sostener el suministro.'],
          ['Valido qué cantidad evita parar la obra y acuerdo entregas parciales con confirmación y plan de respaldo.', 2, 'Prioriza la continuidad y acuerda compromisos verificables.']
        ]),
        item('compras-calidad', 'soft', 'Coordinación con obra', 'Obra solicita sustituir un material sin aprobación técnica para recuperar el cronograma. ¿Qué haces?', [
          ['Compro el sustituto y pido la aprobación cuando llegue.', 0, 'Crea un compromiso antes de comprobar equivalencia y documentación.'],
          ['Pido a calidad y obra evaluar equivalencia y riesgo, y confirmo una alternativa aprobada con plazo.', 2, 'Mantiene la continuidad y respeta la revisión técnica y de calidad.'],
          ['Detengo la compra y aviso a obra que aún no hay autorización.', 1, 'Evita una compra indebida. Falta coordinar la solución y el plazo.']
        ])
      ],
      open: {
        prompt: 'Relata una interrupción de suministro. ¿Qué necesitaba obra, qué negociaste y qué resultados obtuviste en plazo, costo o calidad?',
        anchors: ['Describe el atraso sin explicar una intervención propia.', 'Explica una medida de contingencia y el criterio que utilizó.', 'Expone su negociación, la restricción crítica y el resultado registrado en plazo, costo o calidad.']
      }
    },
    {
      id: 'hr',
      title: 'Gerente de Recursos Humanos',
      pages: [13, 14, 15],
      education: 'Recursos Humanos, Psicología, Administración o áreas afines.',
      educationTerms: ['recursos humanos', 'gestión humana', 'psicología', 'administración'],
      years: 5,
      experience: 'La ficha indica 5 a 7 años en recursos humanos. Se prefiere experiencia en industrias técnicas o de construcción.',
      objective: 'Atraer, desarrollar y retener talento, y fortalecer el clima laboral de INNOVARQ.',
      evidence: [
        { label: 'Selección y gestión de talento', terms: ['selección de personal', 'reclutamiento', 'entrevista estructurada', 'gestión de talento', 'gestión humana'] },
        { label: 'Métricas, clima y retención', terms: ['rotación', 'clima laboral', 'retención', 'indicadores de talento', 'people analytics', 'hris'] },
        { label: 'Desempeño y formación', terms: ['evaluación del desempeño', 'capacitación', 'plan de formación', 'desarrollo profesional'] },
        { label: 'Políticas laborales o negociación', terms: ['legislación laboral', 'políticas de recursos humanos', 'negociación laboral', 'negociación sindical', 'relaciones laborales'] }
      ],
      questions: [
        item('rrhh-rotacion', 'hard', 'Indicadores de talento', 'La dotación media trimestral fue de 40 personas y hubo 5 salidas. ¿Qué tasa informas y cómo la investigas?', [
          ['12,5% y comparo períodos con la misma definición, desagregando motivos en grupos que protejan la confidencialidad.', 2, 'Divide las salidas por la dotación media y propone un análisis comparable.'],
          ['5% porque salieron cinco personas.', 0, 'Confunde un conteo con la proporción respecto a la dotación.'],
          ['12,5% y recomendaría una acción única para toda la empresa.', 1, 'Calcula bien. Falta contrastar las causas antes de definir la intervención.']
        ]),
        item('rrhh-seleccion', 'hard', 'Diseño de selección', 'Debes evaluar aspirantes a un cargo técnico en dos jornadas. ¿Cómo haces comparables las decisiones?', [
          ['Uso una guía común, pero ajusto los criterios tras leer los currículos de cada jornada.', 1, 'Estandariza las preguntas. Cambiar los criterios reduce la comparabilidad.'],
          ['Defino criterios del cargo, uso la misma prueba y preguntas, y registro cada observación con la misma escala.', 2, 'Permite comparar evidencia pertinente de ambas jornadas de forma consistente.'],
          ['Pido a cada entrevistador que elija preguntas y decida por impresión general.', 0, 'La impresión general no facilita contrastar evidencias entre aspirantes.']
        ]),
        item('rrhh-conflicto', 'soft', 'Escucha y manejo de conflictos', 'Una persona reporta un conflicto con su jefatura y teme represalias. ¿Cuál es el primer paso?', [
          ['Pido al equipo completo que debata si la queja es válida.', 0, 'Expone a la persona y dificulta que relate los hechos con tranquilidad.'],
          ['Escucho en privado y prometo revisar el asunto sin acordar cómo informar avances.', 1, 'Cuida el contexto inicial. Falta explicar el proceso y el seguimiento.'],
          ['Escucho en privado, aclaro el alcance de la confidencialidad y documento hechos y próximos pasos.', 2, 'Protege el reporte, centra la conversación en hechos y ofrece seguimiento claro.']
        ]),
        item('rrhh-cambio', 'soft', 'Colaboración y gestión del cambio', 'Un equipo de obra considera que una nueva capacitación interrumpe sus turnos y no aporta valor. ¿Cómo la implementas?', [
          ['Acuerdo momentos y casos relevantes con la jefatura y el equipo, hago un piloto y ajusto con sus observaciones.', 2, 'Integra la necesidad operativa y usa el piloto para mejorar la formación.'],
          ['Aplazo el programa hasta que el equipo lo solicite.', 1, 'Evita interferir hoy. Falta validar la necesidad y acordar una alternativa.'],
          ['Impongo el mismo horario para todos y comunico que la asistencia basta.', 0, 'No aborda la barrera operativa ni evalúa el aprendizaje.']
        ])
      ],
      open: {
        prompt: 'Describe una mejora de selección, formación o clima laboral. ¿Qué necesidad se observó, qué hiciste y cómo mediste el cambio?',
        anchors: ['Enumera actividades sin describir su intervención.', 'Explica una intervención y una forma de medirla.', 'Relaciona la intervención con una necesidad demostrada y compara resultados con un seguimiento que preserve la confidencialidad.']
      }
    },
    {
      id: 'projects',
      title: 'Gerente de Proyectos',
      pages: [16, 17, 18],
      education: 'Ingeniería Civil, Arquitectura o Gestión de Proyectos. PMP deseable.',
      educationTerms: ['ingeniería civil', 'arquitectura', 'gestión de proyectos', 'gerencia de proyectos'],
      years: 7,
      experience: 'Mínimo 7 años gestionando proyectos de construcción o tecnologías modulares.',
      objective: 'Planificar, ejecutar y cerrar proyectos sostenibles en plazo, con control del presupuesto, la calidad y la seguridad.',
      evidence: [
        { label: 'Alcance, cronograma y control de avance', terms: ['alcance', 'cronograma', 'ruta crítica', 'hitos', 'planificación de proyectos'] },
        { label: 'Presupuesto o gestión de contratos', terms: ['presupuesto de obra', 'control de costos', 'gestión de contratos', 'valor ganado'] },
        { label: 'Construcción o tecnologías modulares', terms: ['construcción', 'obra civil', 'prefabricación', 'construcción modular', 'tecnologías modulares'] },
        { label: 'Calidad, seguridad o manejo de riesgos', terms: ['control de calidad', 'matriz de riesgos', 'supervisión de obra', 'seguridad en obra', 'control de cambios'] }
      ],
      questions: [
        item('proyectos-ruta', 'hard', 'Ruta crítica', 'Cimentación (3 días) y fabricación (5 días) empiezan juntas. Luego el montaje (4 días) espera a ambas. ¿Cuánto dura el plan y cuál línea determina el plazo?', [
          ['12 días, porque sumo las tres duraciones.', 0, 'Las dos primeras actividades se ejecutan en paralelo.'],
          ['9 días, con fabricación y montaje en la línea crítica.', 2, 'La rama de 5 días es la más larga antes de los 4 días de montaje.'],
          ['9 días, con control diario de todas las tareas sin distinguir holguras.', 1, 'La duración es correcta. Falta identificar la rama que condiciona la fecha.']
        ]),
        item('proyectos-cambio', 'hard', 'Control de presupuesto y alcance', 'El cliente solicita un acabado adicional. El presupuesto aprobado es 600 millones COP y la orden agregaría 30 millones. No hay contingencia disponible. ¿Cómo procedes?', [
          ['Registro 630 millones como nueva base una vez que se instale el acabado.', 0, 'Modifica la línea base sin una autorización previa.'],
          ['Estimo el costo y el efecto en plazo, y envío una orden de cambio para aprobación antes de ejecutar.', 2, 'Mantiene trazabilidad de costo, alcance y autoridad.'],
          ['Presento el precio de 30 millones y espero respuesta sin actualizar cronograma.', 1, 'Hace visible el costo. Falta analizar el impacto en las entregas.']
        ]),
        item('proyectos-equipos', 'soft', 'Coordinación multidisciplinaria', 'Arquitectura e ingeniería validaron cambios distintos en un módulo. El contratista espera instrucciones hoy. ¿Qué haces?', [
          ['Reúno líderes, contrasto las versiones y publico el acuerdo en un plano autorizado con responsable y fecha.', 2, 'Cierra el conflicto técnico con una única instrucción trazable.'],
          ['Envío las dos versiones al contratista para que elija la más fácil.', 0, 'Traslada una decisión que debe resolver el equipo responsable.'],
          ['Pauso la instrucción y pido comentarios separados de ambas áreas.', 1, 'Evita la ejecución con dudas. Falta resolver y publicar una versión autorizada.']
        ]),
        item('proyectos-seguridad', 'soft', 'Decisión bajo presión', 'Un contratista te pide continuar el montaje con una barrera de seguridad retirada para evitar un día de atraso. ¿Qué haces?', [
          ['Autorizo seguir y pido tener cuidado mientras se repone la barrera.', 0, 'Expone a las personas al riesgo durante la operación.'],
          ['Suspendo la tarea hasta recuperar la condición segura y aviso al responsable.', 1, 'Actúa sobre el riesgo. Falta organizar reanudación y comunicar el impacto de plazo.'],
          ['Detengo la tarea, coordino una reanudación segura con el responsable y reprogramo otras actividades del equipo.', 2, 'Protege al equipo y gestiona el cronograma con acciones verificables.']
        ])
      ],
      open: {
        prompt: 'Cuenta cómo gestionaste un cambio de alcance de obra. ¿Cómo mediste plazo, costo y calidad, quién aprobó y qué pasó después?',
        anchors: ['Describe un cambio sin explicar evaluación ni coordinación.', 'Explica su contribución y un impacto que midió.', 'Describe los impactos y la aprobación, comunica su acción y documenta el resultado frente a la línea base.']
      }
    },
    {
      id: 'quality',
      title: 'Ingeniero de Calidad / Auditor de Procesos',
      pages: [19, 20, 21],
      education: 'Ingeniería en Calidad, Ingeniería Industrial o similar.',
      educationTerms: ['ingeniería en calidad', 'ingeniería de calidad', 'ingeniería industrial', 'gestión de calidad'],
      years: 5,
      experience: 'La ficha indica 5 a 7 años en control de calidad en construcción o manufactura.',
      objective: 'Verificar el cumplimiento de los estándares de calidad, auditar procesos y promover la mejora continua.',
      evidence: [
        { label: 'Auditorías y gestión de calidad', terms: ['auditoría', 'auditorias', 'iso 9001', 'sistema de gestión de calidad', 'control de calidad'] },
        { label: 'Causas y acciones correctivas', terms: ['causa raíz', 'acción correctiva', 'no conformidad', 'no conformidades', '5 porqués'] },
        { label: 'Procesos de obra o manufactura', terms: ['inspección de obra', 'procesos de construcción', 'manufactura', 'lote'] },
        { label: 'Indicadores y mejora continua', terms: ['mejora continua', 'tasa de defectos', 'control estadístico', 'indicadores de calidad', 'pareto'] }
      ],
      questions: [
        item('calidad-tasa', 'hard', 'Análisis de defectos', 'Antes había 18 piezas con defecto en 120 inspeccionadas. Después hubo 9 piezas con defecto en 60. ¿Qué concluyes sobre la proporción observada?', [
          ['La tasa observada sigue en 15%. Falta evidencia de una mejora en esa proporción.', 2, 'Compara 18/120 y 9/60. El número de inspecciones también se redujo a la mitad.'],
          ['La tasa bajó a la mitad porque hubo nueve defectos en lugar de 18.', 0, 'Compara conteos sin considerar que hubo menos inspecciones.'],
          ['El conteo bajó. Revisaría cuántas piezas se inspeccionaron antes de afirmar que mejoró.', 1, 'Reconoce el problema del denominador. Falta calcular la tasa con los datos disponibles.']
        ]),
        item('calidad-auditoria', 'hard', 'Trazabilidad de auditoría', 'La especificación interna exige un registro de inspección antes de liberar un lote. Dos lotes liberados no muestran ese registro. ¿Cómo actúas?', [
          ['Concluyo que todas las piezas del proceso están defectuosas.', 0, 'Un registro ausente evidencia un incumplimiento documental, no un defecto de todas las piezas.'],
          ['Documento los lotes y la evidencia, y solicito una segunda búsqueda del registro.', 1, 'Recoge hechos. Falta gestionar la no conformidad y la disposición de los lotes.'],
          ['Registro criterio, lotes y evidencia. Coordino la disposición de los lotes y verifico la acción correctiva.', 2, 'Vincula el requisito con evidencia y seguimiento verificable.']
        ]),
        item('calidad-queja', 'soft', 'Comunicación de hallazgos', 'Producción rechaza un hallazgo porque cree que se está culpando a su equipo. ¿Cómo respondes?', [
          ['Presento el requisito y la evidencia, escucho el contexto y acuerdo buscar la causa del proceso.', 2, 'Mantiene la conversación en observaciones comprobables y facilita colaboración.'],
          ['Dejo el hallazgo por escrito y pido comentarios para más tarde.', 1, 'Preserva el registro. Falta abordar la preocupación y acordar el siguiente paso.'],
          ['Identifico responsables por nombre para que el equipo acepte el hallazgo.', 0, 'Centra la discusión en la culpa y dificulta investigar el proceso.']
        ]),
        item('calidad-plazo', 'soft', 'Independencia y coordinación', 'Te piden cerrar una no conformidad antes de verificar si la corrección funciona. Hay una entrega próxima. ¿Qué haces?', [
          ['La cierro porque la corrección ya fue prometida.', 0, 'Cerrar sin evidencia debilita el seguimiento del hallazgo.'],
          ['Mantengo el hallazgo abierto y acuerdo contención, responsables y comprobación con el equipo.', 2, 'Cuida la trazabilidad y aporta un plan para resolver la entrega.'],
          ['Mantengo el hallazgo abierto y remito el asunto a mi jefatura.', 1, 'Conserva la independencia. Falta coordinar la contención y la verificación.']
        ])
      ],
      open: {
        prompt: 'Describe una no conformidad que hayas investigado o cómo resolverías una en el simulador. Cuenta qué criterio aplicaste, la causa y cómo verificaste el resultado.',
        anchors: ['Menciona un defecto sin vincularlo con un requisito o un seguimiento.', 'Identifica un requisito y una acción respaldada por evidencia.', 'Conecta requisito, evidencia, causa comprobable y un indicador de eficacia de la acción.']
      }
    },
    {
      id: 'admin',
      title: 'Asistente Administrativo',
      pages: [22, 23, 24],
      education: 'Técnico en Administración, Asistencia de Gerencia o formación afín.',
      educationTerms: ['técnico en administración', 'tecnólogo en administración', 'asistencia de gerencia', 'gestión administrativa', 'asistencia administrativa'],
      years: null,
      experience: 'Experiencia por confirmar. La ficha repite un requisito de control de calidad y un cargo previo de Dirección de Proyectos.',
      objective: 'Apoyar la gestión documental, coordinar agendas y atender a clientes en la operación diaria.',
      evidence: [
        { label: 'Gestión de documentos y archivo', terms: ['gestión documental', 'archivo', 'radicación', 'digitalización', 'control documental'] },
        { label: 'Coordinación de agendas', terms: ['gestión de agendas', 'coordinación de agendas', 'agenda', 'programación de reuniones'] },
        { label: 'Atención a clientes y apoyo operativo', terms: ['atención a clientes', 'atención al cliente', 'servicio al cliente', 'apoyo administrativo'] },
        { label: 'Revisión y trazabilidad de registros', terms: ['revisión de documentos', 'control de versiones', 'registro de correspondencia', 'trazabilidad documental'] }
      ],
      questions: [
        item('admin-documento', 'hard', 'Control documental', 'Debes enviar el acta aprobada. Tienes el borrador v4 sin firma y el archivo v3 firmado que figura como aprobado en el registro. ¿Cuál envías?', [
          ['El v4 porque tiene el número de revisión más alto.', 0, 'Una versión más nueva puede seguir en borrador.'],
          ['El v3 después de revisar su firma y registro. Conservo el v4 etiquetado como borrador.', 2, 'Selecciona el documento autorizado y mantiene trazabilidad.'],
          ['El v3 por la firma, sin revisar el registro de aprobación.', 1, 'Reconoce una señal útil. Falta confirmar que sigue siendo la versión vigente.']
        ]),
        item('admin-agenda', 'hard', 'Coordinación de agenda', 'Finanzas y Proyectos necesitan reunirse 30 minutos antes del mediodía. Finanzas puede de 10:00 a 11:00 y Proyectos de 10:30 a 11:30. ¿Qué bloque confirmas?', [
          ['10:30 a 11:00, comprobando los calendarios y enviando la convocatoria.', 2, 'Encuentra el bloque común completo y comunica la reserva.'],
          ['10:30 a 10:45 y pido a las áreas que ajusten la reunión.', 1, 'Usa parte del bloque común. La duración queda por debajo de lo requerido.'],
          ['11:00 a 11:30 porque Proyectos está disponible.', 0, 'El bloque queda fuera de la disponibilidad de Finanzas.']
        ]),
        item('admin-cliente', 'soft', 'Atención al cliente', 'Una clienta solicita una respuesta que depende de un área técnica. Aún no tienes el dato. ¿Qué dices?', [
          ['Confirmo que recibí la consulta y la remito sin establecer una fecha de seguimiento.', 1, 'Reconoce y deriva la consulta. Falta acordar cuándo recibirá noticias.'],
          ['Doy un dato estimado como si estuviera confirmado.', 0, 'Aumenta el riesgo de entregar información incorrecta.'],
          ['Confirmo el alcance, gestiono la consulta y le doy un plazo concreto para informarle el estado.', 2, 'Mantiene informada a la clienta sin inventar una respuesta técnica.']
        ]),
        item('admin-priorizacion', 'soft', 'Priorización y comunicación', 'Tienes un envío obligatorio en 15 minutos, una llamada pendiente y un archivo interno que vence mañana. ¿Cómo organizas el trabajo?', [
          ['Verifico y envío primero el trámite. Acordaría el retorno de la llamada y programaría el archivo.', 2, 'Prioriza el vencimiento y comunica cuándo atenderá las otras tareas.'],
          ['Resuelvo las tareas en el orden en que llegaron.', 0, 'El orden de llegada no refleja vencimientos o impactos.'],
          ['Inicio el envío obligatorio y dejaría las otras tareas en lista.', 1, 'Prioriza el vencimiento. Falta acordar la devolución de la llamada.']
        ])
      ],
      open: {
        prompt: 'Relata una jornada con solicitudes simultáneas. ¿Qué priorizaste, cómo informaste a quienes esperaban y qué registro quedó?',
        anchors: ['Enumera varias tareas sin justificar el orden ni el resultado.', 'Explica el criterio de priorización y una comunicación concreta.', 'Prioriza por plazo e impacto, comunica compromisos y muestra cómo registró el cierre o el seguimiento.']
      }
    }
  ];
})();
