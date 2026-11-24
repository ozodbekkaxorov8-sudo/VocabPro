# VocabPro

VocabPro maktabda lug‘at yodlash va o‘quvchilar bilimini tekshirish uchun mo‘ljallangan. O‘quvchi ismi va sinfini yozib kiradi. U faqat o‘qituvchi faollashtirgan, o‘z sinfiga yoki barcha sinflarga ochilgan lug‘atlarni ko‘radi.

## Foydalanish

1. O‘qituvchi paneliga `TEACHER_CODE` orqali kiring va **Yangi test** tugmasini bosing.
2. Sinfni belgilang yoki barcha sinflar uchun bo‘sh qoldiring. So‘z va tarjimalarni qo‘lda, matndan, PDF yoki OpenDocument faylidan, yoxud rasmdan kiriting. Import qilingan matnni saqlashdan oldin tahrirlash mumkin.
3. Testni saqlang va **Testlar** bo‘limida faollashtiring.
4. O‘quvchi kartochkalar orqali yodlashni yoki testni to‘liq ekranda boshlashni tanlaydi. To‘liq ekrandan chiqish, vaqt tugashi yoki aloqa tiklanmay qolishi urinishni yakunlaydi.
5. **Natijalar** bo‘limida har bir urinish, o‘quvchilar soni va o‘rtacha foiz ko‘rinadi. Bir xil ism va sinf kombinatsiyasi bitta o‘quvchi sifatida hisoblanadi. O‘rtacha foiz yakunlangan urinishlar bo‘yicha olinadi.

Yozma savollarda bitta so‘zning tarjimasi so‘raladi. O‘quvchi javobni qo‘lda yozadi, avtomatik to‘ldirish va imlo takliflari o‘chirilgan. **Moslashtirish** testida o‘quvchi tarjimani variantlardan tanlaydi. **Matching headings** testida o‘quvchi so‘zni guruhga moslaydi. **Aralash** test yozma va moslashtirish savollarini beradi. So‘zlar guruhlangan bo‘lsa, Matching Headings savollari ham qo‘shiladi.

Matndan import qilish uchun har qatorda so‘z va tarjimani yozing. Matching Headings uchun guruhni uchinchi qiymat sifatida kiriting yoki importdan keyin **So‘zlarni guruhlash** bo‘limida belgilang.

```text
apple | olma
carrot | sabzi
tea | choy
```

Import .pdf, .odt, .ods, .png, .jpg va .webp fayllarini qabul qiladi. Chegara 8 MB va PDF uchun 8 sahifa. ODT hamda ODS fayllarida so‘z, tarjima va guruh ustunlarini saqlash mumkin. Skan va rasmlardan olingan matnni tekshirib chiqing.

## Mahalliy ishga tushirish

Python 3.13, `uv`, Node.js 22+ va alohida PostgreSQL bazasi kerak. Ildiz papkada `.env.local` yarating va quyidagi qiymatlarni o‘z muhitiga moslang.

```dotenv
DATABASE_URL=postgresql://vocabpro:YOUR_DATABASE_PASSWORD@127.0.0.1:55432/vocabpro
SESSION_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
TEACHER_CODE=YOUR_PRIVATE_CODE_AT_LEAST_8_CHARACTERS
APP_ORIGIN=http://127.0.0.1:3000
SECURE_COOKIES=false
```

Backend uchun alohida terminal oching. Migratsiyalar backend ishga tushganda qo‘llanadi.

```powershell
cd backend
uv sync --frozen --python 3.13
uv run --frozen --env-file ../.env.local uvicorn vocabpro.main:app --loop vocabpro.serve:selector_loop_factory --host 127.0.0.1 --port 8000
```

Frontendni ikkinchi terminalda ishga tushiring.

```powershell
cd frontend
npm ci
npm run dev
```

[Mahalliy VocabPro](http://127.0.0.1:3000/) manzilini oching. Ushbu Windows ish papkasida dastlabki ishga tushirish uchun `.runtime/postgres` ichida alohida mahalliy PostgreSQL klasteri tayyorlangan. Kompyuter qayta ishga tushgach, shu bazani yana ochish uchun ildiz papkadan quyidagi buyruqni bajaring.

```powershell
& 'C:/Program Files/PostgreSQL/19/bin/pg_ctl.exe' -D '.runtime/postgres' -l '.runtime/postgres.log' -o '-h 127.0.0.1 -p 55432' -w start
```

Namuna lug‘atlarni toza bazaga qo‘shish uchun `backend` papkasida `uv run --frozen --env-file ../.env.local python -m vocabpro.demo` ni bajaring. Namunalarga `7-A` sinfi orqali kiriladi.

## PWA va to‘liq ekran

Saytga birinchi kirishda o‘rnatish taklifi chiqadi. Qo‘llaydigan brauzerlar o‘z o‘rnatish oynasini ochadi. iOS Safari foydalanuvchilari ulashish menyusidan bosh ekranga qo‘shishlari mumkin. PWA va testlar uchun ishlab chiqarish muhitida HTTPS ishlating. Testni boshlash uchun brauzer elementni to‘liq ekran qilishni qo‘llashi kerak. Bu imkoniyat cheklangan ichki brauzerlarda testni Chrome yoki Edge’ning alohida oynasida oching. Test topshirish uchun internet aloqasi kerak.

## Telegram

1. Telegram botini tayyorlang va `TELEGRAM_BOT_TOKEN` ni backend muhitiga kiriting. Backendni qayta ishga tushiring.
2. Botga `/start` yuboring. Bot yangilanishlaridagi `message.chat.id` qiymatini toping.
3. O‘qituvchi panelidagi **Telegram** bo‘limiga chat ID ni kiritib, **Ulash** ni bosing.

Xabarda o‘quvchining ismi, sinfi va natijasi yuboriladi. Test yakunlanishi va xabar navbatga qo‘yilishi bitta tranzaksiyada saqlanadi. Telegram vaqtincha javob bermasa, job yuborishni qayta urinadi. [Telegram Bot API](https://core.telegram.org/bots/api#getupdates)

## Tuzilishi va keyingi joylashtirish

- **FastAPI** modul monoliti sessiya, lug‘at katalogi, urinishlar, import, natijalar va Telegram modullaridan tashkil topgan. OCR alohida threadda bajariladi va bir vaqtda bitta faylni qayta ishlaydi.
- **PostgreSQL** asinxron ulanish havzasi, sinf bo‘yicha faol testlar va yakunlangan urinishlar uchun indekslardan foydalanadi. Urinish boshlanganda savollar nusxasi saqlanadi. Javoblar versiya bilan yangilanadi va bir urinish takroriy so‘rov kelganda bir marta baholanadi.
- **Next.js** o‘quvchi, test va o‘qituvchi modullarini talabga qarab yuklaydi. PWA service worker internet uzilganda holat sahifasini ko‘rsatadi. O‘quvchi va o‘qituvchi API javoblari keshga olinmaydi.

Docker Compose konfiguratsiyasi lokal ishlash uchun tayyorlangan. `.env.example` asosida `.env` yaratib, maxfiy qiymatlarni belgilang. PostgreSQL administratori va API uchun alohida parollardan foydalaning. Keyin `docker compose up --build -d` orqali xizmatlarni ochish mumkin. Serverga joylashda sayt domenini `APP_ORIGIN` ga yozing, HTTPS reverse proxy sozlang va `SECURE_COOKIES=true` ni qo‘ying. API hamda baza ichki tarmoqda ishlaydi, web porti standart holatda faqat loopback manziliga bog‘lanadi.

Frontendni tekshirish uchun `npm run typecheck` va `npm run build` buyruqlarini `frontend` papkasida bajaring. Backend va PostgreSQL tayyorligini `GET /api/health` orqali tekshirish mumkin.

## Hostless orqali joylash

1. Supabase’da **Free** loyiha yarating. PostgreSQL ilova orqali ishlatiladi, shuning uchun **Data API** tanlovini o‘chiring. **Connect → Session pooler → URI** orqali ulanish manzilini oling. Manzildagi parol o‘rniga loyiha parolini yozing. **Database Settings** bo‘limidan PostgreSQL sertifikatini yuklab oling. [Supabase ulanish qo‘llanmasi](https://supabase.com/docs/guides/database/psql)
2. Hostless’da **Create resource → App** ni tanlang, GitHub’dagi VocabPro repozitoriysini ulang va build turiga **Docker** ni belgilang. Ish papkasi `/`, Dockerfile yo‘li `./Dockerfile`. [Hostless joylash qo‘llanmasi](https://docs.hostless.cloud/started)
3. **Environment variables** bo‘limiga quyidagi qiymatlarni kiriting. `APP_ORIGIN` oxirida `/` belgisi bo‘lmaydi.

   | O‘zgaruvchi | Qiymat |
   | --- | --- |
   | `APP_ORIGIN` | Hostless bergan saytning HTTPS manzili |
   | `DATABASE_URL` | Supabase Session pooler URI, oxiriga `?sslmode=verify-full` qo‘shilgan holda. URI’da `sslmode` bo‘lsa, qiymatini `verify-full` ga almashtiring. |
   | `DATABASE_CA_CERTIFICATE` | Supabase’dan yuklangan sertifikatning to‘liq PEM matni |
   | `SESSION_SECRET` | Kamida 32 belgili tasodifiy maxfiy qiymat |
   | `TEACHER_CODE` | O‘qituvchi uchun kamida 8 belgili maxfiy kod |
   | `SECURE_COOKIES` | `true` |

   Sessiya kalitini PowerShell’da `node -p "require('node:crypto').randomBytes(32).toString('hex')"` orqali yaratish mumkin. Qiymatlarni Hostless sozlamasida saqlang.
4. Deploy tugagach, saytning `/api/health` manzilida `{"status":"ok"}` chiqishini tekshiring. Ustoz panelida sinov testini faollashtiring, o‘quvchi panelidan topshiring va natijani ustoz panelida tekshiring.
