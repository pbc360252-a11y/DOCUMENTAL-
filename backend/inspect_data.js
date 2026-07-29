const XLSX = require('xlsx');
const path = require('path');

// Leer el archivo principal de datos
const mainFile = path.join(__dirname, '../DATOS 001/📚APP GESTION DOCUMENTAL 💠.xlsx');
const minutasFile = path.join(__dirname, '../DATOS 001/LISTADO_UNICO_MINUTAS_SGD (1).xlsx');

console.log('📖 Leyendo archivos Excel...\n');

// Leer archivo principal
const wbMain = XLSX.readFile(mainFile);
console.log('📊 Archivo principal - Hojas disponibles:');
wbMain.SheetNames.forEach((name, i) => {
  const sheet = wbMain.Sheets[name];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const rows = data.filter(r => r.some(c => c !== '')).length;
  console.log(`  ${i + 1}. "${name}" — ${rows} filas`);
  if (data.length > 0 && data[0].length > 0) {
    console.log(`     Columnas: ${data[0].slice(0, 8).join(' | ')}`);
  }
});

console.log('');

// Leer archivo de minutas
const wbMinutas = XLSX.readFile(minutasFile);
console.log('📋 Archivo Minutas - Hojas disponibles:');
wbMinutas.SheetNames.forEach((name, i) => {
  const sheet = wbMinutas.Sheets[name];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const rows = data.filter(r => r.some(c => c !== '')).length;
  console.log(`  ${i + 1}. "${name}" — ${rows} filas`);
  if (data.length > 0) {
    console.log(`     Columnas: ${data[0].slice(0, 8).join(' | ')}`);
  }
  // Mostrar primeras 3 filas de datos
  if (data.length > 1) {
    console.log('     Muestra de datos:');
    data.slice(1, 4).forEach(row => {
      console.log(`       → ${row.slice(0, 6).join(' | ')}`);
    });
  }
});
