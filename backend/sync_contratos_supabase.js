const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://postgres.vufieahhfixyloykvsdb:Freider1004%2A@aws-1-us-west-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

const contratosFile = path.join(__dirname, 'data/contratos.json');
const contratos = JSON.parse(fs.readFileSync(contratosFile, 'utf8'));

async function syncToSupabase() {
  console.log('Iniciando sincronización de', contratos.length, 'contratos hacia Supabase PRODUCCIÓN...');
  
  const maxRes = await pool.query('SELECT COALESCE(MAX(codigo_numerico), 0) as max_cod FROM contratos');
  let currentMax = Number(maxRes.rows[0].max_cod);
  console.log('Max codigo_numerico actual en Supabase:', currentMax);

  let nuevos = 0;
  let actualizados = 0;

  for (const c of contratos) {
    const check = await pool.query(
      'SELECT id, codigo_numerico FROM contratos WHERE LOWER(TRIM(parte_b)) = LOWER(TRIM($1)) OR (numero_contrato = $2 AND numero_contrato != \'\') LIMIT 1',
      [c.parte_b, String(c.numero_contrato)]
    );

    const fInicio = c.fecha_inicio ? c.fecha_inicio : null;
    const fFin = c.fecha_fin ? c.fecha_fin : null;

    if (check.rows.length > 0) {
      await pool.query(
        `UPDATE contratos SET 
          nit = $1, 
          fecha_inicio = COALESCE($2::timestamp, fecha_inicio), 
          fecha_fin = COALESCE($3::timestamp, fecha_fin), 
          hoja_origen = $4,
          tipo_contrato = COALESCE(tipo_contrato, $5)
         WHERE id = $6`,
        [c.nit, fInicio, fFin, c.hoja_origen, c.tipo_contrato, check.rows[0].id]
      );
      actualizados++;
    } else {
      currentMax++;
      const newId = 'CTR-' + String(currentMax).padStart(4, '0');
      await pool.query(
        `INSERT INTO contratos (
          id, tipo_contrato, numero_contrato, parte_a, parte_b, nit, 
          fecha_inicio, fecha_fin, valor_contrato, objeto_contrato, 
          voxelsera, estado, codigo_numerico, hoja_origen, fecha_registro
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())`,
        [
          newId, c.tipo_contrato, String(c.numero_contrato), c.parte_a, c.parte_b, c.nit,
          fInicio, fFin, c.valor_contrato || 0,
          c.objeto_contrato, c.voxelsera || 'C', c.estado || 'INACTIVO',
          currentMax, c.hoja_origen
        ]
      );
      nuevos++;
    }
  }

  console.log('✅ SINCRONIZACIÓN COMPLETADA CON ÉXITO:');
  console.log('  - Contratos actualizados (con NIT y fechas):', actualizados);
  console.log('  - Contratos NUEVOS creados:', nuevos);

  const totalRes = await pool.query('SELECT COUNT(*) as total FROM contratos');
  console.log('📊 TOTAL CONTRATOS EN SUPABASE PRODUCCIÓN AHORA:', totalRes.rows[0].total);

  pool.end();
}

syncToSupabase().catch(err => {
  console.error('❌ Error en sincronización:', err);
  pool.end();
});
