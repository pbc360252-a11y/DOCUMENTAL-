const fs = require('fs');
const path = require('path');

const srcOriginalJpg = path.join(__dirname, '../LOGO DE LA APP/logo_resized.jpg');
const srcOriginalPng = path.join(__dirname, '../LOGO DE LA APP/Gemini_Generated_Image_k3ntink3ntink3nt.png');

const destPng = path.join(__dirname, '../frontend/logo.png');
const destJpg = path.join(__dirname, '../frontend/logo.jpg');

if (fs.existsSync(srcOriginalJpg)) {
  fs.copyFileSync(srcOriginalJpg, destJpg);
  fs.copyFileSync(srcOriginalJpg, destPng);
  console.log('✅ Logo original de Coraza Seguridad C.T.A. restaurado exactamente como estaba.');
} else if (fs.existsSync(srcOriginalPng)) {
  fs.copyFileSync(srcOriginalPng, destPng);
  fs.copyFileSync(srcOriginalPng, destJpg);
  console.log('✅ Logo original PNG de Coraza Seguridad C.T.A. restaurado.');
} else {
  console.error('❌ Archivo de logo original no encontrado');
}
