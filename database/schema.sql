CREATE DATABASE IF NOT EXISTS comunidade
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE comunidade;

/* ---------- Configurações ---------- */
CREATE TABLE IF NOT EXISTS configuracoes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  limite_cadastros INT NOT NULL DEFAULT 70,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO configuracoes (limite_cadastros)
SELECT 70
WHERE NOT EXISTS (SELECT 1 FROM configuracoes);

/* ---------- Alunos ---------- */
CREATE TABLE IF NOT EXISTS alunos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nome VARCHAR(120) NOT NULL,
  telefone VARCHAR(30) NOT NULL UNIQUE,
  data_nascimento DATE NULL,
  sexo VARCHAR(30) NULL,
  classe VARCHAR(50) NOT NULL,
  curso VARCHAR(100) NULL,
  endereco VARCHAR(180) NULL,
  encarregado VARCHAR(120) NULL,
  telefone_encarregado VARCHAR(30) NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nome (nome),
  INDEX idx_classe (classe),
  INDEX idx_criado (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* ---------- Logs de WhatsApp ---------- */
CREATE TABLE IF NOT EXISTS whatsapp_mensagens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  aluno_id VARCHAR(64) NULL,
  aluno_nome VARCHAR(120) NULL,
  destinatario_nome VARCHAR(120) NULL,
  destinatario_numero VARCHAR(30) NOT NULL,
  destinatario_tipo ENUM('ceo','subceo','grupo','aluno','outro') DEFAULT 'outro',
  mensagem TEXT NOT NULL,
  provider VARCHAR(30) NOT NULL,
  estado ENUM('pendente','enviado','falhou') DEFAULT 'pendente',
  http_status INT NULL,
  resposta_provider TEXT NULL,
  erro TEXT NULL,
  tentativas TINYINT DEFAULT 1,
  ip VARCHAR(45) NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_estado (estado),
  INDEX idx_criado (criado_em),
  INDEX idx_aluno (aluno_id),
  INDEX idx_dest (destinatario_numero)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;