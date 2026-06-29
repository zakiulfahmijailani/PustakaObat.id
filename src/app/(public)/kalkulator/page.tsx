'use client'

import React, { useState } from 'react'
import { Calculator, AlertTriangle, Info, ChevronDown, ChevronUp, Pill } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────
type Antibiotik = 'Gentamisin' | 'Amikasin' | 'Vankomisin'

interface HasilDosis {
  antibiotik: Antibiotik
  dosis: number
  interval: string
  kategori: string
  egfr: number | null
  peringatan: string[]
}

// ── Logic: eGFR ───────────────────────────────────────────────────────────────
function hitungEgfr(tbCm: number, scr: number): number | null {
  if (tbCm === 0 || scr === 0) return null
  return Math.round(((0.45 * tbCm) / scr) * 100) / 100
}

// ── Logic: Dosis ──────────────────────────────────────────────────────────────
function dosisGentamisin(usiaGestasi: number, bb: number): Omit<HasilDosis, 'antibiotik' | 'egfr'> {
  const peringatan: string[] = []
  let dosisPkg: number, interval: string, kategori: string

  if (usiaGestasi === 0) {
    dosisPkg = 4; interval = '24 jam'; kategori = 'Tidak diketahui → aterm standar'
    peringatan.push('Usia gestasi tidak tersedia. Menggunakan dosis aterm standar (4 mg/kg/24 jam).')
  } else if (usiaGestasi < 29) {
    dosisPkg = 5; interval = '48 jam'; kategori = 'Prematur ekstrem (< 29 minggu)'
  } else if (usiaGestasi <= 36) {
    dosisPkg = 4.5; interval = '36 jam'; kategori = 'Prematur (29–36 minggu)'
  } else {
    dosisPkg = 4; interval = '24 jam'; kategori = 'Aterm (> 36 minggu)'
  }
  return { dosis: Math.round(dosisPkg * bb * 100) / 100, interval, kategori, peringatan }
}

function dosisAmikasin(usiaGestasi: number, bb: number): Omit<HasilDosis, 'antibiotik' | 'egfr'> {
  const peringatan: string[] = []
  let interval: string, kategori: string

  if (usiaGestasi === 0) {
    interval = '24 jam'; kategori = 'Tidak diketahui → aterm standar'
    peringatan.push('Usia gestasi tidak tersedia. Menggunakan dosis aterm standar (15 mg/kg/24 jam).')
  } else if (usiaGestasi < 29) {
    interval = '48 jam'; kategori = 'Prematur ekstrem (< 29 minggu)'
  } else if (usiaGestasi <= 36) {
    interval = '36 jam'; kategori = 'Prematur (29–36 minggu)'
  } else {
    interval = '24 jam'; kategori = 'Aterm (> 36 minggu)'
  }
  return { dosis: Math.round(15 * bb * 100) / 100, interval, kategori, peringatan }
}

function dosisVankomisin(usiaGestasi: number, bb: number, scr: number): Omit<HasilDosis, 'antibiotik' | 'egfr'> {
  const peringatan: string[] = []
  let dosisPkg: number, interval: string, kategori: string

  if (usiaGestasi === 0) {
    dosisPkg = 15; kategori = 'Tidak diketahui → standar (≥29 minggu)'
    peringatan.push('Usia gestasi tidak tersedia. Menggunakan dosis standar (15 mg/kg).')
  } else if (usiaGestasi < 29) {
    dosisPkg = 10; kategori = 'Prematur ekstrem (< 29 minggu)'
  } else {
    dosisPkg = 15; kategori = 'Prematur/Aterm (≥ 29 minggu)'
  }

  if (scr === 0) {
    interval = '12 jam'
    peringatan.push('Serum Kreatinin tidak tersedia. Menggunakan interval default 12 jam.')
  } else if (scr > 1.2) {
    interval = '24 jam'
    peringatan.push('SCr tinggi (> 1,2 mg/dL). Interval diperpanjang menjadi 24 jam.')
  } else {
    interval = '12 jam'
  }

  return { dosis: Math.round(dosisPkg * bb * 100) / 100, interval, kategori, peringatan }
}

// ── Tabel Referensi ───────────────────────────────────────────────────────────
const referensiData: Record<Antibiotik, { kategori: string; dosis: string; interval: string }[]> = {
  Gentamisin: [
    { kategori: 'Prematur ekstrem (< 29 minggu)', dosis: '5 mg/kg', interval: '48 jam' },
    { kategori: 'Prematur (29–36 minggu)', dosis: '4,5 mg/kg', interval: '36 jam' },
    { kategori: 'Aterm (> 36 minggu)', dosis: '4 mg/kg', interval: '24 jam' },
    { kategori: 'Usia gestasi tidak diketahui', dosis: '4 mg/kg', interval: '24 jam' },
  ],
  Amikasin: [
    { kategori: 'Prematur ekstrem (< 29 minggu)', dosis: '15 mg/kg', interval: '48 jam' },
    { kategori: 'Prematur (29–36 minggu)', dosis: '15 mg/kg', interval: '36 jam' },
    { kategori: 'Aterm (> 36 minggu)', dosis: '15 mg/kg', interval: '24 jam' },
    { kategori: 'Usia gestasi tidak diketahui', dosis: '15 mg/kg', interval: '24 jam' },
  ],
  Vankomisin: [
    { kategori: 'Prematur ekstrem (< 29 minggu)', dosis: '10 mg/kg', interval: 'Tergantung SCr' },
    { kategori: 'Prematur/Aterm (≥ 29 minggu)', dosis: '15 mg/kg', interval: 'Tergantung SCr' },
    { kategori: 'SCr normal (≤ 1,2 mg/dL)', dosis: '—', interval: '12 jam' },
    { kategori: 'SCr tinggi (> 1,2 mg/dL)', dosis: '—', interval: '24 jam' },
    { kategori: 'SCr tidak tersedia', dosis: '—', interval: '12 jam (default)' },
  ],
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function KalkulatorPage() {
  const [antibiotik, setAntibiotik] = useState<Antibiotik>('Gentamisin')
  const [bb, setBb] = useState('')
  const [usiaGestasi, setUsiaGestasi] = useState('')
  const [tinggiBadan, setTinggiBadan] = useState('')
  const [scr, setScr] = useState('')
  const [hasil, setHasil] = useState<HasilDosis | null>(null)
  const [error, setError] = useState('')
  const [showReferensi, setShowReferensi] = useState(false)

  const handleHitung = () => {
    setError('')
    setHasil(null)

    const bbNum = parseFloat(bb)
    if (!bb || isNaN(bbNum) || bbNum <= 0) {
      setError('Berat badan wajib diisi dan harus lebih dari 0 kg.')
      return
    }

    const ugNum = parseFloat(usiaGestasi) || 0
    const tbNum = parseFloat(tinggiBadan) || 0
    const scrNum = parseFloat(scr) || 0
    const egfr = hitungEgfr(tbNum, scrNum)

    let hasilDosis: Omit<HasilDosis, 'antibiotik' | 'egfr'>

    if (antibiotik === 'Gentamisin') hasilDosis = dosisGentamisin(ugNum, bbNum)
    else if (antibiotik === 'Amikasin') hasilDosis = dosisAmikasin(ugNum, bbNum)
    else hasilDosis = dosisVankomisin(ugNum, bbNum, scrNum)

    setHasil({ ...hasilDosis, antibiotik, egfr })
  }

  const handleReset = () => {
    setBb(''); setUsiaGestasi(''); setTinggiBadan(''); setScr('')
    setHasil(null); setError('')
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calculator size={22} className="text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-text font-serif">Kalkulator Dosis Antibiotik</h1>
          </div>
          <p className="text-text-muted text-sm leading-relaxed">
            Kalkulator dosis antibiotik indeks terapi sempit (NTI) untuk bayi dengan sepsis neonatorum.
            Mendukung Gentamisin, Amikasin, dan Vankomisin dengan penyesuaian usia gestasi dan fungsi ginjal.
          </p>
        </div>

        <div className="grid gap-6">
          {/* Form Card */}
          <div className="bg-surface border border-border rounded-2xl p-6">
            <h2 className="text-base font-semibold text-text mb-5 flex items-center gap-2">
              <Pill size={16} className="text-primary" />
              Data Pasien
            </h2>

            <div className="grid gap-4">
              {/* Antibiotik */}
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">
                  Antibiotik
                </label>
                <select
                  value={antibiotik}
                  onChange={(e) => { setAntibiotik(e.target.value as Antibiotik); setHasil(null) }}
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                >
                  <option value="Gentamisin">Gentamisin</option>
                  <option value="Amikasin">Amikasin</option>
                  <option value="Vankomisin">Vankomisin</option>
                </select>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Berat Badan */}
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">
                    Berat Badan (kg) <span className="text-error">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={bb}
                    onChange={(e) => setBb(e.target.value)}
                    placeholder="cth: 1.5"
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-text text-sm placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>

                {/* Usia Gestasi */}
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">
                    Usia Gestasi (minggu)
                    <span className="text-text-muted font-normal ml-1">opsional</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="45"
                    value={usiaGestasi}
                    onChange={(e) => setUsiaGestasi(e.target.value)}
                    placeholder="cth: 32"
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-text text-sm placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>

                {/* Tinggi Badan */}
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">
                    Tinggi Badan (cm)
                    <span className="text-text-muted font-normal ml-1">opsional</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={tinggiBadan}
                    onChange={(e) => setTinggiBadan(e.target.value)}
                    placeholder="cth: 45"
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-text text-sm placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>

                {/* Serum Kreatinin */}
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">
                    Serum Kreatinin (mg/dL)
                    <span className="text-text-muted font-normal ml-1">opsional</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={scr}
                    onChange={(e) => setScr(e.target.value)}
                    placeholder="cth: 0.8"
                    className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-text text-sm placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-error/10 border border-error/20 text-sm text-error">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleHitung}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm"
                >
                  <Calculator size={16} />
                  Hitung Dosis
                </button>
                <button
                  onClick={handleReset}
                  className="px-5 py-2.5 rounded-xl border border-border text-text-muted text-sm font-medium hover:bg-surface-2 transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Hasil */}
          {hasil && (
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="bg-primary/[0.08] border-b border-border px-6 py-4">
                <h2 className="text-base font-semibold text-text font-serif">Hasil Rekomendasi Dosis</h2>
                <p className="text-xs text-text-muted mt-0.5">{hasil.antibiotik} · {hasil.kategori}</p>
              </div>

              <div className="p-6 grid gap-4">
                {/* Dosis Utama */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-primary/[0.08] border border-primary/20">
                    <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">Dosis</p>
                    <p className="text-3xl font-bold text-primary">{hasil.dosis} <span className="text-lg font-normal">mg</span></p>
                    <p className="text-xs text-text-muted mt-1">dosis tunggal per pemberian</p>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-2 border border-border">
                    <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1">Interval</p>
                    <p className="text-2xl font-bold text-text">Tiap {hasil.interval}</p>
                    <p className="text-xs text-text-muted mt-1">frekuensi pemberian</p>
                  </div>
                </div>

                {/* eGFR */}
                {hasil.egfr !== null && (
                  <div className="p-4 rounded-xl bg-info/[0.08] border border-info/20">
                    <p className="text-xs font-medium text-info uppercase tracking-wider mb-1">eGFR (Schwartz)</p>
                    <p className="text-xl font-bold text-text">{hasil.egfr} <span className="text-sm font-normal text-text-muted">mL/min/1.73m²</span></p>
                    <p className="text-xs text-text-muted mt-1">k = 0,45 (neonatus aterm)</p>
                  </div>
                )}

                {/* Peringatan */}
                {hasil.peringatan.length > 0 && (
                  <div className="space-y-2">
                    {hasil.peringatan.map((p, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm text-warning">
                        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Disclaimer */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-surface-2 border border-border text-xs text-text-muted">
                  <Info size={14} className="mt-0.5 shrink-0 text-primary" />
                  <span>
                    Hasil ini merupakan <strong className="text-text">rekomendasi awal</strong>. Selalu konfirmasi dengan farmasis klinik atau dokter spesialis neonatologi sebelum pemberian.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tabel Referensi */}
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowReferensi(!showReferensi)}
              className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-surface-2 transition-colors"
            >
              <span className="text-sm font-semibold text-text">Protokol Dosis Referensi — {antibiotik}</span>
              {showReferensi ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
            </button>

            {showReferensi && (
              <div className="border-t border-border">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-2">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Kategori</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Dosis</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Interval</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referensiData[antibiotik].map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-surface' : 'bg-surface-2'}>
                          <td className="px-4 py-3 text-text">{row.kategori}</td>
                          <td className="px-4 py-3 text-text font-medium">{row.dosis}</td>
                          <td className="px-4 py-3 text-text">{row.interval}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {antibiotik === 'Vankomisin' && (
                  <div className="px-4 pb-4 pt-2">
                    <p className="text-xs text-text-muted">
                      <strong className="text-text">Formula eGFR Schwartz:</strong>{' '}
                      eGFR = (k × Tinggi Badan [cm]) / Serum Kreatinin [mg/dL], k = 0,45 (neonatus aterm)
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
