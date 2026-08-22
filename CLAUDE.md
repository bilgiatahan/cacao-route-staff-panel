@AGENTS.md

# Cacao Route · Vardiya Yönetim Paneli

Kadıköy'deki bir kafe için iki rollü (admin / staff) vardiya yönetim paneli.
Mobile-first, 560px tek kolon, TR/EN iki dilli.

**Ayrı bir backend yok ve olmayacak.** Sayfalar Server Component, mutasyonlar
Server Action. `src/app/api/` altında yalnızca Auth.js handler'ı var — yeni bir
route handler eklemeden önce bunun gerçekten gerektiğini gerekçelendir; veri
okuma Server Component'te, yazma Server Action'da yapılır.

Kurulum, demo hesaplar, dizin ağacı ve iş kuralları tablosu için `README.md`.
Bu dosya onu tekrar etmez; burada yalnızca **yanlış yapılması muhtemel** şeyler var.

## Katman kuralı

```
page / layout (Server Component)
  └─ src/server/services/*        ← view model üretir, lib/domain kurallarını uygular
       └─ src/server/repositories/*  ← tek veri erişim katmanı
            └─ src/server/db/client.ts  ← Prisma bağlantısı
```

- Generated Prisma client'ı (`@/generated/prisma/*`) **yalnızca**
  `src/server/db/client.ts` ve repository'ler import eder — satır tipleri
  (`EmployeeModel`…) ve `Prisma.TransactionClient` için. `prisma` instance'ını
  sadece repository'ler kullanır.
- Repository'ler kural olarak birbirini import **etmez**. Tek istisna: bir
  transaction iki tabloyu birden kapsıyorsa (`swap.repository` →
  `shift.repository`, bkz. "Takas onayı atomiktir"). Servis ve action katmanı
  `prisma`'ya dokunamadığı için transaction açmak veri katmanının işi.
- Servis katmanı ve üstü Prisma tiplerini **hiç görmez** — sadece
  `src/types/domain.ts`. Her repository kendi mapper'ıyla (`toEmployee`,
  `toLeaveRequest`…) satırı domain tipine çevirir: `Decimal → Number`,
  `DateTime → .toISOString()`, iki kolon → `Localized`.
- `src/types/domain.ts` sözleşmedir. Şema ona hizmet eder, tersi değil.

## Yetkilendirme

- `src/proxy.ts` yalnızca **cookie var mı** diye bakar (her istekte, prefetch'lerde
  de çalıştığı için DB'ye gitmez). Gerçek kontrol asla burada değil.
- Gerçek kontrol veriye en yakın yerde: `src/server/auth/session.ts`.
  Sayfalar `requireSessionUser` / `requireAdmin` / `requireCurrentEmployee`
  (redirect eder), server action'lar `assertAuthenticated` / `assertAdmin`
  (throw eder) ile başlar. **İstisnasız her server action** kendi kontrolünü yapar —
  Server Function'lar doğrudan POST ile de çağrılabilir.
- `getSessionUser` React `cache()` ile sarılı; istek içinde tek sorgu. Yeni bir
  per-request lookup eklerken aynısını yap.
- Action'lar cümle değil **hata anahtarı** döner (`ActionResult` +
  `ActionErrorKey`); çeviriyi client `actionErrorMessage` ile yapar. Yeni bir
  hata eklerken: `action-result.ts` union'ı + `actionErrorMessage` case'i + `tr.ts`
  + `en.ts`.
- Yetki hatası **string değil tip**: `assertAdmin` / `assertAuthenticated`
  `AuthorizationError` (`src/lib/auth-error.ts`) atar, `toActionResult`
  `instanceof` ile daraltır. `throw new Error("FORBIDDEN")` **yazma** — artık
  `unexpected`'a düşer. `AuthErrorKind`, `ActionErrorKey`'in alt kümesi olduğu
  için kind doğrudan geçer; birini yeniden adlandırmak derleme hatası verir.
  Sınıf `lib/` altında, çünkü `action-result.ts`'i 6 client component import
  ediyor — oraya `server-only` giremez.
- Kullanıcı kimliği **daima oturumdan** alınır, formdan değil (bkz.
  `createLeaveRequestAction`).

## Bu repodaki Next 16 kuralları

Eğitim verisinden farklı olanlar — `AGENTS.md` uyarısı ciddi:

- `middleware.ts` **yok**: `src/proxy.ts`, export adı `proxy`, runtime `nodejs`
  ve değiştirilemez.
- `revalidatePath` yerine `refresh()` from `next/cache` kullanılıyor (11 call site).
  `refresh()` ve `updateTag()` **yalnızca Server Action'larda** çalışır.
- `params`, `searchParams`, `cookies()` hepsi **Promise** — `await` şart.
- `revalidateTag` eklersen **ikinci argüman zorunlu** (`revalidateTag("x", "max")`),
  tek argümanlı hâli TypeScript hatası.
- `unstable_cache` **kullanma** — 16'da `use cache` ile değiştirildi.
  `cacheComponents` şu an kapalı, yani sorgular dinamik; panel verisi kullanıcıya
  özel ve sürekli değiştiği için bu doğru varsayılan.

## Prisma 7 kuralları

Prisma 7 eski sürümlerden ciddi biçimde ayrılıyor:

- Generator `provider = "prisma-client"` + **`output` zorunlu**; client TypeScript
  kaynağı olarak `src/generated/prisma/` altına üretilir (gitignore'da,
  `postinstall` ve `build` yeniden üretir).
- **Driver adapter zorunlu**: `PrismaPg` + `DATABASE_URL`.
- `datasource` bloğunda **`url` yazılamaz**. Migration bağlantısı
  `prisma.config.ts`'te (`DIRECT_URL`), runtime bağlantısı adapter'da
  (`DATABASE_URL`).
- Seed **otomatik çalışmaz** — `migrate dev` / `migrate reset` tetiklemez.
  `npm run db:seed` ya da `npm run db:reset`.
- Satır tipleri `EmployeeModel`, `LeaveRequestModel`… şeklinde (`Employee` değil),
  `@/generated/prisma/models` barrel'ından.
- Şema değişince: `npm run db:migrate`.
- `prisma/seed.ts` `tsx` ile çalışır, yani Next runtime'ı yoktur:
  **`import "server-only"` içeren hiçbir modülü import edemez.** `seed-data.ts` ve
  `src/lib/date.ts` temizdir, onlar kullanılabilir.

### Şemadaki üç bilinçli karar

| Domain | Postgres | Neden |
| --- | --- | --- |
| `IsoDate` (`YYYY-MM-DD`) | `String @db.VarChar(10)` | `src/lib/date.ts` tamamen local-midnight string aritmetiği; `date` tipine çevirmek timezone kayması getirir. `YYYY-MM-DD`'de sözlük sırası = kronolojik sıra, range sorguları aynen çalışır. |
| `Localized` | iki skaler kolon (`positionTr`/`positionEn`) | JSON'a göre tip-güvenli ve Supabase tablo editöründe okunabilir. |
| `NotificationAudience` union | `audienceKind` enum + `audienceEmployeeId` | Düzleştirilmiş discriminant; `readBy: string[]` ise `NotificationRead` join tablosu, böylece okunmamış sayısı tek `count()`. |

Ayrıca: `Shift` üzerinde `@@unique([employeeId, date])` var — "günde bir vardiya"
kuralı artık kodda değil DB'de. Hedefin o günkü vardiyasını silmeden taşıma
constraint'e çarpar, o yüzden silme + taşıma aynı transaction'da olmak zorunda
(bkz. aşağıdaki bölüm). Roster sırası `[isTaskRow, sortOrder]`; görev satırları
hep sonda.

### Takas onayı atomiktir

Onay hem talebin durumunu hem gerçek vardiyayı değiştirir; ikisi tek
transaction'da olmak zorunda, yoksa talep "onaylandı" görünürken vardiya
taşınmamış olabilir (bu bir kez oldu, geri gelmesin):

- `swapRepository.approve(id)` interactive `$transaction` açar: `status: "pending"`
  guard'ı + durum güncellemesi + `shiftRepository.reassign`. Vardiya taşınamazsa
  modül-içi bir sentinel hata atılır, transaction geri alınır ve `null` döner —
  talep `pending` kalır, vardiya geri gelince tekrar denenebilir.
- `shiftRepository.reassign` **kendi transaction'ını açmaz**; ilk parametresi
  `Prisma.TransactionClient`, yani **yalnızca bir transaction içinden**
  çağrılabilir. Transaction'sız bir çağıran gerekirse ona ayrı bir sarmalayıcı
  yaz; `tx`'i optional yapıp ölü dal ekleme.
- Reddetme vardiyaya dokunmaz, o yüzden düz `swapRepository.decide`'da kalır.
- Bildirim `null` kontrolünden **sonra** gönderilir: başarı bildirimi ancak
  yazma gerçekten olduysa çıkar.

## Durum yönetimi

Hafta / görünüm / gün / dönem React state'inde değil **URL'de**:
`?week=&view=&day=&period=`. Yeni link üretirken `panelHref()`
(`src/lib/routes.ts`) kullan, elle string birleştirme yapma. Dil `cr_locale`
cookie'sinde.

Client component sayısı bilinçli olarak az (14 tane). Yeni bir tanesini eklemeden
önce sunucuda formatlanmış veri geçirmenin yetip yetmediğine bak.

## i18n

- `tr.ts` kaynak-doğrudur (`Dictionary = typeof tr`); `en.ts` yapısal olarak
  eşleşmek zorunda. Bir anahtar eklerken **ikisine de** ekle.
- Sözlük **client'a gönderilmez**. Server'da formatla, hazır string geçir —
  kanonik örnek `components/features/timetable/view-model.ts`: `RosterBoard`'a
  yalnızca bitmiş string'ler gider, ne dictionary ne domain tipleri. (Kurala
  uymayan yer: 5 form bileşeni `dict`'in tamamını alıyor. Örnek alma.)
- `notification.service.ts` bildirimi yazma anında **iki dilde** render eder;
  okuma anında çeviri yapılmaz.

## İş kuralları ve yardımcılar

Hepsi saf fonksiyonlarda, tek yerde. UI'da yeniden hesaplama:

- Bordro → `lib/domain/payroll.ts` (her saat taban ücretten; fazla mesai kuralı yok)
- Kapsama boşluğu → `lib/domain/coverage.ts` (07:00 + 60 dk tolerans, 19:00)
- İzin gölgelemesi → `lib/domain/schedule.ts` (onaylı taleplerden türetilir)
- Sabitler → `lib/constants.ts`
- Tarih/saat → `lib/date.ts`, `lib/format.ts`. `IsoDate` string, saat = gece
  yarısından itibaren **dakika**. Ad-hoc `new Date()` aritmetiği yapma.
- Görev satırları (`isTaskRow`) headcount, bordro ve izinden **hariç**.
- Admin **roster satırı almaz** → `isRosterMember` (`lib/employee.ts`), tek uygulama
  yeri `getRosterWeek`. `rows`/`staffRows`/bordro/kapsama hepsi oradan türediği için
  filtre bir kez yazılır. `RosterWeek.employees` ve `leave.service`'teki `byId`
  filtrelenmez — onlar isim sözlüğü, roster değil.

## Görsel dil

Tailwind v4, config dosyası yok — tokenlar `src/app/globals.css` içinde `@theme`.
Yeni bir primitive yazmadan önce `src/components/ui/` içine bak.

### Primitive katmanı

Ekranlar bu primitive'lerin üstüne kurulur; birine paralel ikinci bir sürüm
yazmak yerine mevcut olanı genişlet.

- **Button** — `rounded-md`, asla pill. Boyutlar `sm` 40px / `md` 44px / `lg`
  48px; `sm` yalnızca yoğun satır içi kontroller için, ana dokunma hedefi
  değil. `loading` prop'u tıklamayı kapatır, `aria-busy` verir, spinner gösterir
  ve **etiketi görünmez tutarak genişliği korur** — bu yüzden children sabit
  etiket olmalı, "Kaydediliyor" gibi anlık metin `loadingLabel`'a gider.
  `disabled` görünümü `opacity` değil `bg-fill` + `text-disabled`.
- **Badge** — semantik tonlar: `neutral` / `info` / `success` / `warning` /
  `danger`, her biri kendi washına 4.5:1 üstünde. `StatusBadge` bunun domain
  sarmalayıcısı (`RequestStatus` → ton); yeni bir çip için doğrudan `Badge`.
- **Card** — kanonik yüzey: `rounded-lg`, hairline `border-line`, beyaz zemin.
  `padding` opsiyonel (`none` varsayılan, çünkü mevcut çağıranlar kendi
  padding'ini veriyor); yeni kodda `padding="md"` tercih et. `elevated`
  `shadow-sm` ekler.
- **Form kontrolleri** — tek durum modeli: hover, focus, `disabled`,
  `read-only`, ve **`aria-invalid` ile sürülen invalid** — böylece görünüm ile
  duyuru asla ayrışmaz. `text-control` (16px) pazarlığa açık değil, iOS zoom'u
  o yüzden yok. `Field` bir `error` slotu alır ve onu `<label>` **dışına**
  koyar; içine koymak hatayı kontrolün erişilebilir *adına* karıştırır.
- **Alert / EmptyState / Skeleton / ConfirmDialog** — geri bildirim katmanı,
  bkz. `Alert` tonları ve `useActionFeedback`. `FormError` artık `Alert`
  takma adı.
- **SegmentedControl** — segmentler link, seçim URL'de. Bir zamanlar `tone`,
  `bordered`, `variant` prop'ları vardı ve implementasyon hiçbirini okumuyordu;
  kaldırıldılar.

### Tek gri kuralı

Sadece **bir** ikincil gri var: `--color-muted`. Yanında duran `muted-soft`
kaldırıldı — ikisi de AA'yı geçmek zorunda kalınca aralarında 0.5 kontrast oranı
kaldı, bu kimsenin görebileceği bir hiyerarşi değil. Üçüncü seviye vurgu **boyut
ve ağırlıkla** yapılır, yeni bir açık gri eklenerek değil.

İki ailesi var, karıştırma:

- **Ruled** (program, izin, ekip, bildirim): keskin köşe, 2px ink çizgi,
  uçtan uca satır, beyaz zemin. `RuledList`, `SectionHeading`, `PageHeader`
  varsayılan (`variant="rule"`).
- **Card** (özet, profil, ekip'in staff görünümü): `bg-fill` zemin üstünde
  `Card` yüzeyleri — hairline `border-line`, `rounded-lg`, aksan renkli kenar/çip.
  `SegmentedControl variant="pill"`, `SectionHeading variant="plain"`.

`--radius-*: initial` hâlâ geçerli; geri konan tek şey `sm/md/lg/full` merdiveni,
kart yüzeyleri için. Aradaki değerler yok.

Zemin sorumluluğu sayfada: `(panel)/layout.tsx` içindeki `<main>` `bg-fill`,
ruled sayfalar kök `<section>`'da kendi `bg-surface`'ini boyar.

Aksan paleti (`--color-accent-*`) satır ayırt etmek için; kişi → renk eşlemesi
`accentForId()` ile deterministik, elle renk seçme.

Durum **hiçbir zaman yalnız renkle** anlatılmaz. Roster'da boş gün buna örnek:
dolgu (`bg-fill` vs `bg-brand`) görsel hiyerarşiyi kurar, ama hücrenin durumu
ayrıca `view-model`'deki `stateLabel` ile metne yazılır ve `RosterBoard` onu
`aria-label`'a koyar. Okunamayan bir glif tek temsil olamaz.

### İkonlar

Elle SVG çizme, `src/components/ui/Icon.tsx` içindeki `ICONS` haritasına bir
satır ekle. İsimler **anlamsal** (`pay`, `timetable`, `leave`), Lucide'ın adı
değil — çizim değişse de çağrı yerleri sabit kalır.

Paket **`lucide`**, `lucide-react` değil: v1'den beri her `lucide-react` bileşeni
`"use client"` taşıyor, yani her glif kendi client boundary'si olurdu. `lucide`
düz `[tag, attrs]` dizileri veriyor; `Icon` böylece server component kalıyor,
tarayıcıya ikon kodu gitmiyor. `sideEffects: false` olduğu için kullanılmayan
2000 ikon bundle'a girmiyor (doğrulandı).

Lucide 2px yuvarlak uçla çiziyor; `Icon` tüm seti 1.75px + `square` uç +
`miter` birleşimle yeniden stillendiriyor — panelin geri kalanıyla aynı geometri.

## Komutlar

```bash
npm run dev / build / start / lint / typecheck
npm test             # vitest run — yerel Postgres gerekir, aşağıya bak
npm run test:watch
npm run db:migrate   # şema değişikliği → migration
npm run db:seed      # demo veriyi yaz
npm run db:reset     # sıfırla + yeniden seed (demo haftasını bugüne taşır)
npm run db:studio    # Prisma Studio
```

## Testler

Doğrulama: `npm test` + `npm run typecheck` + `npm run lint` + panelde elle
tıklama.

- Vitest. Testler `tests/**/*.test.ts`; şu an 3 dosya / 47 test:
  `swap-approval`, `auth-errors`, `weekday-index`.
- **Docker kullanılmıyor.** `tests/support/global-setup.ts` her koşuda
  `initdb`/`pg_ctl` ile `/tmp` altında tek kullanımlık bir cluster kurar
  (port 54329), migration'ları uygular, koşu sonunda siler. Homebrew
  `postgresql@18` gerekiyor. PostgreSQL 18 macOS'ta `LC_ALL` set edilmeden
  "postmaster became multithreaded" ile ölüyor, o yüzden child process'lere
  veriliyor.
- `assertIsTestDatabase` bağlantı URL'ini doğruluyor: testler Supabase'e
  **bağlanamaz**. `prisma.config.ts` `dotenv/config` çağırdığı için bu önemli.
- Testlerde `server-only` boş bir stub'a alias'lanır (gerçeği RSC dışında
  throw eder). `next/cache` ve `@/server/auth/session` `vi.mock` ile veriliyor.
- Testler tek veritabanını paylaştığı için `fileParallelism: false`.
- Saf birim testleri de bu global setup'ı tetikliyor (~2 sn ek maliyet).
- Transaction davranışını mock'la doğrulamak mümkün değil: `swap-approval`
  gerçek `BEGIN`/`ROLLBACK` istediği için gerçek sunucuya koşuyor.
