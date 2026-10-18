"""Komponiert die eigene Hintergrundmusik für Oida Leberkas: verspielte Spieluhr in Dur mit leichtem Bass und Takt.

Alles hier ist selbst erzeugt (Sinus-Synthese), daher frei von fremden Rechten.
Aufruf: python3 musik_generator.py   -> schreibt musik/*.mp3 und musik.json
"""
import json
import subprocess
import wave
from pathlib import Path

import numpy as np

HIER = Path(__file__).parent
RATE = 44100
DAUER = 32.0

# Name, Stimmung, Grundton (Hz), Tempo (Schläge pro Minute), Tonleiter-Schritte (Moll-Varianten), Zufallssamen, Regen
STUECKE = [
    ("spieluhr-mitternacht", "verspielt, cute, Spieluhr um Mitternacht", 293.7, 112, [0, 2, 4, 5, 7, 9, 11], 1, False),
    ("regen-am-fenster", "gemütlich, verträumt, Regen draußen", 261.6, 92, [0, 2, 4, 7, 9, 12, 14], 2, True),
    ("friedhof-im-nebel", "neckisch, augenzwinkernd spukig", 329.6, 120, [0, 2, 3, 4, 7, 9, 10], 3, False),
    ("kerzenlicht", "warm, ruhig, Tagebuch bei Kerzenlicht", 349.2, 88, [0, 2, 4, 5, 7, 9, 11], 4, False),
    ("vollmond", "theatralisch, fröhlich, großer Auftritt", 392.0, 126, [0, 2, 4, 6, 7, 9, 11], 5, False),
    ("letzte-semmel", "bittersüß, sehnsüchtig, aber mit Lächeln", 311.1, 100, [0, 2, 4, 5, 7, 9, 10], 6, False),
]

def ton(freq, laenge, abklingen=2.5):
    t = np.arange(int(laenge * RATE)) / RATE
    huelle = np.exp(-t * abklingen) * np.minimum(1, t * 400)
    # Spieluhr: Grundton plus helle, unharmonische Obertöne
    return huelle * (np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2.76 * t) + 0.12 * np.sin(2 * np.pi * freq * 5.4 * t))


def teppich(grund, n):
    t = np.arange(n) / RATE
    schwebung = 0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * t)
    akkord = sum(np.sin(2 * np.pi * f * t + p) for f, p in [(grund / 2, 0), (grund / 2 * 1.26, 1.3), (grund / 2 * 1.498, 2.1)])
    return 0.05 * akkord * (0.6 + 0.4 * schwebung)


def hall(x, verzoegerungen=(0.113, 0.171, 0.257, 0.343), rueck=0.45):
    y = x.copy()
    for d in verzoegerungen:
        k = int(d * RATE)
        z = np.zeros_like(x)
        z[k:] = x[:-k] * rueck
        for _ in range(3):
            z[k:] += z[:-k] * rueck * 0.5
        y += z * 0.5
    return y


def takt(grund, schlag, n):
    """Kurzer, weicher Bass auf jedem Schlag (Grundton, Quinte im Wechsel) und ein leises Klicken dazwischen."""
    spur = np.zeros(n)
    pos, i = 0.5, 0
    while pos < DAUER - 2:
        s = int(pos * RATE)
        f = grund / 2 * (1.498 if i % 4 == 2 else 1.0)
        note = ton(f, 0.35, abklingen=9) * 0.45
        e = min(n, s + len(note))
        spur[s:e] += note[: e - s]
        k = int((pos + schlag / 2) * RATE)
        klick = np.exp(-np.arange(600) / 60) * np.sin(2 * np.pi * 3200 * np.arange(600) / RATE) * 0.08
        if k + 600 < n:
            spur[k:k + 600] += klick
        pos += schlag
        i += 1
    return spur


def regen(n, rng):
    rauschen = rng.normal(0, 1, n)
    # grob tiefpassgefiltert und leise
    kern = np.ones(40) / 40
    return 0.03 * np.convolve(rauschen, kern, mode="same")


def stueck(name, stimmung, grund, tempo, skala, samen, mit_regen):
    rng = np.random.default_rng(samen)
    n = int(DAUER * RATE)
    spur = teppich(grund, n)
    schlag = 60 / tempo
    melodie = np.zeros(n)
    stufe = 0
    pos = 1.0
    # Melodie in Phrasen von 8 Noten, kleine Schritte, Phrasenende auf dem Grundton
    while pos < DAUER - 3:
        for i in range(8):
            if i == 7:
                stufe = 0 if rng.random() < 0.6 else 4
            else:
                stufe = int(np.clip(stufe + rng.choice([-2, -1, 1, 1, 2, 2, 3]), 0, 11))
            oktave, idx = divmod(stufe, len(skala))
            freq = grund * 2 * 2 ** ((skala[idx] + 12 * oktave) / 12)
            laenge = schlag * (2 if i in (3, 7) else 0.5 if i in (1, 5) else 1)
            note = ton(freq, min(laenge * 2.0, 1.6), abklingen=4) * (0.55 if i % 2 else 0.7)
            s = int(pos * RATE)
            if s >= n:
                break
            e = min(n, s + len(note))
            melodie[s:e] += note[: e - s]
            pos += laenge
        pos += schlag
    spur = spur + 0.5 * hall(melodie, rueck=0.25) + takt(grund, schlag, n)
    if mit_regen:
        spur += regen(n, rng)
    t = np.arange(n) / RATE
    spur *= np.minimum(1, t / 2.0) * np.minimum(1, (DAUER - t) / 3.0)
    spur = spur / np.max(np.abs(spur)) * 0.8
    wav = HIER / "musik" / f"{name}.wav"
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes((spur * 32767).astype(np.int16).tobytes())
    mp3 = wav.with_suffix(".mp3")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ac", "2", "-b:a", "160k", str(mp3)], check=True)
    wav.unlink()
    return {"datei": mp3.name, "titel": name.replace("-", " ").title(), "stimmung": stimmung, "quelle": "selbst komponiert (musik_generator.py)", "lizenz": "eigenes Werk"}


if __name__ == "__main__":
    (HIER / "musik").mkdir(exist_ok=True)
    liste = [stueck(*s) for s in STUECKE]
    (HIER / "musik.json").write_text(json.dumps(liste, ensure_ascii=False, indent=1) + "\n")
    print("\n".join(f"{m['datei']}: {m['stimmung']}" for m in liste))
