# Yayın derlemesi küçültülüyor (R8, tam mod). WorkManager'ın veritabanı (Room) ve arka plan işlerimiz yansıma
# (reflection) yoluyla, sınıf adıyla kurulur: kurucuları atılmasın (yoksa uygulama açılışta çöker).
-keep class androidx.work.impl.WorkDatabase_Impl { *; }
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class expo.modules.bildirim.ArkadasWorker { <init>(android.content.Context, androidx.work.WorkerParameters); }
-keep class expo.modules.bildirim.HatirlatmaWorker { <init>(android.content.Context, androidx.work.WorkerParameters); }
