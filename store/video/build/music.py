"""Synthesizes the original 15 s soundtrack for the PaperCard promo.

120 BPM (one beat = 0.5 s) so every scene cut in promo.html (2.5, 7.0, 10.0,
12.5 s) lands on a beat. Sound effects are placed on the animation's clicks,
card entrances and the "Copied" toast.
Usage: python3 music.py out.wav
"""
import sys
import wave

import numpy as np

SR = 44100
DUR = 15.0
BEAT = 0.5
N = int(SR * DUR)
rng = np.random.default_rng(7)

mix = np.zeros((N, 2))


def note_hz(name):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[pitch] + 12 * (octave + 1) - 69) / 12)


def add(signal, start, pan=0.0, gain=1.0):
    i = int(start * SR)
    if i >= N:
        return
    signal = signal[: N - i] * gain
    left = np.cos((pan + 1) * np.pi / 4)
    right = np.sin((pan + 1) * np.pi / 4)
    mix[i : i + len(signal), 0] += signal * left
    mix[i : i + len(signal), 1] += signal * right


def t_axis(length):
    return np.arange(int(length * SR)) / SR


def lowpass(x, cutoff):
    # One-pole low-pass; cutoff may be an array for sweeps.
    cutoff = np.broadcast_to(cutoff, x.shape)
    a = 1 - np.exp(-2 * np.pi * cutoff / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def keys(freq, length=1.2):
    """Soft electric-piano pluck."""
    t = t_axis(length)
    env = np.exp(-t * 3.2) * np.minimum(1, t * 400)
    tone = (
        np.sin(2 * np.pi * freq * t)
        + 0.35 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t * 6)
        + 0.12 * np.sin(2 * np.pi * freq * 3.01 * t) * np.exp(-t * 9)
    )
    return tone * env


def bell(freq, length=1.6):
    t = t_axis(length)
    env = np.exp(-t * 2.4) * np.minimum(1, t * 800)
    return (np.sin(2 * np.pi * freq * t) + 0.4 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 5)) * env


def pad(freqs, length, attack=0.6, release=0.8):
    t = t_axis(length)
    x = np.zeros_like(t)
    for f in freqs:
        for detune in (-0.12, 0.0, 0.12):
            ff = f * 2 ** (detune / 12)
            phase = rng.uniform(0, 2 * np.pi)
            # Band-limited-ish saw from a few harmonics.
            for h in range(1, 7):
                x += np.sin(2 * np.pi * ff * h * t + phase * h) / h
    x /= len(freqs) * 3 * 2.4
    env = np.minimum(1, t / attack) * np.minimum(1, (length - t) / release)
    return lowpass(x, 1400) * np.clip(env, 0, 1)


def bass(freq, length):
    t = t_axis(length)
    env = np.minimum(1, t * 200) * np.exp(-t * 1.6) * np.clip((length - t) / 0.05, 0, 1)
    return (np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * 2 * freq * t)) * env


def kick():
    t = t_axis(0.45)
    f = 45 + 85 * np.exp(-t * 28)
    phase = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(phase) * np.exp(-t * 7.5) + 0.3 * np.exp(-t * 90) * rng.standard_normal(len(t)) * 0.3


def clap():
    t = t_axis(0.3)
    noise = rng.standard_normal(len(t))
    env = np.exp(-t * 18) * (1 + 0.6 * np.exp(-((t - 0.012) ** 2) / 1e-5))
    return highpass(lowpass(noise, 3500), 900) * env * 0.8


def hat(open_=False):
    t = t_axis(0.18 if open_ else 0.06)
    return highpass(rng.standard_normal(len(t)), 7000) * np.exp(-t * (18 if open_ else 70)) * 0.5


def click():
    t = t_axis(0.05)
    return (np.sin(2 * np.pi * 2400 * t) * 0.6 + highpass(rng.standard_normal(len(t)), 3000) * 0.5) * np.exp(-t * 160)


def whoosh(length=0.55, rising=True):
    t = t_axis(length)
    noise = rng.standard_normal(len(t))
    sweep = (400 + 5000 * (t / length) ** 2) if rising else (5000 - 4600 * (t / length))
    env = np.sin(np.pi * np.clip(t / length, 0, 1)) ** 2
    return lowpass(noise, sweep) * env * 0.9


def chime():
    out = np.zeros(int(0.9 * SR))
    for k, n in enumerate(["E6", "B6"]):
        b = bell(note_hz(n), 0.8)
        i = int(k * 0.07 * SR)
        out[i : i + len(b)] += b[: len(out) - i]
    return out * 0.5


def riser(length):
    t = t_axis(length)
    noise = rng.standard_normal(len(t))
    return lowpass(noise, 300 + 6000 * (t / length) ** 3) * (t / length) ** 2 * 0.7


# ---------------------------------------------------------------- harmony
# Chords per 2-second bar, starting at 2.5 s when the groove kicks in.
CHORDS = [
    ("F", ["F3", "A3", "C4", "E4"], "F2"),
    ("G", ["G3", "B3", "D4", "E4"], "G2"),
    ("Em", ["E3", "G3", "B3", "D4"], "E2"),
    ("Am", ["A3", "C4", "E4", "G4"], "A2"),
    ("F", ["F3", "A3", "C4", "E4"], "F2"),
]
FINAL = ["C3", "G3", "C4", "E4", "B4", "D5"]

# Intro (0-2.5 s): pad swell + bell motif + riser into the drop.
add(pad([note_hz(n) for n in ["C3", "G3", "E4", "B4"]], 2.7, attack=0.8, release=0.4), 0.0, gain=0.55)
for k, n in enumerate(["G5", "C6", "E6", "D6", "C6"]):
    add(bell(note_hz(n)), 0.1 + k * 0.25 + (0.25 if k == 4 else 0), pan=(-0.3 + 0.15 * k), gain=0.22)
add(riser(1.0), 1.5, gain=0.35)

# Groove (2.5-12.5 s)
for bar, (_, chord, root) in enumerate(CHORDS):
    start = 2.5 + bar * 2.0
    add(pad([note_hz(n) for n in chord], 2.1, attack=0.15, release=0.3), start, gain=0.28)
    # Bass: root on beat 1, octave pickup on the "and" of 3.
    add(bass(note_hz(root), 1.3), start, gain=0.55)
    add(bass(note_hz(root) * 2, 0.35), start + 1.25, gain=0.3)
    add(bass(note_hz(root), 0.45), start + 1.5, gain=0.45)
    # Arpeggiated keys in 8ths.
    pattern = [0, 2, 1, 3, 2, 1, 3, 2]
    for step, idx in enumerate(pattern):
        f = note_hz(chord[idx]) * 2
        add(keys(f, 0.9), start + step * 0.25, pan=0.35 if step % 2 else -0.35, gain=0.11)

for beat in range(20):  # 2.5 .. 12.5 s
    time = 2.5 + beat * BEAT
    add(kick(), time, gain=0.8 if beat % 2 == 0 else 0.55)
    if beat % 2 == 1:
        add(clap(), time, pan=0.05, gain=0.5)
    add(hat(), time + 0.25, pan=0.4, gain=0.35)
    if beat % 4 == 3:
        add(hat(open_=True), time + 0.25, pan=0.4, gain=0.3)
# Short fill before the outro.
for k in range(4):
    add(clap(), 12.0 + k * 0.125, gain=0.2 + 0.08 * k)
add(riser(0.9), 11.6, gain=0.3)

# Outro (12.5-15 s): big final chord, one last kick, bell sparkle, fade.
add(kick(), 12.5, gain=0.9)
add(highpass(rng.standard_normal(int(1.2 * SR)), 5000) * np.exp(-t_axis(1.2) * 3.5) * 0.35, 12.5, gain=0.6)  # cymbal
add(pad([note_hz(n) for n in FINAL], 2.5, attack=0.05, release=1.4), 12.5, gain=0.4)
add(bass(note_hz("C2"), 2.4), 12.5, gain=0.6)
for k, n in enumerate(["C5", "E5", "G5", "B5", "D6", "E6"]):
    add(keys(note_hz(n), 1.4), 12.5 + k * 0.125, pan=-0.4 + 0.16 * k, gain=0.14)
add(bell(note_hz("G6"), 1.5), 13.5, pan=0.2, gain=0.12)

# ---------------------------------------------------------------- SFX
for t0 in [3.6, 4.4, 7.6, 8.3, 11.2, 11.7]:
    add(click(), t0, pan=-0.1, gain=0.45)
for t0 in [4.5, 8.35, 11.75]:
    add(whoosh(0.5), t0 - 0.05, pan=0.3, gain=0.35)
add(chime(), 5.2, pan=0.2, gain=0.5)
for k, t0 in enumerate([12.6, 12.75, 12.9]):
    add(whoosh(0.35, rising=False), t0, pan=0.2 + 0.2 * k, gain=0.18)

# ---------------------------------------------------------------- master
# Gentle glue compression via tanh, then fade out the tail.
peak = np.max(np.abs(mix))
mix = np.tanh(mix / peak * 1.6) / np.tanh(1.6)
fade = np.ones(N)
fade_len = int(0.8 * SR)
fade[-fade_len:] = np.linspace(1, 0, fade_len) ** 1.5
fade[: int(0.01 * SR)] = np.linspace(0, 1, int(0.01 * SR))
mix *= fade[:, None]
mix *= 0.89 / np.max(np.abs(mix))  # about -1 dBFS

out = sys.argv[1] if len(sys.argv) > 1 else "music.wav"
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print("wrote", out)
