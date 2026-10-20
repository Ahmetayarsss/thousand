// app.json'un üstüne derleme numarası: CI'da GITHUB_RUN_NUMBER (build-apk.yml) her derlemede artar,
// Android yeni APK'yı "güncelleme" sayar (eskisinin üstüne kurulur, veri kalır). Eski (Capacitor) uygulama da
// aynı iş akışının numarasını kullanıyordu (sürüm "1.<n>"), yani yeni uygulama ("2.<n>") onun üstüne kurulur.
module.exports = ({ config }) => {
  const n = parseInt(process.env.GITHUB_RUN_NUMBER || "1", 10) || 1;
  return {
    ...config,
    version: "2." + n,
    android: { ...config.android, versionCode: n },
    ios: { ...config.ios, buildNumber: String(n) },
  };
};
