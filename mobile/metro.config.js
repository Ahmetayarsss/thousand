// Metro: proje dışındaki ortak dosyalar da paketlenir — Capacitor uygulamasıyla aynı çekirdek
// (app/www/srs.js, log.js) ve kelime sesleri (app/www/audio/*.mp3). Geçiş bitince (PLAN.md adım 40)
// bunlar mobile/'a taşınır ve bu ayar kalkar.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../app/www")];
// O klasörün üstünde node_modules yok: paketlerin (ör. ses için asset-registry) yeri burası.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];

module.exports = config;
