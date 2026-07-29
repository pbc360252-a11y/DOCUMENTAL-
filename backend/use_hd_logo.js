const fs = require('fs');
const path = require('path');

const srcHdPng = path.join(__dirname, '../LOGO DE LA APP/Gemini_Generated_Image_k3ntink3ntink3nt.png');
const destPng = path.join(__dirname, '../frontend/logo.png');
const destJpg = path.join(__dirname, '../frontend/logo.jpg');

if (fs.existsSync(srcHdPng)) {
  fs.copyFileSync(srcHdPng, destPng);
  fs.copyFileSync(srcHdPng, destJpg);
  console.log('✅ Logo de alta resolución HD (1.95 MB PNG) copiado exitosamente a frontend/logo.png');
} else {
  console.error('❌ Archivo HD no encontrado');
}
