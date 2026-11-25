(function (root) {
  'use strict';

  const MAX_POINTS = 2;
  const CONVERSATION_VERSION = 1;
  const groups = ['hard', 'soft'];
  const normalized = text => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

  function reviewResume(profile, text, checked) {
    const document = ' ' + normalized(text) + ' ';
    const matches = terms => [...new Set(terms)].filter(term => {
      const word = normalized(term);
      return word && document.includes(' ' + word + ' ');
    });
    const years = checked.years;
    return {
      education: {
        status: checked.education === 'yes' ? 'Verificada' : checked.education === 'no' ? 'No cumple, según la revisión' : 'Por verificar',
        mentions: matches(profile.educationTerms || []),
      },
      experience: {
        years,
        status: profile.years == null ? 'Confirmar el requisito con INNOVARQ' :
          years == null ? 'Por verificar' : years >= profile.years ? 'Alcanza el mínimo indicado' : 'Por debajo del mínimo indicado',
      },
      evidence: profile.evidence.map(item => ({label: item.label, terms: matches(item.terms)})),
    };
  }

  function score(profile, answers) {
    const totals = Object.fromEntries(groups.map(group => [group, {points: 0, max: 0, answered: 0}]));
    const items = profile.questions.map(question => {
      const group = totals[question.group];
      group.max += MAX_POINTS;
      const index = answers[question.id];
      const option = Number.isInteger(index) ? question.options[index] : undefined;
      if (option) {
        group.answered++;
        group.points += option.points;
      }
      return {question, option};
    });
    const max = totals.hard.max + totals.soft.max;
    const completed = items.every(item => item.option);
    for (const group of groups) {
      totals[group].percent = Math.round(100 * totals[group].points / totals[group].max);
    }
    const points = totals.hard.points + totals.soft.points;
    return {groups: totals, items, points, max, completed, percent: Math.round(100 * points / max)};
  }

  function conversationQuestions(profile) {
    return [...profile.questions, {
      id: 'experience',
      group: 'open',
      skill: 'Experiencia aplicada',
      prompt: profile.open.prompt,
    }];
  }

  function scoreConversation(profile, conversation) {
    if (conversation?.version !== CONVERSATION_VERSION) return null;
    const {isSummary, summaryPoints, OPEN_MAX} = root.AtlasOpenResponse;
    const questions = conversationQuestions(profile);
    if (!Number.isInteger(conversation.answered) || conversation.answered < 0 || conversation.answered > questions.length) return null;
    if (!questions.every(question => isSummary(conversation.evidence?.[question.id]))) return null;

    const totals = Object.fromEntries([...groups, 'open'].map(group => [group, {points: 0, max: 0}]));
    for (const question of questions) {
      const total = totals[question.group];
      total.points += summaryPoints(conversation.evidence[question.id]);
      total.max += OPEN_MAX;
    }
    for (const total of Object.values(totals)) {
      total.percent = Math.round(100 * total.points / total.max);
    }
    const points = Object.values(totals).reduce((total, group) => total + group.points, 0);
    const max = questions.length * OPEN_MAX;
    return {groups: totals, points, max, completed: conversation.answered === questions.length, percent: Math.round(100 * points / max), open: totals.open};
  }

  function rank(profile, entries, evaluateEntry = entry => score(profile, entry.answers || {})) {
    const rows = entries.filter(entry => entry.role === profile.id)
      .map(entry => ({entry, score: evaluateEntry(entry)}))
      .filter(row => row.score.completed)
      .sort((a, b) => b.score.points - a.score.points);
    let previous;
    let position;
    return rows.map((row, index) => {
      if (row.score.points !== previous) {
        previous = row.score.points;
        position = index + 1;
      }
      return {...row, position};
    });
  }

  function examples(profile) {
    const results = [
      {name: 'Perfil A', points: {hard: [2, 2], soft: [1, 2]}},
      {name: 'Perfil B', points: {hard: [2, 1], soft: [2, 2]}},
      {name: 'Perfil C', points: {hard: [1, 2], soft: [1, 1]}},
    ];
    return results.map(example => {
      const next = {hard: 0, soft: 0};
      const answers = Object.fromEntries(profile.questions.map(question => {
        const points = example.points[question.group][next[question.group]++];
        return [question.id, question.options.findIndex(option => option.points === points)];
      }));
      return {role: profile.id, name: example.name, answers};
    });
  }

  root.AtlasHiringEvaluation = Object.freeze({
    CONVERSATION_VERSION, reviewResume, score, conversationQuestions, scoreConversation, rank, examples,
  });
})(globalThis);
