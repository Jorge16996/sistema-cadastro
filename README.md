# Sistema de Cadastro de Alunos — Comunidade

## Versão inicial
Esta versão abre diretamente no navegador e já permite:
- página inicial com animações;
- cadastro de alunos;
- limite configurável (70 por padrão);
- prevenção de telefone duplicado;
- contador de alunos e vagas;
- painel administrativo;
- eliminação de cadastros;
- exportação CSV.

### Teste
Abra `index.html` no navegador.

## Próxima etapa para hospedagem
A estrutura já inclui `database/schema.sql` para MySQL e `api/README.md` para a futura API PHP.

### Arquitetura recomendada para hospedagem gratuita
Frontend: HTML + CSS + JavaScript
Backend: PHP
Banco: MySQL/MariaDB
Notificações: e-mail SMTP e, posteriormente, WhatsApp Business API.

> Os dados da versão local ficam no navegador. Para produção, a base MySQL deve ser usada; não coloque senhas da base ou chaves de API no JavaScript público.
