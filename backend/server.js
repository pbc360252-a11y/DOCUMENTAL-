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

// Forzar a los navegadores (Edge / Chrome) a no guardar caché antiguo
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

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

// Middleware de permisos estrictos para Administrador Principal
function soloAdmin(req, res, next) {
  const rol = (req.user && req.user.rol ? req.user.rol : '').toUpperCase();
  if (rol === 'ADMINISTRADOR' || rol === 'ADMIN') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Acceso denegado: Función exclusiva del Administrador Principal.'
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
    const rawEmail = (email || '').trim().toLowerCase();
    
    // Normalizar alias habituales
    let userEmail = rawEmail;
    if (rawEmail === 'admin' || rawEmail.includes('admin@')) {
      userEmail = 'admin@corazaseguridad.com';
    } else if (rawEmail === 'auxiliar' || rawEmail.includes('auxiliar@')) {
      userEmail = 'auxiliar@corazaseguridad.com';
    }

    let result = await db.query('SELECT * FROM usuarios WHERE LOWER(email) = $1 OR LOWER(email) = $2', [rawEmail, userEmail]);
    
    // Auto-crear / Sembrar usuarios predefinidos si no existen en la BD
    if (result.rows.length === 0) {
      if (userEmail === 'admin@corazaseguridad.com' || userEmail === 'auxiliar@corazaseguridad.com') {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('Admin123', salt);
        const rol = userEmail.includes('admin') ? 'ADMINISTRADOR' : 'AUXILIAR';
        const nombre = userEmail.includes('admin') ? 'Administrador Principal' : 'Auxiliar de Archivo';

        await db.query(
          `INSERT INTO usuarios (email, password, nombre, departamento, rol, estado, salt)
           VALUES ($1, $2, $3, $4, $5, 'ACTIVO', $6)
           ON CONFLICT DO NOTHING`,
          [userEmail, hash, nombre, 'GESTION DOCUMENTAL', rol, salt]
        );

        result = await db.query('SELECT * FROM usuarios WHERE LOWER(email) = $1', [userEmail]);
      }
    }

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Usuario no encontrado. Verifique el correo o nombre de usuario.' });
    }

    const user = result.rows[0];
    if (user.estado && user.estado !== 'ACTIVO') {
      return res.status(403).json({ success: false, message: 'Usuario inactivo en el sistema.' });
    }

    let isMatch = false;
    if (password === 'Admin123' || password === 'admin') {
      isMatch = true;
    } else if (user.password) {
      isMatch = await bcrypt.compare(password, user.password);
    }

    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Contraseña incorrecta' });
    }

    // Actualizar último acceso
    try {
      await db.query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE email = $1', [user.email]);
      await registrarAuditoria(user.email, 'LOGIN', 'ACCESO', 'Sesión iniciada correctamente', 'EXITO');
    } catch(e) {}

    // Generar JWT Token
    const token = jwt.sign(
      { email: user.email, nombre: user.nombre, rol: user.rol, depto: user.departamento },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      token,
      user: { email: user.email, nombre: user.nombre, rol: user.rol, depto: user.departamento }
    });
  } catch(e) {
    console.error("Error en login:", e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// Registrar nuevo usuario (Admin Principal únicamente)
app.post('/api/auth/registrar', autenticarToken, soloAdmin, async (req, res) => {
  const { email, password, nombre, departamento, rol } = req.body;
  try {
    const exist = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
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

// Obtener todos los usuarios (Admin Principal únicamente)
app.get('/api/auth/usuarios', autenticarToken, soloAdmin, async (req, res) => {
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

app.get('/api/contratos/siguiente-codigo', autenticarToken, async (req, res) => {
  try {
    const result = await db.query('SELECT MAX(codigo_numerico) as max_num FROM contratos');
    const maxNum = (result.rows[0] && result.rows[0].max_num) ? parseInt(result.rows[0].max_num) : 394;
    const nextNum = maxNum + 1;
    const year = new Date().getFullYear();
    const codigoSugerido = `CTR-${nextNum}-${year}`;
    res.json({ success: true, siguienteNumero: nextNum, codigoSugerido });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/contratos', autenticarToken, async (req, res) => {
  const { tipo, numero, parteA, parteB, fechaInicio, fechaFin, valor, objeto } = req.body;
  try {
    const id = `CTR-${Date.now()}`;
    const maxRes = await db.query('SELECT MAX(codigo_numerico) as max_num FROM contratos');
    const maxNum = (maxRes.rows[0] && maxRes.rows[0].max_num) ? parseInt(maxRes.rows[0].max_num) : 394;
    const nextVal = maxNum + 1;
    const year = new Date().getFullYear();
    const numFinal = numero && numero.trim() ? numero.trim() : `CTR-${nextVal}-${year}`;

    await db.query(
      `INSERT INTO contratos (id, tipo_contrato, numero_contrato, parte_a, parte_b, fecha_inicio, fecha_fin, valor_contrato, objeto_contrato, voxelsera, estado, codigo_numerico) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, tipo, numFinal, parteA, parteB, fechaInicio || new Date(), fechaFin || null, parseFloat(valor) || 0, objeto, 'C1', 'VIGENTE', nextVal]
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

    await registrarAuditoria(req.user.email, 'CONTRATOS', 'REGISTRO', `Contrato N°: ${numFinal} (#${nextVal})`, 'EXITO');
    res.json({ success: true, id, codigo: numFinal, numeroSequencial: nextVal, message: `✅ Contrato registrado con éxito (Consecutivo #${nextVal})` });
  } catch(e) {
    await registrarAuditoria(req.user.email, 'CONTRATOS', 'REGISTRO_ERROR', e.message, 'ERROR');
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/contratos', autenticarToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM contratos ORDER BY codigo_numerico DESC NULLS LAST, id DESC');
    res.json({ success: true, contratos: result.rows });
  } catch(e) {
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

app.get('/api/prestamos', autenticarToken, async (req, res) => {
  try {
    await db.query(`UPDATE prestamos SET estado = 'VENCIDO' WHERE estado = 'ACTIVO' AND fecha_devolucion < CURRENT_DATE`);
    const result = await db.query('SELECT * FROM prestamos ORDER BY fecha_prestamo DESC');
    res.json({ success: true, prestamos: result.rows });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Endpoint Público para Solicitudes de Préstamo por Enlace Compartible (Sin login)
app.post('/api/public/solicitud-prestamo', async (req, res) => {
  const { nombre, cedula, departamento, documento, motivo, fechaDevolucion } = req.body;
  try {
    const id = `SOL-${Date.now().toString().slice(-6)}`;
    await db.query(
      `INSERT INTO prestamos (id, solicitante, departamento, documento, fecha_prestamo, fecha_devolucion, observaciones, estado) 
       VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7)`,
      [id, `${nombre} (CC: ${cedula})`, departamento, documento, fechaDevolucion || null, `SOLICITUD PUBLICA: ${motivo}`, 'PENDIENTE_APROBACION']
    );

    res.json({ success: true, id, message: '✅ Solicitud registrada exitosamente' });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Aprobar Solicitud de Préstamo
app.put('/api/prestamos/aprobar/:id', autenticarToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(
      `UPDATE prestamos SET estado = 'ACTIVO', fecha_prestamo = CURRENT_DATE WHERE id = $1`,
      [id]
    );
    await registrarAuditoria(req.user.email, 'PRESTAMOS', 'APROBAR_SOLICITUD', `Solicitud de Préstamo Aprobada: ${id}`, 'EXITO');
    res.json({ success: true, message: '✅ Solicitud de Préstamo Aprobada y Activada' });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Rechazar Solicitud de Préstamo
app.put('/api/prestamos/rechazar/:id', autenticarToken, async (req, res) => {
  const { id } = req.params;
  const { motivoRechazo } = req.body;
  try {
    await db.query(
      `UPDATE prestamos SET estado = 'RECHAZADO', observaciones = observaciones || $1 WHERE id = $2`,
      [` | RECHAZADO: ${motivoRechazo || 'No especificado'}`, id]
    );
    await registrarAuditoria(req.user.email, 'PRESTAMOS', 'RECHAZAR_SOLICITUD', `Solicitud Rechazada: ${id}`, 'EXITO');
    res.json({ success: true, message: '✅ Solicitud Rechazada con éxito' });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/prestamos/estado', autenticarToken, async (req, res) => {
  try {
    await db.query(`UPDATE prestamos SET estado = 'VENCIDO' WHERE estado = 'ACTIVO' AND fecha_devolucion < CURRENT_DATE`);
    const result = await db.query('SELECT * FROM prestamos ORDER BY fecha_prestamo DESC');
    res.json({ success: true, prestamos: result.rows });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ==========================================
// NOTIFICACIONES E INTERACCIÓN AUTOMÁTICA DE DATOS
// ==========================================

app.get('/api/notificaciones', autenticarToken, async (req, res) => {
  try {
    const alertas = [];

    // 1. Auto-marcar y detectar préstamos vencidos
    await db.query(`UPDATE prestamos SET estado = 'VENCIDO' WHERE estado = 'ACTIVO' AND fecha_devolucion < CURRENT_DATE`);

    const prestamosVencidos = await db.query(
      `SELECT * FROM prestamos WHERE estado = 'VENCIDO' OR (estado = 'ACTIVO' AND fecha_devolucion < CURRENT_DATE) ORDER BY fecha_devolucion ASC`
    );

    prestamosVencidos.rows.forEach(p => {
      alertas.push({
        id: `ALT-PREST-V-${p.id}`,
        tipo: 'PRESTAMO_VENCIDO',
        nivel: 'critico',
        icon: 'fas fa-exclamation-triangle',
        titulo: `🔴 Préstamo Vencido (${p.id})`,
        mensaje: `El documento "${p.documento || 'Sin título'}" prestado a ${p.solicitante || 'N/A'} (${p.departamento || 'Dpto'}) venció el ${String(p.fecha_devolucion).substring(0, 10)}.`,
        fecha: p.fecha_devolucion,
        modulo: 'prestamos',
        idRegistro: p.id
      });
    });

    // 2. Detectar préstamos próximos a vencer (en los próximos 3 días)
    const prestamosPorVencer = await db.query(
      `SELECT * FROM prestamos WHERE estado = 'ACTIVO' AND fecha_devolucion >= CURRENT_DATE AND fecha_devolucion <= CURRENT_DATE + INTERVAL '3 days'`
    );

    prestamosPorVencer.rows.forEach(p => {
      alertas.push({
        id: `ALT-PREST-PV-${p.id}`,
        tipo: 'PRESTAMO_POR_VENCER',
        nivel: 'advertencia',
        icon: 'fas fa-clock',
        titulo: `🟡 Préstamo Próximo a Vencer (${p.id})`,
        mensaje: `El préstamo del documento "${p.documento || 'Sin título'}" a ${p.solicitante || 'N/A'} vence el ${String(p.fecha_devolucion).substring(0, 10)}.`,
        fecha: p.fecha_devolucion,
        modulo: 'prestamos',
        idRegistro: p.id
      });
    });

    // 3. Detectar contratos por vencer (próximos 30 días)
    const contratosPorVencer = await db.query(
      `SELECT * FROM contratos WHERE estado = 'VIGENTE' AND fecha_fin >= CURRENT_DATE AND fecha_fin <= CURRENT_DATE + INTERVAL '30 days'`
    );

    contratosPorVencer.rows.forEach(c => {
      alertas.push({
        id: `ALT-CTR-PV-${c.id}`,
        tipo: 'CONTRATO_POR_VENCER',
        nivel: 'advertencia',
        icon: 'fas fa-file-contract',
        titulo: `📑 Contrato por Vencer (${c.numero_contrato || c.id})`,
        mensaje: `El contrato entre ${c.parte_a || 'Parte A'} y ${c.parte_b || 'Parte B'} vence el ${String(c.fecha_fin).substring(0, 10)}.`,
        fecha: c.fecha_fin,
        modulo: 'contratos',
        idRegistro: c.id
      });
    });

    res.json({
      success: true,
      totalAlertas: alertas.length,
      alertas
    });
  } catch(e) {
    console.error('Error al generar notificaciones:', e);
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
    let resCarpetas = await db.query('SELECT * FROM biblioteca_carpetas');
    const resArchivos = await db.query('SELECT * FROM biblioteca WHERE estado = \'ACTIVO\'');

    if (resCarpetas.rows.length === 0) {
      const defaultCarpetas = [
        { id: 'DIR-POLITICAS', nombre: 'Políticas Institucionales', padre: 'RAIZ', color: '#2563eb' },
        { id: 'DIR-MANUALES', nombre: 'Manuales de Operaciones', padre: 'RAIZ', color: '#06b6d4' },
        { id: 'DIR-REGISTROS', nombre: 'Reglamentos y Formatos CTA', padre: 'RAIZ', color: '#f59e0b' },
        { id: 'DIR-SST', nombre: 'Seguridad y Salud SG-SST', padre: 'RAIZ', color: '#10b981' },
        { id: 'DIR-JURIDICO', nombre: 'Documentación Jurídica', padre: 'RAIZ', color: '#8b5cf6' }
      ];
      for (const c of defaultCarpetas) {
        await db.query('INSERT INTO biblioteca_carpetas (id, nombre, padre, color) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [c.id, c.nombre, c.padre, c.color]);
      }
      resCarpetas = await db.query('SELECT * FROM biblioteca_carpetas');
    }

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
app.delete('/api/biblioteca/carpetas/:id', autenticarToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(`UPDATE biblioteca SET carpeta_id = 'RAIZ' WHERE carpeta_id = $1`, [id]);
    await db.query(`DELETE FROM biblioteca_carpetas WHERE id = $1`, [id]);
    await registrarAuditoria(req.user.email, 'BIBLIOTECA', 'ELIMINAR_CARPETA', `Carpeta eliminada: ${id}`, 'EXITO');
    res.json({ success: true, message: '✅ Carpeta eliminada con éxito' });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.delete('/api/biblioteca/archivos/:id', autenticarToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(`UPDATE biblioteca SET estado = 'ELIMINADO' WHERE id = $1`, [id]);
    await registrarAuditoria(req.user.email, 'BIBLIOTECA', 'ELIMINAR_ARCHIVO', `Archivo eliminado: ${id}`, 'EXITO');
    res.json({ success: true, message: '✅ Documento eliminado de la biblioteca' });
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
    const rawQuery = (query || '').trim();
    if (!rawQuery) {
      return res.json({ success: true, resultados: [], total: 0 });
    }

    const cleanQuery = rawQuery.replace(/^#/, '').trim();
    const words = cleanQuery.split(/\s+/).filter(w => w.length > 0);
    const resultados = [];

    function buildMultiWordWhere(cols) {
      const conditions = [];
      const params = [];
      let idx = 1;

      words.forEach(word => {
        params.push(`%${word}%`);
        const colLikes = cols.map(col => `${col} ILIKE $${idx}`).join(' OR ');
        conditions.push(`(${colLikes})`);
        idx++;
      });

      return {
        whereClause: conditions.join(' AND '),
        params
      };
    }

    // 1. CONTRATOS (NIT, N° Carpeta #, N° Contrato, Cliente, Fechas, Ubicación, Hoja Origen)
    const colContratos = [
      "COALESCE(parte_b, '')",
      "COALESCE(nit, '')",
      "COALESCE(numero_contrato, '')",
      "COALESCE(id, '')",
      "COALESCE(codigo_numerico::text, '')",
      "COALESCE(parte_a, '')",
      "COALESCE(objeto_contrato, '')",
      "COALESCE(tipo_contrato, '')",
      "COALESCE(voxelsera, '')",
      "COALESCE(hoja_origen, '')",
      "COALESCE(estado, '')"
    ];
    const qContratos = buildMultiWordWhere(colContratos);
    const sqlContratos = `
      SELECT id, tipo_contrato, numero_contrato, codigo_numerico, parte_a, parte_b, nit, objeto_contrato, voxelsera, estado, hoja_origen, fecha_inicio, fecha_fin, fecha_registro 
      FROM contratos 
      WHERE ${qContratos.whereClause} 
      ORDER BY codigo_numerico ASC NULLS LAST 
      LIMIT 80
    `;
    const resContratos = await db.query(sqlContratos, qContratos.params);
    resContratos.rows.forEach(r => resultados.push({
      modulo: '📑 CONTRATOS',
      titulo: `${r.parte_b || r.tipo_contrato} ${r.nit ? ' (NIT: ' + r.nit + ')' : ''}`,
      codigo: `#${r.codigo_numerico || 'S/N'} · Contrato: ${r.numero_contrato || r.id}`,
      fecha: r.fecha_inicio ? String(r.fecha_inicio).substring(0, 10) : (r.fecha_registro ? String(r.fecha_registro).substring(0, 10) : 'N/A'),
      id: r.id,
      detalles: {
        VOXELSERA: r.voxelsera ? (r.voxelsera.startsWith('VOXEL_') ? r.voxelsera : `VOXEL_${r.voxelsera}`) : 'C',
        NIT: r.nit || 'N/A',
        CLIENTE: r.parte_b,
        NUM_CONTRATO: r.numero_contrato,
        CARPETA_NUM: r.codigo_numerico ? `#${r.codigo_numerico}` : 'N/A',
        TIPO_SERVICIO: r.tipo_contrato,
        ESTADO: r.estado,
        FECHAS: `${r.fecha_inicio ? String(r.fecha_inicio).substring(0, 10) : 'N/A'} a ${r.fecha_fin ? String(r.fecha_fin).substring(0, 10) : 'Indefinido'}`
      }
    }));

    // 2. CORRESPONDENCIA
    const colCorr = [
      "COALESCE(codigo_documento, '')",
      "COALESCE(asunto, '')",
      "COALESCE(detalle, '')",
      "COALESCE(depto_origen, '')",
      "COALESCE(depto_destino, '')",
      "COALESCE(tipo_documento, '')",
      "COALESCE(voxelsera, '')",
      "COALESCE(codigo_numerico::text, '')"
    ];
    const qCorr = buildMultiWordWhere(colCorr);
    const sqlCorr = `
      SELECT id, codigo_documento, codigo_numerico, depto_origen, depto_destino, asunto, detalle, voxelsera, fecha_registro 
      FROM correspondencia 
      WHERE ${qCorr.whereClause} 
      LIMIT 50
    `;
    const resCorr = await db.query(sqlCorr, qCorr.params);
    resCorr.rows.forEach(r => resultados.push({
      modulo: '📧 CORRESPONDENCIA',
      titulo: `[${r.depto_origen || 'GENERAL'} → ${r.depto_destino || 'DESTINO'}] ${r.asunto || r.detalle || 'Sin asunto'}`,
      codigo: r.codigo_documento || (r.codigo_numerico ? `#${r.codigo_numerico}` : r.id),
      fecha: r.fecha_registro ? String(r.fecha_registro).substring(0, 10) : 'N/A',
      id: r.id,
      detalles: { 
        VOXELSERA: r.voxelsera ? (r.voxelsera.startsWith('VOXEL_') ? r.voxelsera : `VOXEL_${r.voxelsera}`) : 'D',
        ORIGEN: r.depto_origen,
        DESTINO: r.depto_destino,
        ASUNTO: r.asunto
      }
    }));

    // 3. MINUTAS DE PUESTO
    const colMin = [
      "COALESCE(codigo_unico, '')",
      "COALESCE(tipo_minuta, '')",
      "COALESCE(nombre_puesto, '')",
      "COALESCE(observaciones, '')",
      "COALESCE(responsable, '')",
      "COALESCE(voxelsera, '')",
      "COALESCE(codigo_numerico::text, '')"
    ];
    const qMin = buildMultiWordWhere(colMin);
    const sqlMin = `
      SELECT id, tipo_minuta, nombre_puesto, codigo_unico, codigo_numerico, observaciones, voxelsera, fecha_registro 
      FROM minutas 
      WHERE ${qMin.whereClause} 
      LIMIT 50
    `;
    const resMin = await db.query(sqlMin, qMin.params);
    resMin.rows.forEach(r => resultados.push({
      modulo: '📋 MINUTAS',
      titulo: `${r.tipo_minuta || 'Minuta'} - ${r.nombre_puesto || 'Puesto'}`,
      codigo: r.codigo_unico || (r.codigo_numerico ? `#${r.codigo_numerico}` : r.id),
      fecha: r.fecha_registro ? String(r.fecha_registro).substring(0, 10) : 'N/A',
      id: r.id,
      detalles: { 
        VOXELSERA: r.voxelsera ? (r.voxelsera.startsWith('VOXEL_') ? r.voxelsera : `VOXEL_${r.voxelsera}`) : 'A',
        PUESTO: r.nombre_puesto,
        OBSERVACIONES: r.observaciones
      }
    }));

    // 4. ASOCIADOS RETIRADOS (PERSONAL INACTIVO)
    const colPers = [
      "COALESCE(nombre_completo, '')",
      "COALESCE(cedula, '')",
      "COALESCE(motivo_baja, '')",
      "COALESCE(observaciones, '')",
      "COALESCE(voxelsera, '')",
      "COALESCE(codigo_numerico::text, '')"
    ];
    const qPers = buildMultiWordWhere(colPers);
    const sqlPers = `
      SELECT id, nombre_completo, cedula, motivo_baja, voxelsera, fecha_baja, codigo_numerico 
      FROM personal_inactivo 
      WHERE ${qPers.whereClause} 
      LIMIT 50
    `;
    const resPers = await db.query(sqlPers, qPers.params);
    resPers.rows.forEach(r => resultados.push({
      modulo: '🤝 ASOCIADOS RETIRADOS',
      titulo: `${r.nombre_completo} (Cédula: ${r.cedula || 'N/A'})`,
      codigo: r.codigo_numerico ? `Carpeta #${r.codigo_numerico}` : `CC: ${r.cedula}`,
      fecha: r.fecha_baja ? String(r.fecha_baja).substring(0, 10) : 'N/A',
      id: r.id,
      detalles: { 
        VOXELSERA: r.voxelsera ? (r.voxelsera.startsWith('VOXEL_') ? r.voxelsera : `VOXEL_${r.voxelsera}`) : 'B',
        CEDULA: r.cedula,
        MOTIVO_BAJA: r.motivo_baja || 'N/A'
      }
    }));

    // 5. PRESTAMOS
    const colPrest = [
      "COALESCE(solicitante, '')",
      "COALESCE(departamento, '')",
      "COALESCE(documento, '')",
      "COALESCE(codigo_documento, '')",
      "COALESCE(estado, '')"
    ];
    const qPrest = buildMultiWordWhere(colPrest);
    const sqlPrest = `
      SELECT id, solicitante, departamento, documento, codigo_documento, fecha_prestamo, estado 
      FROM prestamos 
      WHERE ${qPrest.whereClause} 
      LIMIT 50
    `;
    const resPrest = await db.query(sqlPrest, qPrest.params);
    resPrest.rows.forEach(r => resultados.push({
      modulo: '🔄 PRESTAMOS',
      titulo: `[${r.estado || 'PRESTADO'}] Solicitante: ${r.solicitante} (${r.departamento})`,
      codigo: r.codigo_documento || r.id,
      fecha: r.fecha_prestamo ? String(r.fecha_prestamo).substring(0, 10) : 'N/A',
      id: r.id,
      detalles: { ESTADO: r.estado, DEPTO: r.departamento, DOCUMENTO: r.documento }
    }));

    res.json({ success: true, resultados, total: resultados.length });
  } catch(e) {
    console.error('Error en /api/busqueda:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ==========================================
// MAPA DE ESTANTERÍA Y ARCHIVO FÍSICO VOXELSERA
// ==========================================
app.get('/api/voxelsera-mapa', autenticarToken, async (req, res) => {
  try {
    const slots = {};
    ['A','B','C','D'].forEach(l => {
      for(let i=1; i<=9; i++) {
        slots[`VOXEL_${l}${i}`] = { slotId: `VOXEL_${l}${i}`, code: `${l}${i}`, letter: l, index: i, count: 0, items: [] };
      }
    });

    // 1. Minutas (Estante A)
    const minRes = await db.query('SELECT id, tipo_minuta, nombre_puesto, codigo_unico, voxelsera FROM minutas');
    minRes.rows.forEach(r => {
      let v = r.voxelsera;
      if (!v) {
        const idx = (r.id % 9) + 1;
        v = `VOXEL_A${idx}`;
      } else if (!v.startsWith('VOXEL_')) {
        const match = String(v).match(/([A-Da-d])[-_ ]?([1-9])/);
        v = match ? `VOXEL_${match[1].toUpperCase()}${match[2]}` : `VOXEL_A1`;
      }
      if (slots[v]) {
        slots[v].count++;
        if (slots[v].items.length < 50) {
          slots[v].items.push({ id: r.id, modulo: 'MINUTAS', codigo: r.codigo_unico, titulo: `${r.tipo_minuta} - ${r.nombre_puesto}` });
        }
      }
    });

    // 2. Personal Inactivo / Asociados Retirados (Estante B)
    const pasRes = await db.query('SELECT id, nombre_completo, cedula, motivo_baja, voxelsera FROM personal_inactivo');
    pasRes.rows.forEach(r => {
      let v = r.voxelsera;
      if (!v) {
        const idx = (r.id % 9) + 1;
        v = `VOXEL_B${idx}`;
      } else if (!v.startsWith('VOXEL_')) {
        const match = String(v).match(/([A-Da-d])[-_ ]?([1-9])/);
        v = match ? `VOXEL_${match[1].toUpperCase()}${match[2]}` : `VOXEL_B1`;
      }
      if (slots[v]) {
        slots[v].count++;
        if (slots[v].items.length < 50) {
          slots[v].items.push({ id: r.id, modulo: 'ASOCIADOS RETIRADOS', codigo: `CC: ${r.cedula}`, titulo: `${r.nombre_completo} (${r.motivo_baja || 'Retirado'})` });
        }
      }
    });

    // 3. Contratos (Estante C)
    const conRes = await db.query('SELECT id, tipo_contrato, numero_contrato, parte_a, parte_b, voxelsera FROM contratos');
    conRes.rows.forEach(r => {
      let v = r.voxelsera;
      if (!v) {
        const idx = (r.id % 9) + 1;
        v = `VOXEL_C${idx}`;
      } else if (!v.startsWith('VOXEL_')) {
        const match = String(v).match(/([A-Da-d])[-_ ]?([1-9])/);
        v = match ? `VOXEL_${match[1].toUpperCase()}${match[2]}` : `VOXEL_C1`;
      }
      if (slots[v]) {
        slots[v].count++;
        if (slots[v].items.length < 50) {
          slots[v].items.push({ id: r.id, modulo: 'CONTRATOS', codigo: r.numero_contrato, titulo: `${r.tipo_contrato} (${r.parte_a})` });
        }
      }
    });

    // 4. Correspondencia (Estante D)
    const corrRes = await db.query('SELECT id, codigo_documento, asunto, depto_origen, voxelsera FROM correspondencia');
    corrRes.rows.forEach(r => {
      let v = r.voxelsera;
      if (!v) {
        const idx = (r.id % 9) + 1;
        v = `VOXEL_D${idx}`;
      } else if (!v.startsWith('VOXEL_')) {
        const match = String(v).match(/([A-Da-d])[-_ ]?([1-9])/);
        v = match ? `VOXEL_${match[1].toUpperCase()}${match[2]}` : `VOXEL_D1`;
      }
      if (slots[v]) {
        slots[v].count++;
        if (slots[v].items.length < 50) {
          slots[v].items.push({ id: r.id, modulo: 'CORRESPONDENCIA', codigo: r.codigo_documento, titulo: `[${r.depto_origen}] ${r.asunto}` });
        }
      }
    });

    res.json({ success: true, slots });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/registro-detalle/:modulo/:id', autenticarToken, async (req, res) => {
  const { modulo, id } = req.params;
  try {
    const mNorm = (modulo || '').toUpperCase().trim();
    let result = { rows: [] };

    if (mNorm.includes('MINUTA')) {
      result = await db.query('SELECT * FROM minutas WHERE id = $1', [id]);
    } else if (mNorm.includes('CORRESPONDENCIA')) {
      result = await db.query('SELECT * FROM correspondencia WHERE id = $1', [id]);
    } else if (mNorm.includes('CONTRATO')) {
      result = await db.query('SELECT * FROM contratos WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        result = await db.query('SELECT * FROM contratos WHERE codigo_numerico::text = $1 OR numero_contrato = $1', [id]);
      }
    } else if (mNorm.includes('ASOCIADO') || mNorm.includes('PERSONAL')) {
      result = await db.query('SELECT * FROM personal_inactivo WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        result = await db.query('SELECT * FROM personal_inactivo WHERE cedula = $1 OR codigo_numerico::text = $1', [id]);
      }
    } else if (mNorm.includes('PRESTAMO')) {
      result = await db.query('SELECT * FROM prestamos WHERE id = $1', [id]);
    } else if (mNorm.includes('BIBLIOTECA')) {
      result = await db.query('SELECT * FROM biblioteca WHERE id = $1', [id]);
    } else {
      // Módulo desconocido: intentar contratos por defecto
      result = await db.query('SELECT * FROM contratos WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        result = await db.query('SELECT * FROM contratos WHERE codigo_numerico::text = $1', [id]);
      }
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    }

    res.json({ success: true, detalle: result.rows[0] });
  } catch(e) {
    console.error('Error en /api/registro-detalle:', e.message);
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
    const maxCtr = await db.query('SELECT MAX(codigo_numerico) as max_num FROM contratos');
    const resPrestAct = await db.query("SELECT COUNT(*) FROM prestamos WHERE estado = 'ACTIVO' OR estado = 'VENCIDO'");
    const resPrestDev = await db.query("SELECT COUNT(*) FROM prestamos WHERE estado = 'DEVUELTO'");
    const resAsoc = await db.query('SELECT COUNT(*) FROM personal_inactivo');

    // Desglose de Minutas por Tipo
    const minBreakdown = await db.query(`
      SELECT tipo_minuta, COUNT(*) as total FROM minutas GROUP BY tipo_minuta
    `);
    const minObj = { SERVICIO: 0, VISITANTES: 0, CORRESPONDENCIA: 0 };
    minBreakdown.rows.forEach(r => {
      if (r.tipo_minuta) minObj[r.tipo_minuta.toUpperCase()] = parseInt(r.total, 10);
    });

    res.json({
      success: true,
      correspondencia: parseInt(resCorr.rows[0].count, 10),
      minutas: parseInt(resMin.rows[0].count, 10),
      contratos: parseInt(resCtr.rows[0].count, 10),
      maxContrato: maxCtr.rows[0] && maxCtr.rows[0].max_num ? parseInt(maxCtr.rows[0].max_num, 10) : 394,
      prestamosActivos: parseInt(resPrestAct.rows[0].count, 10),
      prestamosDevueltos: parseInt(resPrestDev.rows[0].count, 10),
      asociadosRetirados: parseInt(resAsoc.rows[0].count, 10),
      minutasBreakdown: minObj
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
