# API futura — PHP + MySQL

A interface atual funciona diretamente no navegador usando `localStorage`, para testes sem servidor.

Quando o projeto for hospedado, esta pasta poderá receber os endpoints PHP, por exemplo:

- `cadastrar.php` — recebe e grava um aluno.
- `listar.php` — lista os alunos.
- `editar.php` — atualiza um cadastro.
- `eliminar.php` — elimina um cadastro.
- `config.php` — ligação segura ao MySQL.
- `notificar.php` — integração com e-mail/WhatsApp.

A troca do armazenamento local por MySQL será feita no JavaScript substituindo as operações `localStorage` por `fetch()` para estes endpoints.
