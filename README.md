# FinNote

FinNote adalah aplikasi pencatatan keuangan pribadi berbasis Vite dan React. Aplikasi ini mencakup login lokal, ringkasan keuangan, pencatatan pemasukan dan pengeluaran, wishlist dengan progres tabungan, serta dua pilihan tema minimal: Deep Ocean dan Cool Grey.

## Menjalankan lokal

```bash
npm install
npm run dev
```

### Menjalankan dengan Integrasi Bot Telegram

1. Salin file environment:
   ```bash
   cp .env.example .env
   ```
2. Buka [@BotFather](https://t.me/botfather) di Telegram, buat bot baru dengan perintah `/newbot`, lalu masukkan token bot ke file `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=token_dari_botfather
   ```
3. Jalankan server bot:
   ```bash
   npm run bot
   ```
   Atau jalankan Web dan Bot secara bersamaan:
   ```bash
   npm run dev:all
   ```

### Format Catat Transaksi via Telegram

- `Kopi 25k` (Pengeluaran Makan & Minum)
- `Makan siang 35.000`
- `Bensin 50rb` (Pengeluaran Transportasi)
- `Beli baju 150000` (Pengeluaran Belanja)
- `Listrik 120k` (Pengeluaran Tagihan)
- `Gaji 5jt` atau `+1.5jt freelance` (Pemasukan)
- `/saldo` (Cek ringkasan saldo & pengeluaran)
- `/rekap` (Cek transaksi hari ini)

## Build produksi

```bash
npm run build
```

Data tersimpan di `localStorage` browser dan otomatis tersinkronisasi dengan server bot saat aktif.

