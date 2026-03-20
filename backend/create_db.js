const mysql = require('mysql2/promise');

async function createDb() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      // senha vazia
    });

    console.log("Conectado ao MySQL com sucesso!");
    await connection.query("CREATE DATABASE IF NOT EXISTS freedom_db;");
    console.log("Base freedom_db criada ou já existente!");
    await connection.end();
  } catch (err) {
    console.error("Erro:", err);
  }
}

createDb();
