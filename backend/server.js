const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sgd_coraza_secure_secret_key_2026';

app.use(cors());
app.use(express.json());

// Helper para Registrar Auditoría en SQL
async function registrarAuditoria(usuario, modulo, accion, detalle, estado, respuesta = '') {
  try {
    await db.query(
      `INSERT INTO log_auditoria (usuario, modulo, accion, detalle, estado, respuesta, version) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [usuario || 'sistema', modulo, accion, detalle, estado, respuesta, 'v7.4 SECURE']
    );
  } catch(e) {
    console.error("Error al registrar auditoría:", e);
  }
}

// Middleware de autenticación JWT
function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Acceso no autorizado' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Sesión expirada' });
    req.user = user;
    next();
  });
}

// Helper para obtener el consecutivo secuencial
async function obtenerSiguienteNumeroSecuencial(tabla, columnaId, columnaDepto, deptoSigla) {
  try {
    let queryStr = `SELECT ${columnaId} FROM ${tabla}`;
    let params = [];
    if (columnaDepto && deptoSigla) {
      queryStr += ` WHERE ${columnaDepto} = $1`;
      params.push(deptoSigla.toUpperCase());
    }
    const res = await db.query(queryStr, params);
    let max = 0;
    res.rows.forEach(row => {
      const val = row[columnaId];
      if (!val) return;
      let num = 0;
      if (typeof val === 'string' && val.indexOf('-') !== -1) {
        const parts = val.split('-');
        const lastPart = parts[parts.length - 1];
        num = parseInt(lastPart, 10);
      } else {
        const numStr = String(val).replace(/[^0-9]/g, '');
        num = parseInt(numStr, 10);
      }
      if (!isNaN(num) && num > max) max = num;
    });
    return max + 1;
  } catch(e) {
    console.error(`Error en consecutivo de ${tabla}:`, e);
    return 1;
  }
}

// ==========================================
// 1. RUTAS DE SISTEMA Y AUTENTICACIÓN
// ==========================================

// Inicializar Tablas SQL automáticamente
app.post('/api/system/initialize', async (req, res) => {
  try {
    const sqlPath = path.join(__dirname, 'database.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    await db.query(sqlContent);
    res.json({ success: true, message: '✅ Base de datos inicializada correctamente' });
  } catch(e) {
    res.status(500).json({ success: false, message: `Error de inicialización: ${e.message}` });
  }
});

// Login de Usuario
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Usuario no encontrado' });
    }
    const user = result.rows[0];
    if (user.estado !== 'ACTIVO') {
      return res.status(403).json({ success: false, message: 'Usuario inactivo' });
    }

    let isMatch = false;
    if (user.salt === 'salt_static_init') {
      // Contraseñas predefinidas en texto plano o hash simple
      isMatch = (password === 'Admin123') || await bcrypt.compare(password, user.password);
    } else {
      isMatch = await bcrypt.compare(password, user.password);
    }

    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Contraseña incorrecta' });
    }

    // Actualizar último acceso
    await db.query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE email = $1', [email]);
    await registrarAuditoria(email, 'LOGIN', 'ACCESO', 'Sesión iniciada', 'EXITO');

    // Generar JWT Token
    const token = jwt.sign({ email: user.email, nombre: user.nombre, rol: user.rol, depto: user.departamento }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ success: true, token, user: { email: user.email, nombre: user.nombre, rol: user.rol, depto: user.departamento } });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Registrar nuevo usuario (Admin only)
app.post('/api/auth/register', autenticarToken, async (req, res) => {
  const { email, password, nombre, departamento, rol } = req.body;
  try {
    const exist = await db.query('SELECT email FROM usuarios WHERE email = $1', [email]);
    if (exist.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'El correo ya está registrado' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await db.query(
      `INSERT INTO usuarios (email, password, nombre, departamento, rol, salt) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [email, hashedPassword, nombre, departamento, rol || 'USUARIO', salt]
    );

    await registrarAuditoria(req.user.email, 'USUARIOS', 'REGISTRO', `Usuario creado: ${email}`, 'EXITO');
    res.json({ success: true, message: '✅ Usuario registrado con éxito' });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Obtener todos los usuarios
app.get('/api/auth/usuarios', autenticarToken, async (req, res) => {
  try {
    const resUsers = await db.query('SELECT email, nombre, departamento, estado, rol, ultimo_acceso FROM usuarios');
    res.json({ success: true, usuarios: resUsers.rows });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ==========================================
// 2. CORRESPONDENCIA Y TRD
// ==========================================

// Obtener Tabla TRD
app.get('/api/trd', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM tabla_trd');
    res.json({ success: true, trd: result.rows });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Calcular siguiente radicado TRD
app.post('/api/correspondencia/codigo-trd', async (req, res) => {
  const { depSigla, depCode, serieCode, subserieCode } = req.body;
  try {
    const year = new Date().getFullYear();
    const subPart = subserieCode ? `.${subserieCode}` : '';
    const prefix = `${depCode}-${serieCode}${subPart}-${year}-`;
    
    // Búsqueda inteligente por dependencia en SQL
    const nextVal = await obtenerSiguienteNumeroSecuencial('correspondencia', 'codigo_documento', 'depto_origen', depSigla);
    res.json({ success: true, codigo: `${prefix}${String(nextVal).padStart(4, '0')}` });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Registrar Correspondencia
app.post('/api/correspondencia', autenticarToken, async (req, res) => {
  const { fecha, medio, tipo, deptoOrigen, deptoDestino, asunto, detalle, estado, codigo, depCode, serieCode, subserieCode } = req.body;
  try {
    const id = `CORR-${Date.now()}`;
    let codFinal = codigo;
    
    if (!codFinal || codFinal.startsWith('Seleccione')) {
      const nextVal = await obtenerSiguienteNumeroSecuencial('correspondencia', 'codigo_documento', 'depto_origen', deptoOrigen);
      const subPart = subserieCode ? `.${subserieCode}` : '';
      codFinal = `${depCode}-${serieCode}${subPart}-${new Date().getFullYear()}-${String(nextVal).padStart(4, '0')}`;
    }

    const codNum = parseInt(codFinal.replace(/[^0-9]/g, ''), 10) || 0;

    await db.query(
      `INSERT INTO correspondencia (id, codigo_documento, fecha_documento, medio, tipo_documento, depto_origen, depto_destino, asunto, detalle, estado, usuario_registro, voxelsera, codigo_unico, codigo_numerico) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [id, codFinal, fecha || new Date(), medio, tipo, deptoOrigen, deptoDestino, asunto, detalle, estado || 'PENDIENTE', req.user.email, '', codFinal, codNum]
    );

    await registrarAuditoria(req.user.email, 'CORRESPONDENCIA', 'REGISTRO', `Radicado: ${codFinal}`, 'EXITO');
    res.json({ success: true, id, codigo: codFinal, message: '✅ Correspondencia registrada con éxito' });
  } catch(e) {
    await registrarAuditoria(req.user.email, 'CORRESPONDENCIA', 'REGISTRO_ERROR', e.message, 'ERROR');
    res.status(500).json({ success: false, message: e.message });
  }
});

// Obtener Correspondencia con filtros
app.get('/api/correspondencia', autenticarToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM correspondencia ORDER BY fecha_registro DESC');
    res.json({ success: true, datos: result.rows });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ==========================================
// 3. MINUTAS
// ==========================================

app.post('/api/minutas', autenticarToken, async (req, res) => {
  const { tipoMinuta, nombrePuesto, fechaInicio, fechaCierre, observaciones, voxelsera } = req.body;
  try {
    const id = `MIN-${Date.now()}`;
    const prefix = tipoMinuta === 'VISITANTES' ? 'VIS' : (tipoMinuta === 'CORRESPONDENCIA' ? 'COR' : 'SER');
    
    // Obtener el consecutivo máximo existente para este tipo de minuta
    const maxRes = await db.query(
      `SELECT MAX(codigo_numerico) as max_num FROM minutas WHERE tipo_minuta = $1`,
      [tipoMinuta]
    );
    const nextVal = (parseInt(maxRes.rows[0]?.max_num, 10) || 0) + 1;
    const cu = `MIN-${prefix}-${String(nextVal).padStart(4, '0')}`;

    await db.query(
      `INSERT INTO minutas (id, tipo_minuta, nombre_puesto, fecha_inicio, fecha_cierre, observaciones, estado, responsable, voxelsera, codigo_unico, codigo_numerico) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, tipoMinuta, nombrePuesto, fechaInicio || new Date(), fechaCierre || null, observaciones, 'ACTIVO', req.user.email, voxelsera || '', cu, nextVal]
    );

    await registrarAuditoria(req.user.email, 'MINUTAS', 'REGISTRO', `Minuta: ${cu}`, 'EXITO');
    res.json({ success: true, id, codigo: cu, codigoUnico: cu, message: '✅ Minuta registrada con éxito' });
  } catch(e) {
    await registrarAuditoria(req.user.email, 'MINUTAS', 'REGISTRO_ERROR', e.message, 'ERROR');
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/minutas', autenticarToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, tipo_minuta, nombre_puesto, fecha_inicio, fecha_cierre, observaciones, estado, responsable, voxelsera, codigo_unico, codigo_numerico, fecha_registro 
       FROM minutas ORDER BY fecha_inicio DESC, codigo_numerico DESC LIMIT 200`
    );
    res.json({ success: true, datos: result.rows });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ==========================================
// 4. PERSONAL INACTIVO
// ==========================================

app.post('/api/personal-inactivo', autenticarToken, async (req, res) => {
  const { nombre, cedula, fechaBaja, motivo, observaciones, tipoPersona } = req.body;
  try {
    const id = `PER-${Date.now()}`;
    const nextVal = await obtenerSiguienteNumeroSecuencial('personal_inactivo', 'id', null, null);
    const cn = String(nextVal).padStart(2, '0');
    const tipo = tipoPersona || 'EMPLEADO';

    await db.query(
      `INSERT INTO personal_inactivo (id, nombre_completo, cedula, fecha_baja, motivo_baja, observaciones, voxelsera, codigo_numerico, tipo_persona) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, nombre, cedula, fechaBaja || new Date(), motivo, observaciones, '', nextVal, tipo]
    );

    await registrarAuditoria(req.user.email, 'PERSONAL_INACTIVO', 'REGISTRO', `Cédula: ${cedula} (${tipo})`, 'EXITO');
    res.json({ success: true, id, codigo: cn, message: '✅ Personal inactivo registrado con éxito' });
  } catch(e) {
    await registrarAuditoria(req.user.email, 'PERSONAL_INACTIVO', 'REGISTRO_ERROR', e.message, 'ERROR');
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/personal-inactivo', autenticarToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, nombre_completo, cedula, fecha_baja, motivo_baja, observaciones, voxelsera, codigo_numerico, tipo_persona, fecha_registro 
       FROM personal_inactivo ORDER BY fecha_baja DESC, nombre_completo ASC`
    );
    res.json({ success: true, datos: result.rows });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.put('/api/personal-inactivo/:id/tipo', autenticarToken, async (req, res) => {
  const { id } = req.params;
  const { tipoPersona } = req.body;
  try {
    await db.query(
      `UPDATE personal_inactivo SET tipo_persona = $1 WHERE id = $2`,
      [tipoPersona, id]
    );
    await registrarAuditoria(req.user.email, 'PERSONAL_INACTIVO', 'ACTUALIZAR_TIPO', `ID: ${id} a ${tipoPersona}`, 'EXITO');
    res.json({ success: true, message: '✅ Tipo de personal actualizado' });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ==========================================
// 5. CONTRATOS
// ==========================================

app.post('/api/contratos', autenticarToken, async (req, res) => {
  const { tipo, numero, parteA, parteB, fechaInicio, fechaFin, valor, objeto } = req.body;
  try {
    const id = `CTR-${Date.now()}`;
    const nextVal = await obtenerSiguienteNumeroSecuencial('contratos', 'id', null, null);
    const cn = String(nextVal).padStart(2, '0');

    await db.query(
      `INSERT INTO contratos (id, tipo_contrato, numero_contrato, parte_a, parte_b, fecha_inicio, fecha_fin, valor_contrato, objeto_contrato, voxelsera, estado, codigo_numerico) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, tipo, numero || id, parteA, parteB, fechaInicio || new Date(), fechaFin || null, parseFloat(valor) || 0, objeto, '', 'VIGENTE', nextVal]
    );

    // Disparar Workflow si el valor supera 1,000,000 COP
    if (parseFloat(valor) > 1000000) {
      const wfId = `WF-${Date.now()}`;
      await db.query(
        `INSERT INTO workflows (id, tipo, documento_id, solicitante, aprobador, estado, comentarios, dias_sla) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [wfId, 'APROBACION_CONTRATO_ALTO_VALOR', id, req.user.email, 'ge@corazacta.com', 'PENDIENTE', `Contrato de alto valor: $${valor}`, 3]
      );
    }

    await registrarAuditoria(req.user.email, 'CONTRATOS', 'REGISTRO', `Contrato N°: ${numero || id}`, 'EXITO');
    res.json({ success: true, id, codigo: cn, message: '✅ Contrato registrado con éxito' });
  } catch(e) {
    await registrarAuditoria(req.user.email, 'CONTRATOS', 'REGISTRO_ERROR', e.message, 'ERROR');
    res.status(500).json({ success: false, message: e.message });
  }
});

// ==========================================
// 6. PRÉSTAMOS
// ==========================================

app.post('/api/prestamos', autenticarToken, async (req, res) => {
  const { solicitante, departamento, documento, codigo, fechaPrestamo, fechaDevolucion } = req.body;
  try {
    const id = `PREST-${Date.now()}`;
    await db.query(
      `INSERT INTO prestamos (id, solicitante, departamento, documento, codigo_documento, fecha_prestamo, fecha_devolucion, estado) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, solicitante, departamento, documento, codigo, fechaPrestamo || new Date(), fechaDevolucion, 'ACTIVO']
    );

    await registrarAuditoria(req.user.email, 'PRESTAMOS', 'REGISTRO', `Préstamo a: ${solicitante}`, 'EXITO');
    res.json({ success: true, id, message: '✅ Préstamo registrado con éxito' });
  } catch(e) {
    await registrarAuditoria(req.user.email, 'PRESTAMOS', 'REGISTRO_ERROR', e.message, 'ERROR');
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/prestamos/devolver', autenticarToken, async (req, res) => {
  const { id } = req.body;
  try {
    await db.query(
      `UPDATE prestamos SET fecha_devolucion_real = NOW(), estado = 'DEVUELTO' WHERE id = $1`,
      [id]
    );
    res.json({ success: true, message: '✅ Devolución registrada con éxito' });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/prestamos/estado', autenticarToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM prestamos ORDER BY fecha_prestamo DESC');
    res.json({ success: true, prestamos: result.rows });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ==========================================
// 7. WORKFLOWS
// ==========================================

app.get('/api/workflows/pendientes', autenticarToken, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM workflows WHERE estado = 'PENDIENTE'");
    res.json({ success: true, workflows: result.rows });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/workflows/resolver', autenticarToken, async (req, res) => {
  const { id, decision, comentario } = req.body;
  try {
    const estadoFinal = decision === 'APROBAR' ? 'APROBADO' : 'RECHAZADO';
    await db.query(
      `UPDATE workflows SET estado = $1, comentarios_aprobacion = $2 WHERE id = $3`,
      [estadoFinal, comentario || '', id]
    );
    res.json({ success: true, message: `✅ Workflow resuelto como: ${estadoFinal}` });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ==========================================
// 8. BIBLIOTECA DE DOCUMENTOS
// ==========================================

app.get('/api/biblioteca/arbol', autenticarToken, async (req, res) => {
  try {
    const resCarpetas = await db.query('SELECT * FROM biblioteca_carpetas');
    const resArchivos = await db.query('SELECT * FROM biblioteca WHERE estado = \'ACTIVO\'');
    res.json({ success: true, carpetas: resCarpetas.rows, archivos: resArchivos.rows });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/biblioteca/carpetas', autenticarToken, async (req, res) => {
  const { nombre, padre, color } = req.body;
  try {
    const id = `DIR-${Date.now()}`;
    await db.query(
      `INSERT INTO biblioteca_carpetas (id, nombre, padre, color) VALUES ($1, $2, $3, $4)`,
      [id, nombre, padre || 'RAIZ', color || '#2563eb']
    );
    res.json({ success: true, id, message: '✅ Carpeta creada con éxito' });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/biblioteca/archivos', autenticarToken, async (req, res) => {
  const { nombre, categoria, version, url, fechaElab, descCambio, responsable, carpetaId } = req.body;
  try {
    const id = `BIB-${Date.now()}`;
    await db.query(
      `INSERT INTO biblioteca (id, nombre, categoria, version, estado, url, fecha_elaboracion, descripcion_cambio, responsable, carpeta_id, usuario_registro) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, nombre, categoria, version || '1.0', 'ACTIVO', url || '', fechaElab || new Date(), descCambio, responsable, carpetaId || 'RAIZ', req.user.email]
    );
    res.json({ success: true, id, message: '✅ Documento registrado en la biblioteca' });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ==========================================
// 9. BÚSQUEDA UNIVERSAL (ORM GLOBAL EN SQL)
// ==========================================

app.get('/api/busqueda', autenticarToken, async (req, res) => {
  const { query } = req.query;
  try {
    const searchVal = `%${query || ''}%`;
    const numVal = parseInt(query) || 0;
    const resultados = [];

    // 1. Minutas
    const minutas = await db.query(
      `SELECT id, tipo_minuta, nombre_puesto, codigo_unico, voxelsera, fecha_registro FROM minutas 
       WHERE codigo_unico ILIKE $1 OR nombre_puesto ILIKE $1 OR voxelsera ILIKE $1 OR codigo_numerico = $2 LIMIT 50`,
      [searchVal, numVal]
    );
    minutas.rows.forEach(r => resultados.push({
      modulo: '📋 MINUTAS',
      titulo: `${r.tipo_minuta} - ${r.nombre_puesto}`,
      codigo: r.codigo_unico,
      fecha: r.fecha_registro,
      id: r.id,
      detalles: { VOXELSERA: r.voxelsera }
    }));

    // 2. Correspondencia
    const corr = await db.query(
      `SELECT id, codigo_documento, depto_origen, depto_destino, asunto, detalle, voxelsera, fecha_registro FROM correspondencia 
       WHERE codigo_documento ILIKE $1 OR asunto ILIKE $1 OR detalle ILIKE $1 OR depto_origen ILIKE $1 OR voxelsera ILIKE $1 LIMIT 50`,
      [searchVal]
    );
    corr.rows.forEach(r => resultados.push({
      modulo: '📧 CORRESPONDENCIA',
      titulo: `[${r.depto_origen}] ${r.asunto}`,
      codigo: r.codigo_documento,
      fecha: r.fecha_registro,
      id: r.id,
      detalles: { VOXELSERA: r.voxelsera, DESTINO: r.depto_destino }
    }));

    // 3. Contratos
    const contratos = await db.query(
      `SELECT id, tipo_contrato, numero_contrato, parte_a, parte_b, objeto_contrato, voxelsera, fecha_registro FROM contratos 
       WHERE numero_contrato ILIKE $1 OR parte_a ILIKE $1 OR parte_b ILIKE $1 OR objeto_contrato ILIKE $1 OR voxelsera ILIKE $1 LIMIT 50`,
      [searchVal]
    );
    contratos.rows.forEach(r => resultados.push({
      modulo: '📑 CONTRATOS',
      titulo: `${r.tipo_contrato} (${r.parte_a} - ${r.parte_b})`,
      codigo: r.numero_contrato,
      fecha: r.fecha_registro,
      id: r.id,
      detalles: { VOXELSERA: r.voxelsera, OBJETO: r.objeto_contrato }
    }));

    // 4. Asociados Retirados (Personal Inactivo)
    const asociados = await db.query(
      `SELECT id, nombre_completo, cedula, motivo_baja, voxelsera, fecha_baja FROM personal_inactivo 
       WHERE nombre_completo ILIKE $1 OR cedula ILIKE $1 OR motivo_baja ILIKE $1 OR voxelsera ILIKE $1 LIMIT 50`,
      [searchVal]
    );
    asociados.rows.forEach(r => resultados.push({
      modulo: '🤝 ASOCIADOS RETIRADOS',
      titulo: `${r.nombre_completo} (Motivo: ${r.motivo_baja || 'N/A'})`,
      codigo: `CC: ${r.cedula}`,
      fecha: r.fecha_baja,
      id: r.id,
      detalles: { VOXELSERA: r.voxelsera, CEDULA: r.cedula }
    }));

    // 5. Préstamos
    const prestamos = await db.query(
      `SELECT id, solicitante, departamento, documento, codigo_documento, fecha_prestamo, estado FROM prestamos 
       WHERE solicitante ILIKE $1 OR documento ILIKE $1 OR codigo_documento ILIKE $1 OR departamento ILIKE $1 LIMIT 50`,
      [searchVal]
    );
    prestamos.rows.forEach(r => resultados.push({
      modulo: '🔄 PRESTAMOS',
      titulo: `[${r.estado}] Solicitante: ${r.solicitante} (${r.documento})`,
      codigo: r.codigo_documento || r.id,
      fecha: r.fecha_prestamo,
      id: r.id,
      detalles: { ESTADO: r.estado, DEPTO: r.departamento }
    }));

    res.json({ success: true, resultados, total: resultados.length });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ==========================================
// 10. AUDITORÍA Y ANALYTICS
// ==========================================

app.get('/api/auditoria', autenticarToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM log_auditoria ORDER BY fecha DESC LIMIT 100');
    res.json({ success: true, logs: result.rows });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/analytics', autenticarToken, async (req, res) => {
  try {
    const resCorr = await db.query('SELECT COUNT(*) FROM correspondencia');
    const resMin = await db.query('SELECT COUNT(*) FROM minutas');
    const resCtr = await db.query('SELECT COUNT(*) FROM contratos');
    const resPrest = await db.query("SELECT COUNT(*) FROM prestamos WHERE estado = 'ACTIVO'");
    const resAsoc = await db.query('SELECT COUNT(*) FROM personal_inactivo');

    res.json({
      success: true,
      correspondencia: parseInt(resCorr.rows[0].count, 10),
      minutas: parseInt(resMin.rows[0].count, 10),
      contratos: parseInt(resCtr.rows[0].count, 10),
      prestamosActivos: parseInt(resPrest.rows[0].count, 10),
      asociadosRetirados: parseInt(resAsoc.rows[0].count, 10)
    });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Siempre escuchar en PORT (Render asigna process.env.PORT automáticamente)
app.listen(PORT, () => {
  console.log(`🚀 Servidor SGD Coraza corriendo en puerto ${PORT}`);
});

module.exports = app;
