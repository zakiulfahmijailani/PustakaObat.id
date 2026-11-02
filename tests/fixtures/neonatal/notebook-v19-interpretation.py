# Extracted unchanged from notebook v19 cell 14 for executable narrative parity.
# Source: kalkulator_dosis_antibiotik_neonatus_v19.ipynb
# Notebook SHA256: 1042149e8a81ac48db9997c2262642b3d64324db058be0fac6cad1312003ab66
# Fragment SHA256 (excluding this header): 1e551a5b697b05e2702cac6844b025f2cc6ffd2c3eee8c2a09bb0ecc55e91fbd
# Requires the pandas namespace supplied by neonatal-notebook-oracle.py.

def _distribusi_kol(df, kol):
    if kol not in df.columns:
        return 0, 0, 0, 0
    vals = df[kol].astype(str)
    total = int((vals != "").sum())
    s = int((vals == "Sesuai").sum())
    b = int((vals == "Berlebih").sum())
    k = int((vals == "Kurang").sum())
    return total, s, b, k


def _pct(x, t):
    return (100.0 * x / t) if t else 0.0


def buat_interpretasi(records, stats):
    """Menghasilkan interpretasi naratif + kesimpulan dari hasil evaluasi & uji
    statistik. Mengembalikan daftar section: {judul, isi:[(tipe, teks)]} dengan
    tipe 'penting' (disorot), 'poin' (butir), 'sub' (subjudul), 'normal'."""
    df = pd.DataFrame(records)
    n = len(df)
    seksi = []
    if df.empty:
        return [{"judul": "Interpretasi", "isi": [("normal", "Tidak ada data valid untuk diinterpretasikan.")]}]

    def arah_kata(b, k):
        if b == 0 and k == 0:
            return "seluruhnya dalam rentang rekomendasi"
        if b > k:
            return "cenderung BERLEBIH (dosis/frekuensi lebih dari rekomendasi)"
        if k > b:
            return "cenderung KURANG (dosis/frekuensi kurang dari rekomendasi)"
        return "tersebar seimbang antara berlebih dan kurang"

    # ---------- SECTION 1: Ringkasan kesesuaian pemberian aktual ----------
    isi = [("normal", "Total " + str(n) + " pasien dianalisis. Ringkasan berikut menilai kesesuaian pemberian NYATA (aktual) terhadap perhitungan aplikasi.")]
    for jenis, kol, acuan in [("Dosis", "_ka_rs", "Pedoman RS"), ("Dosis", "_ka_lit", "Literatur"),
                              ("Frekuensi", "_kfa_rs", "Pedoman RS"), ("Frekuensi", "_kfa_lit", "Literatur")]:
        total, s, b, k = _distribusi_kol(df, kol)
        if total == 0:
            continue
        ps = _pct(s, total)
        teks = (jenis + " aktual vs " + acuan + ": " + "{0:.0f}%".format(ps) + " Sesuai "
                + "(" + str(s) + "/" + str(total) + "), " + "{0:.0f}% Berlebih, ".format(_pct(b, total))
                + "{0:.0f}% Kurang".format(_pct(k, total)) + "; " + arah_kata(b, k) + ".")
        seksi_tipe = "penting" if ps < 50 else "poin"
        isi.append((seksi_tipe, teks))
    # antibiotik dengan kesesuaian dosis terendah (vs RS)
    worst = None
    for ab in ["Gentamisin", "Amikasin", "Vankomisin"]:
        sub = df[df["Antibiotik"] == ab]
        total, s, b, k = _distribusi_kol(sub, "_ka_rs")
        if total:
            ps = _pct(s, total)
            if worst is None or ps < worst[1]:
                worst = (ab, ps, total)
    if worst:
        isi.append(("penting", "Kesesuaian dosis aktual (vs RS) terendah pada " + worst[0] + " (" + "{0:.0f}%".format(worst[1]) + " sesuai, n=" + str(worst[2]) + ") -- perlu perhatian khusus pada peresepan antibiotik ini."))
    seksi.append({"judul": "1. Ringkasan Kesesuaian Pemberian Aktual", "isi": isi})

    # ---------- SECTION 2: Interpretasi uji beda aktual vs rekomendasi ----------
    def _desc(u, subjek, acuan, satuan):
        if not u or not u.get("cukup"):
            return None
        md = u.get("median_selisih", 0)
        arah = "lebih tinggi" if md > 0 else ("lebih rendah" if md < 0 else "setara")
        if u.get("signifikan"):
            return ("penting", subjek + " BERBEDA SIGNIFIKAN dari " + acuan + " (" + u.get("uji", "-") + ", p=" + "{0:.4f}".format(u["p"]) + "); median selisih " + "{0:+.3f}".format(md) + " " + satuan + " (" + arah + ").")
        return ("poin", subjek + " tidak berbeda signifikan dari " + acuan + " (p=" + "{0:.4f}".format(u["p"]) + "); median selisih " + "{0:+.3f}".format(md) + " " + satuan + ".")

    isi = [("normal", "Uji beda menilai apakah nilai AKTUAL menyimpang bermakna dari titik tengah rekomendasi aplikasi. Uji dipilih otomatis (paired t-test bila selisih normal; Wilcoxon bila tidak).")]
    ada_signif = False
    for satuan, kunci_blok, jenis in [("mg/kg", "dosis", "Dosis"), ("dosis/hari", "frekuensi", "Frekuensi")]:
        for ab, blok in stats[kunci_blok]["per_antibiotik"].items():
            for key, acuan in [("aktual_vs_RS", "rekomendasi RS"), ("aktual_vs_Literatur", "rekomendasi Literatur")]:
                d = _desc(blok.get(key), jenis + " aktual " + ab + " vs " + acuan, acuan, satuan)
                if d:
                    if d[0] == "penting":
                        ada_signif = True
                    isi.append(d)
    if not ada_signif:
        isi.append(("poin", "Secara umum tidak ditemukan perbedaan signifikan yang menonjol antara pemberian aktual dan rekomendasi (dengan ukuran sampel saat ini)."))
    seksi.append({"judul": "2. Interpretasi Uji Beda: Pemberian Aktual vs Rekomendasi Aplikasi", "isi": isi})

    # ---------- SECTION 3: RELIABILITAS APLIKASI vs HITUNG MANUAL ----------
    isi = [("normal", "Bagian ini menilai seberapa konsisten (andal) perhitungan APLIKASI dibandingkan HITUNG MANUAL tenaga kesehatan. Aplikasi memakai berat badan eksak (tanpa pembulatan); hitung manual umumnya membulatkan berat badan.")]
    for satuan, kunci_blok, jenis in [("mg/kg", "dosis", "Dosis"), ("dosis/hari", "frekuensi", "Frekuensi")]:
        n_uji = 0
        n_signif = 0
        mds = []
        detail = []
        for ab, blok in stats[kunci_blok]["per_antibiotik"].items():
            u = blok.get("manual_vs_RS")
            if u and u.get("cukup"):
                n_uji += 1
                mds.append(u.get("median_selisih", 0))
                if u.get("signifikan"):
                    n_signif += 1
                    detail.append(ab + " (p=" + "{0:.4f}".format(u["p"]) + ", selisih " + "{0:+.3f}".format(u.get("median_selisih", 0)) + " " + satuan + ")")
        if n_uji == 0:
            isi.append(("poin", jenis + ": data hitung manual tidak memadai untuk uji reliabilitas (perlu >=3 pasien per antibiotik)."))
            continue
        if n_signif == 0:
            rentang_md = "{0:+.3f} s/d {1:+.3f}".format(min(mds), max(mds)) if mds else "-"
            isi.append(("penting", jenis + ": hitung manual TIDAK berbeda signifikan dari perhitungan aplikasi (RS) pada seluruh " + str(n_uji) + " antibiotik yang diuji (median selisih " + rentang_md + " " + satuan + ") -> aplikasi ANDAL & konsisten dengan hitung manual berbasis pedoman."))
        else:
            isi.append(("penting", jenis + ": terdapat perbedaan signifikan antara hitung manual dan aplikasi pada " + str(n_signif) + " dari " + str(n_uji) + " antibiotik: " + "; ".join(detail) + " -> tinjau penyebab (mis. pembulatan berat/usia atau versi pedoman)."))
    # concordance kategorikal manual vs RS (dosis)
    total, s, b, k = _distribusi_kol(df, "_kma_rs")
    if total:
        ps = _pct(s, total)
        if ps >= 80:
            isi.append(("poin", "Secara kategorikal, " + "{0:.0f}%".format(ps) + " hasil hitung manual berada dalam rentang dosis rekomendasi aplikasi (RS) -> kesepakatan tinggi."))
        else:
            isi.append(("penting", "Secara kategorikal, hanya " + "{0:.0f}%".format(ps) + " hasil hitung manual yang PERSIS dalam rentang dosis aplikasi (RS). Karena aplikasi TIDAK membulatkan & TIDAK memberi toleransi, selisih pembulatan kecil pada hitung manual dapat terkategori Berlebih/Kurang meski secara statistik selisihnya tidak bermakna. Ini justru menunjukkan aplikasi lebih presisi terhadap berat badan aktual."))
    seksi.append({"judul": "3. Reliabilitas Aplikasi vs Hitung Manual", "isi": isi})

    # ---------- SECTION 4: Kesimpulan & tindak lanjut ----------
    isi = []
    total_d, s_d, b_d, k_d = _distribusi_kol(df, "_ka_rs")
    if total_d:
        isi.append(("poin", "Kesesuaian dosis aktual terhadap pedoman RS: " + "{0:.0f}%".format(_pct(s_d, total_d)) + " sesuai. " + ("Perlu audit/edukasi peresepan." if _pct(s_d, total_d) < 70 else "Tergolong baik.")))
    isi.append(("poin", "Aplikasi dapat dijadikan alat bantu verifikasi dosis; perhitungannya memakai berat badan eksak tanpa pembulatan. Lihat bagian 3 untuk perbandingan dengan hitung manual."))
    isi.append(("penting", "TINDAK LANJUT: fokuskan telaah pada pemberian berkategori Berlebih (risiko toksisitas) dan Kurang (risiko subterapeutik), terutama antibiotik indeks terapi sempit ini, dan konfirmasi dengan kadar obat (TDM) bila tersedia."))
    seksi.append({"judul": "4. Kesimpulan & Tindak Lanjut", "isi": isi})

    # ---------- SECTION 5: Keterbatasan ----------
    isi = [
        ("poin", "Nilai p menunjukkan kemaknaan statistik, BUKAN kemaknaan klinis; interpretasi akhir tetap memerlukan penilaian profesional."),
        ("poin", "Uji beda per antibiotik memerlukan minimal 3 pasien; kelompok dengan n<3 tidak diuji."),
        ("poin", "Titik tengah rentang dipakai sebagai acuan numerik uji beda. Kesesuaian frekuensi terhadap Pedoman RS memakai rentang interval pedoman (pedoman RS tidak membedakan usia)."),
        ("poin", "Alat ini adalah clinical decision support, BUKAN pengganti penilaian apoteker/DPJP. Rekomendasi berbasis pedoman yang diunggah & literatur yang diverifikasi; selalu cek versi terbaru."),
    ]
    seksi.append({"judul": "5. Catatan Metodologis & Keterbatasan", "isi": isi})
    # Desimal memakai koma (gaya Indonesia), mis. p=0,0103
    import re as _re
    for _s in seksi:
        _s["isi"] = [(_jenis, _re.sub(r"(?<=\d)\.(?=\d)", ",", _teks)) for _jenis, _teks in _s["isi"]]
    return seksi


