/* =========================================================
   config.js — Configuração do sistema
   Edita apenas este ficheiro para ativar as notificações.
   ========================================================= */

window.COMUNIDADE_CONFIG = {

  /* ---------- Destinatários ---------- */
  destinatarios: {
    ceo: {
      nome: "Elizandra Carla Massango",
      cargo: "CEO da Comunidade",
      whatsapp: "244922661537",
      // Chave do CallMeBot (https://www.callmebot.com/blog/free-api-whatsapp-messages/)
      callmebotKey: "",
      email: "massangoelizandramassango@gmail.com"   // ← preenche quando tiveres o e-mail da CEO
    },
    subceo: {
      nome: "Jorge Ernesto Lucala",
      cargo: "Sub-CEO / Orientador",
      whatsapp: "244930513833",
      callmebotKey: "",
      email: "georgelucala60@gmail.com"
    }
  },

  /* ---------- EmailJS ----------
     Registo gratuito em https://www.emailjs.com/
  */
  emailjs: {
    publicKey: "",
    serviceId: "",
    templateId: ""
  },

  /* ---------- Ativar/desativar canais ---------- */
  ativo: {
    email: true,
    whatsapp: true
  }
};