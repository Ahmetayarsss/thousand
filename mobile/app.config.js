// app.json'un üstüne derleme numarası: CI'da GITHUB_RUN_NUMBER (mobil-apk.yml) her derlemede artar,
// Android yeni APK'yı "güncelleme" sayar (eskisinin üstüne kurulur, veri kalır).
module.exports = ({ config }) => {
  const n = parseInt(process.env.GITHUB_RUN_NUMBER || "1", 10) || 1;
  return {
    ...config,
    version: "0.1." + n,
    android: { ...config.android, versionCode: n },
    ios: { ...config.ios, buildNumber: String(n) },
  };
};
