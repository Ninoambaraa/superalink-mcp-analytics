# Analytics MCP

Mastra-based agents dan workflow untuk cuaca serta analitik pembayaran. Proyek ini menyiapkan dua agent (cuaca dan analitik Stripe/PayPal), workflow otomatis, serta server MCP yang mengekspos tool analitik.

## Fitur
- **Weather agent & workflow**: memanggil OpenRouter LLM + Open-Meteo untuk rekomendasi aktivitas berbasis cuaca.
- **Analytics agent & workflow**: rangkum performa Stripe, PayPal, dan GA4 (BigQuery) dengan guardrail agar tidak berhalusinasi.
- **MCP server**: mengekspor tool analitik (Stripe) dan agent analitik untuk diintegrasikan dengan client MCP lain.
- **Utilitas**: konversi mata uang (exchangerate.host), info zona waktu, dan penyimpanan memori LibSQL.

## Prasyarat
- Node.js >= 20.9
- NPM
- Kredensial API: OpenRouter, Stripe, PayPal, dan service account GCP dengan akses ke tabel BigQuery events.

## Setup lingkungan
1) Duplikasi contoh env: `cp .env.example .env.development` (atau `.env.staging`/`.env.production`).
2) Lengkapi variabel sesuai kebutuhan: file `.env.<APP_ENV>` akan otomatis dipilih oleh `APP_ENV` (default `development`).
3) `GOOGLE_CLOUD_CREDENTIALS` diisi JSON service account dalam satu baris; ganti `\n` pada private key dengan `\\n`.

Variabel penting:
- `APP_ENV`: memilih file `.env.<APP_ENV>`.
- **OpenRouter**: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL_DEFAULT`, override opsional untuk agent/scorer.
- **Stripe**: `STRIPE_API_KEY`, `STRIPE_BASE_URL` (opsional; default API Stripe).
- **PayPal**: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_BASE_URL` (sandbox/production).
- **FX**: `FX_BASE_URL` (default exchangerate.host).
- **BigQuery GA4**: `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_CLOUD_CREDENTIALS`, `BIGQUERY_EVENTS_TABLE`, `BIGQUERY_DEV_EVENTS_TABLE`.

## Menjalankan
- Instal dependensi: `npm install`
- Mode pengembangan Mastra: `npm run dev`
- Build: `npm run build`
- Setelah build, start: `npm start`

Catatan: penyimpanan observability menggunakan `:memory:` secara default; update di `src/mastra/index.ts` jika perlu persistensi.
