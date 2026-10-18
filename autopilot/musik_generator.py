"""Komponiert die eigene Hintergrundmusik für Oida Leberkas: düstere Spieluhr über tiefem Klangteppich.

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
    ("spieluhr-mitternacht", "verspielt, unheimlich, Spieluhr um Mitternacht", 220.0, 84, [0, 2, 3, 5, 7, 8, 11], 1, False),
    ("regen-am-fenster", "melancholisch, Regen, Einsamkeit", 196.0, 66, [0, 2, 3, 5, 7, 8, 10], 2, True),
    ("friedhof-im-nebel", "düster, weit, Nebel, Friedhof", 174.6, 58, [0, 1, 3, 5, 7, 8, 10], 3, False),
    ("kerzenlicht", "warm, ruhig, Tagebuch bei Kerzenlicht", 246.9, 72, [0, 2, 3, 5, 7, 9, 10], 4, False),
    ("vollmond", "theatralisch, dramatisch, Vollmond", 207.7, 96, [0, 2, 3, 5, 7, 8, 11], 5, False),
    ("letzte-semmel", "tragisch, Verlust, große Gefühle", 185.0, 60, [0, 2, 3, 5, 7, 8, 10], 6, True),
]


def ton(freq, laenge, abklingen=2.5):
    t = np.arange(int(laenge * RATE)) / RATE
    huelle = np.exp(-t * abklingen) * np.minimum(1, t * 400)
    # Spieluhr: Grundton plus helle, unharmonische Obertöne
    return huelle * (np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2.76 * t) + 0.12 * np.sin(2 * np.pi * freq * 5.4 * t))


def teppich(grund, n):
    t = np.arange(n) / RATE
    schwebung = 0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * t)
    akkord = sum(np.sin(2 * np.pi * f * t + p) for f, p in [(grund / 2, 0), (grund / 2 * 1.498, 1.3), (grund / 4, 2.1), (grund / 2 * 1.003, 0.4)])
    return 0.18 * akkord * (0.6 + 0.4 * schwebung)


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


def regen(n, rng):
    rauschen = rng.normal(0, 1, n)
    # grob tiefpassgefiltert und leise
    kern = np.ones(40) / 40
    return 0.05 * np.convolve(rauschen, kern, mode="same")


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
                stufe = int(np.clip(stufe + rng.choice([-2, -1, -1, 1, 1, 2, 0]), -3, 9))
            oktave, idx = divmod(stufe, len(skala))
            freq = grund * 2 * 2 ** ((skala[idx] + 12 * oktave) / 12)
            laenge = schlag * (2 if i in (3, 7) else 1)
            note = ton(freq, min(laenge * 2.5, 3.0)) * (0.55 if i % 2 else 0.7)
            s = int(pos * RATE)
            if s >= n:
                break
            e = min(n, s + len(note))
            melodie[s:e] += note[: e - s]
            pos += laenge
        pos += schlag
    spur = spur + 0.5 * hall(melodie)
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
