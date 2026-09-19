const mysql = require('mysql2/promise');
const { db } = require('./config');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(db);
  }
  return pool;
}

async function testarConexao() {
  const p = getPool();
  await p.query('SELECT 1');
  return true;
}

module.exports = { getPool, testarConexao };