(function (root) {
  'use strict';

  const format = 'atlas.innovarq.compras.respuestas';
  const rules = root.AtlasComprasPilot;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const invalid = 'Elige un archivo de respuestas generado por este piloto de Atlas.';

  function pack(entry) {
    return {format, version: rules.version, role: rules.profileId, id: entry.id, alias: entry.alias,
      created: entry.created, answers: entry.answers};
  }

  function unpack(data) {
    if (data?.format !== format || data.version !== rules.version || data.role !== rules.profileId ||
        typeof data.id !== 'string' || !uuid.test(data.id) || typeof data.alias !== 'string' ||
        !data.alias.trim() || data.alias.length > 40 || /[\u0000-\u001f\u007f]/u.test(data.alias) ||
        typeof data.created !== 'string' || !Number.isFinite(Date.parse(data.created)) ||
        !data.answers || typeof data.answers !== 'object' || Array.isArray(data.answers)) throw new Error(invalid);
    const answers = {};
    for (const item of rules.cases) {
      const answer = data.answers[item.id];
      if (!answer || typeof answer.main !== 'string' || typeof answer.followUp !== 'string' ||
          answer.main.length > 2400 || answer.followUp.length > 2400) throw new Error(invalid);
      const {main, followUp, followUpPrompt} = answer;
      if (followUpPrompt !== undefined && (typeof followUpPrompt !== 'string' ||
          !followUpPrompt.trim() || followUpPrompt.length > 300 || /[\u0000-\u001f\u007f]/u.test(followUpPrompt))) throw new Error(invalid);
      answers[item.id] = {main, followUp};
      if (followUpPrompt !== undefined) answers[item.id].followUpPrompt = followUpPrompt;
    }
    return {version: rules.version, id: data.id.toLowerCase(), alias: data.alias.trim(),
      created: new Date(data.created).toISOString(), answers, reviews: {}};
  }

  function availableAlias(original, entries) {
    const used = name => entries.some(item => item.alias.localeCompare(name, 'es', {sensitivity: 'base'}) === 0);
    let alias = original, number = 2;
    while (used(alias)) {
      const suffix = ' (' + number++ + ')';
      alias = original.slice(0, 40 - suffix.length) + suffix;
    }
    return alias;
  }

  function download(entry) {
    const file = new Blob([JSON.stringify(pack(entry), null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Atlas-Compras-' + entry.id + '.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function bindImport(input, status, pilot) {
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        if (file.size > 128 * 1024) throw new Error('El archivo supera el tamaño de una entrevista.');
        const entry = unpack(JSON.parse(await file.text()));
        const list = pilot.getEntries();
        if (list.some(other => other.id === entry.id)) throw new Error('Esta entrevista ya está cargada.');
        entry.alias = availableAlias(entry.alias, list);
        if (!pilot.importEntry(entry)) throw new Error('Esta entrevista ya está cargada.');
        status.textContent = 'Respuestas importadas como «' + entry.alias + '». ' +
          (pilot.storageFailed ? 'Disponibles en esta pestaña. El navegador bloqueó el guardado.' : 'Disponibles para evaluar en este navegador.');
      } catch (error) {
        status.textContent = error instanceof SyntaxError ? invalid : error.message;
      } finally {
        input.value = '';
      }
    });
  }

  root.AtlasComprasArchivo = Object.freeze({bindImport, download, pack, unpack, availableAlias});
})(globalThis);
