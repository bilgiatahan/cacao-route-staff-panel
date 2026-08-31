# Cacao Route · Vardiya Yönetim Paneli

`Cacao Route Shift Panel.dc.html` prototipinin Next.js 16 (App Router) + Tailwind CSS v4
üzerine taşınmış hali. Ayrı bir backend yok: Server Actions + repository katmanı +
Supabase Postgres (Prisma 7).

## Çalıştırma

```bash
npm install
cp .env.example .env.local
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env.local
```

`.env.local` içine Supabase bağlantı dizelerini yaz. İkisi de Supabase panelinde
**Project Settings → Database → Connection string** altında:

| Değişken       | Kullanım         | Port   |
| -------------- | ---------------- | ------ |
| `DATABASE_URL` | uygulama sorguları | `6543` + `?pgbouncer=true` |
| `DIRECT_URL`   | sadece migration | `5432` |

Ayrım önemli: transaction pooler (`6543`) `prisma migrate`'in ürettiği DDL'i
çalıştıramaz, session pooler (`5432`) ise serverless runtime'ın açtığı çok sayıda
kısa ömürlü bağlantı için uygun değil.

### Auth değişkenleri

| Değişken          | Ne zaman gerekli                          | Açıklama |
| ----------------- | ----------------------------------------- | -------- |
| `AUTH_SECRET`     | **Her zaman** (yukarıdaki `openssl` satırı üretir) | Auth.js oturum imzalama anahtarı. Prodüksiyonda yoksa Auth.js `MissingSecret` atar ve giriş tamamen çalışmaz. |
| `AUTH_TRUST_HOST` | **Vercel dışındaki her prodüksiyon host'unda** | `true` yaz. |

`AUTH_TRUST_HOST` Auth.js v5'in ters vekil (reverse proxy) arkasında gelen
`Host` başlığına güvenip güvenmeyeceğini belirler. Vercel'de gerekmez: platform
`VERCEL=1` verir ve Auth.js bunu zaten güvenilir sayar. **Vercel dışında** —
kendi Node sunucun, Docker, Fly, Railway, bir nginx arkası — değişken yoksa
derleme ve sayfalar sorunsuz çalışır ama **her giriş denemesi `UntrustedHost`
ile başarısız olur**; teşhis edilmesi zor, tam bir kimlik doğrulama kesintisidir.

Uygulama `AUTH_URL` / `NEXTAUTH_URL` kullanmaz; tanımlamaya gerek yok.

Sonra şemayı kur ve demo veriyi yükle:

```bash
npm run db:migrate    # tabloları oluşturur

# db:seed YIKICIDIR ve yalnızca demo içindir: yazmadan önce yedi runtime
# tablosunun tamamını siler, yerine demo ekibi (Kadıköy adresleri, herkes için
# tek şifre) yazar. Bu yüzden açık bir onay değişkeni ister ve değişken yoksa
# veritabanına hiç bağlanmadan durur.
ALLOW_DATABASE_RESET=YES_I_KNOW_THIS_DELETES_ALL_DATA npm run db:seed

npm run dev           # http://localhost:3000
```

> **Bunu asla prodüksiyon veritabanına karşı çalıştırma.** `db:seed` ve
> `db:reset` yerel geliştirme ve demo içindir; ikisi de mevcut tüm veriyi siler.
> Gerçek kadroyu yüklemek için `scripts/reset-and-seed-real-roster.ts` var
> (aynı `ALLOW_DATABASE_RESET` koruması, artı doğrulama ve tek transaction).
> Hiçbir seed `build`, `postinstall` veya bir deploy adımına bağlı **değildir**
> ve bağlanmamalıdır.

### Demo hesapları

| Rol      | E-posta               | Şifre      |
| -------- | --------------------- | ---------- |
| Yönetici | `anima@cacaoroute.co` | `cacao123` |
| Çalışan  | `ella@cacaoroute.co`  | `cacao123` |

Tüm seed çalışanların e-postaları aynı şifreyle giriş yapar. Panelden eklenen
kişiler için şifre `Yeni Kişi` formundaki **Giriş Bilgileri** alanından verilir;
boş bırakılırsa kişi ekipte görünür ama panele giremez.

## Mimari

```
src/
├─ app/
│  ├─ (panel)/              # oturum gerektiren panel; ortak shell layout.tsx'te
│  │  ├─ summary/           # haftalık özet (yönetici + çalışan varyantı)
│  │  ├─ timetable/         # vardiya programı: tablo / kişi / gün görünümleri
│  │  ├─ leave/             # izin talepleri + vardiya değişimi
│  │  ├─ team/              # ekip listesi, kişi detayı, yeni kişi
│  │  ├─ settings/          # yönetici ayarları (ücret görünürlüğü)
│  │  └─ notifications/
│  ├─ login/
│  ├─ api/auth/[...nextauth]/
│  └─ layout.tsx            # Archivo fontu, <html lang> cookie'den
│
├─ components/
│  ├─ ui/                   # tasarım sistemi primitive'leri (Button, Field, StatTile…)
│  ├─ layout/               # AppHeader, BottomNav, WeekSwitcher
│  └─ features/             # ekrana özel bileşenler (summary/, timetable/, leave/, team/…)
│
├─ lib/
│  ├─ domain/               # saf iş kuralları: payroll, coverage, schedule
│  ├─ i18n/                 # TR/EN sözlükler + cookie tabanlı locale
│  ├─ date.ts format.ts     # ISO tarih + gösterim yardımcıları
│  └─ routes.ts week-params.ts
│
├─ server/                  # sadece sunucu (`import "server-only"`)
│  ├─ db/                   # client.ts (Prisma bağlantısı) + seed-data.ts (blueprint'ler)
│  ├─ repositories/         # veri erişimi — Prisma'yı bilen tek katman
│  ├─ services/             # roster, payroll, summary, leave, team, notification
│  ├─ actions/              # Server Actions (mutasyonlar)
│  └─ auth/                 # Auth.js config + data access layer (session.ts)
│
├─ types/domain.ts          # domain modeli
└─ proxy.ts                 # Next 16'da middleware'in yeni adı — iyimser oturum kontrolü

prisma/
├─ schema.prisma            # tablolar; domain.ts'e hizmet eder
├─ seed.ts                  # demo veri (tsx ile çalışır, server-only import edemez)
└─ migrations/
```

### Katman kuralları

- **Sayfalar** Server Component'tir; veriyi `server/services` üzerinden okur.
- **Servisler** repository'leri çağırır, `lib/domain` içindeki saf kuralları uygular ve
  ekrana hazır view model döner.
- **Repository'ler** Prisma'yı bilen tek katmandır ve `types/domain.ts` tipleri döner.
  Generated client (`@/generated/prisma/*`) yalnızca `server/db/client.ts` ile
  repository'lerin satır tiplerinde görünür; servis katmanı ve üstü Prisma tiplerini
  hiç görmez.
- **Yetkilendirme** veriye en yakın yerde yapılır (`server/auth/session.ts`).
  `proxy.ts` sadece cookie var mı diye bakar — Next.js auth rehberinin önerdiği
  "iyimser kontrol" yaklaşımı. Her Server Action kendi yetki kontrolünü ayrıca yapar.

### Durum yönetimi

Hafta, görünüm ve seçili gün React state'inde değil **URL'de** tutulur
(`?week=2026-08-03&view=day&day=2`). Böylece sayfalar sunucuda render edilebilir,
link paylaşılabilir ve geri tuşu doğru çalışır. Dil, `cr_locale` cookie'sinde durur.

Client component sayısı bilinçli olarak azdır: vardiya editörü, form'lar,
hafta/tab navigasyonu. Bunlara giden veri sunucuda formatlanır — sözlük istemci
paketine hiç girmez.

## İş kuralları

| Kural             | Yer                      | Değer                                        |
| ----------------- | ------------------------ | -------------------------------------------- |
| Bordro            | `lib/domain/payroll.ts`  | Her saat taban ücretten (fazla mesai yok)    |
| Kapsama boşluğu   | `lib/domain/coverage.ts` | Açılış 07:00 (60 dk tolerans), kapanış 19:00 |
| Aylık projeksiyon | `lib/date.ts`            | Haftalık program × aydaki pazartesi sayısı   |
| İzin gösterimi    | `lib/domain/schedule.ts` | **Onaylanmış** izin talebinden türetilir     |
| Ücret görünürlüğü | `server/services/settings.service.ts` | Yönetici daima görür; personel yalnızca ayar açıkken |

Son satır prototipteki bir tutarsızlığı kapatır: orada takvimdeki izin renklendirmesi
(`leaveDays`) ile izin talepleri birbirinden bağımsızdı. Artık bir talebi onaylamak
programı doğrudan değiştirir.

## Prototipe göre değişenler

- **Hafta okları artık çalışıyor.** Vardiyalar tarihe göre saklanır; ileri/geri gitmek
  gerçekten farklı veri gösterir (seed ±2 hafta üretir).
- **Gerçek kimlik doğrulama.** Rol, oturumdaki kullanıcıdan gelir; demo rol switch'i yok.
- **Vardiya değişimi onaylanınca vardiya gerçekten taşınır.**
- **Kişi silme soft delete'tir** — geçmiş bordro ve vardiya kayıtları korunur.
- **Ücret görünürlüğü yönetici ayarıdır.** `/settings` içindeki anahtar kapalıyken
  personel özetteki kazanç kartını, Bordro sekmesini ve profildeki saat ücretini
  görmez; tek karar noktası `canViewPay`.
- **Bildirimler kişiye özeldir** (`audience` + okundu kayıtları), okundu bilgisi
  kullanıcı bazlı — DB'de `notification_reads` join tablosu.

## Komutlar

```bash
npm run dev         # geliştirme sunucusu (Turbopack)
npm run build       # prisma generate + prodüksiyon derlemesi
npm run start       # derlenmiş sürümü çalıştır
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit

npm run db:migrate  # şema değişikliği → yeni migration
npm run db:deploy   # mevcut migration'ları uygula (prod)
npm run db:seed     # YIKICI · demo veriyi yaz (ALLOW_DATABASE_RESET ister)
npm run db:reset    # YIKICI · sıfırla + yeniden seed (ALLOW_DATABASE_RESET ister)
npm run db:studio   # Prisma Studio
```

## Veri kalıcılığı

Veri Supabase Postgres'te; Prisma 7 + `@prisma/adapter-pg` ile bağlanılır.
Bağlantı `src/server/db/client.ts` içinde `globalThis` üzerinde tutulur, böylece
hot reload her düzenlemede yeni bir connection pool açmaz.

Prisma 7'ye özgü, bilinmesi gerekenler:

- Generated client TypeScript kaynağı olarak `src/generated/prisma/` altına üretilir
  ve **git'e girmez** — `postinstall` ve `npm run build` yeniden üretir.
- `datasource` bloğunda `url` yazılamaz: migration bağlantısı `prisma.config.ts`'te
  (`DIRECT_URL`), runtime bağlantısı driver adapter'da (`DATABASE_URL`).
- Seed **otomatik çalışmaz**; `migrate dev` / `migrate reset` tetiklemez. Elle
  çağrıldığında da `ALLOW_DATABASE_RESET=YES_I_KNOW_THIS_DELETES_ALL_DATA`
  olmadan hiçbir şey yapmaz.

Seed vardiyaları, seed'in **çalıştığı** haftaya göre hesaplanıp kalıcı yazılır.
Haftalar ilerledikçe demo veri geride kalır; tazelemek için `npm run db:reset`.
