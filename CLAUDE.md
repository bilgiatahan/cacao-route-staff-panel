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
  `src/server/db/client.ts` ve repository'lerdeki satır tipleri import eder.
  `prisma` instance'ını sadece repository'ler kullanır.
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
- Kullanıcı kimliği **daima oturumdan** alınır, formdan değil (bkz.
  `createLeaveRequestAction`).

## Bu repodaki Next 16 kuralları

Eğitim verisinden farklı olanlar — `AGENTS.md` uyarısı ciddi:

- `middleware.ts` **yok**: `src/proxy.ts`, export adı `proxy`, runtime `nodejs`
  ve değiştirilemez.
- `revalidatePath` yerine `refresh()` from `next/cache` kullanılıyor (16 call site).
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
kuralı artık kodda değil DB'de. `shiftRepository.reassign` bu yüzden
`$transaction` kullanır (hedefin o günkü vardiyasını silmeden taşıma constraint'e
çarpar). Roster sırası `[isTaskRow, sortOrder]`; görev satırları hep sonda.

## Durum yönetimi

Hafta / görünüm / gün / dönem React state'inde değil **URL'de**:
`?week=&view=&day=&period=`. Yeni link üretirken `panelHref()`
(`src/lib/routes.ts`) kullan, elle string birleştirme yapma. Dil `cr_locale`
cookie'sinde.

Client component sayısı bilinçli olarak az (12 tane). Yeni bir tanesini eklemeden
önce sunucuda formatlanmış veri geçirmenin yetip yetmediğine bak.

## i18n

- `tr.ts` kaynak-doğrudur (`Dictionary = typeof tr`); `en.ts` yapısal olarak
  eşleşmek zorunda. Bir anahtar eklerken **ikisine de** ekle.
- Sözlük **client'a gönderilmez**. Server'da formatla, hazır string geçir —
  `WeekSwitcher`'ın ay adlarını önceden alması bu yüzden.
- `notification.service.ts` bildirimi yazma anında **iki dilde** render eder;
  okuma anında çeviri yapılmaz.

## İş kuralları ve yardımcılar

Hepsi saf fonksiyonlarda, tek yerde. UI'da yeniden hesaplama:

- Fazla mesai → `lib/domain/payroll.ts` (45 saat üstü 1.5×)
- Kapsama boşluğu → `lib/domain/coverage.ts` (07:00 + 60 dk tolerans, 19:00)
- İzin gölgelemesi → `lib/domain/schedule.ts` (onaylı taleplerden türetilir)
- Sabitler → `lib/constants.ts`
- Tarih/saat → `lib/date.ts`, `lib/format.ts`. `IsoDate` string, saat = gece
  yarısından itibaren **dakika**. Ad-hoc `new Date()` aritmetiği yapma.
- Görev satırları (`isTaskRow`) headcount, bordro ve izinden **hariç**.

## Görsel dil

Tailwind v4, config dosyası yok — tokenlar `src/app/globals.css` içinde `@theme`.
`--radius-*: initial` bilinçli: köşeler keskin. Yeni bir primitive yazmadan önce
`src/components/ui/` içine bak.

## Komutlar

```bash
npm run dev / build / start / lint / typecheck
npm run db:migrate   # şema değişikliği → migration
npm run db:seed      # demo veriyi yaz
npm run db:reset     # sıfırla + yeniden seed (demo haftasını bugüne taşır)
npm run db:studio    # Prisma Studio
```

Test altyapısı yok. Doğrulama: `npm run typecheck` + `npm run lint` + panelde
elle tıklama.
