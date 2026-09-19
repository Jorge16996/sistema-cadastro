function formatarData(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return new Date().toLocaleString('pt-AO');
    return d.toLocaleString('pt-AO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return new Date().toLocaleString('pt-AO'); }
}

function buildMessage(aluno, numeroCadastro) {
  const linhas = [
    '🎓 *NOVO ALUNO CADASTRADO*',
    '',
    `👤 Nome: ${aluno.nome}`,
    `📞 Telefone: ${aluno.telefone}`,
    `🎓 Classe: ${aluno.classe}`
  ];
  if (aluno.curso)                  linhas.push(`📚 Curso: ${aluno.curso}`);
  if (aluno.endereco)               linhas.push(`📍 Endereço: ${aluno.endereco}`);
  if (aluno.encarregado)            linhas.push(`👨‍👩‍👦 Encarregado: ${aluno.encarregado}`);
  if (aluno.telefone_encarregado)   linhas.push(`📞 Contacto encarregado: ${aluno.telefone_encarregado}`);

  linhas.push('');
  linhas.push(`🔢 Nº do cadastro: ${numeroCadastro || '—'}`);
  linhas.push(`📅 ${formatarData(aluno.criado_em)}`);
  linhas.push('');
  linhas.push('— Sistema da Comunidade');

  return linhas.join('\n');
}

module.exports = { buildMessage };