const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://postgres.vufieahhfixyloykvsdb:Freider1004%2A@aws-1-us-west-2.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('🔌 Quitando restricción UNIQUE de cédula en personal_inactivo...');
    
    // Eliminar restricción de unicidad en cédula si existe
    await client.query(`
      ALTER TABLE personal_inactivo DROP CONSTRAINT IF EXISTS personal_inactivo_cedula_key;
    `);
    console.log('✅ Restricción UNIQUE eliminada en cedula. Ahora aceptará todos los registros duplicados o múltiples ingresos.');

    // Crear tabla archivo_fisico si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS archivo_fisico (
        id VARCHAR(50) PRIMARY KEY,
        id_documento VARCHAR(100),
        tipo_documento VARCHAR(100),
        ubicacion VARCHAR(50),
        descripcion TEXT,
        fecha_archivo TIMESTAMP,
        estado VARCHAR(20),
        codigo_busqueda VARCHAR(100)
      );
    `);
    console.log('✅ Tabla archivo_fisico verificada.');

  } catch(e) {
    console.error('❌ Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
