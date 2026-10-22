# Quelle des Jingles (Variante C „Nachtcafé“, Dominiks Wahl 22.10.2026): komplett synthetisch, keine Samples, keine fremde Lizenz.
# Erzeugt drei Varianten; autopilot/assets/jingle.mp3 ist jingle-nachtcafe.mp3. Aufruf: python3 synth.py (numpy, scipy, ffmpeg).
import numpy as np, sys, subprocess
from scipy.signal import butter, sosfilt, fftconvolve
SR=44100; rng=np.random.default_rng(7)
def n2f(n): return 440*2**((n-69)/12)
NOTE={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
def m(s):  # "A4", "C#5", "Bb3"
    k=NOTE[s[0]]; i=1
    if s[i] in '#b': k+= 1 if s[i]=='#' else -1; i+=1
    return 12*(int(s[i:])+1)+k
def buf(d): return np.zeros(int(SR*d))
def lp(x,f,o=2): return sosfilt(butter(o,f,'low',fs=SR,output='sos'),x)
def hp(x,f,o=2): return sosfilt(butter(o,f,'high',fs=SR,output='sos'),x)
def add(out,x,t,g=1.0):
    i=int(t*SR); j=min(len(out),i+len(x)); out[i:j]+=g*x[:j-i]
def epiano(f,d=2.5,v=0.5):
    t=np.arange(int(SR*d))/SR; env=np.exp(-t*1.6)*(1-np.exp(-t*300))
    menv=np.exp(-t*5)
    x=np.sin(2*np.pi*f*t+1.3*menv*np.sin(2*np.pi*f*t))+0.25*np.sin(2*np.pi*2*f*t)*np.exp(-t*4)
    x2=np.sin(2*np.pi*f*1.003*t+1.1*menv*np.sin(2*np.pi*f*1.003*t))
    trem=1+0.15*np.sin(2*np.pi*4.5*t)
    return v*0.5*(x+x2)*env*trem
def bell(f,d=1.8,v=0.35):
    t=np.arange(int(SR*d))/SR
    x=sum(a*np.sin(2*np.pi*f*r*t)*np.exp(-t*k) for r,a,k in [(1,1,2.8),(2.76,0.35,6),(5.4,0.15,11),(8.93,0.06,18)])
    return v*x*(1-np.exp(-t*800))
def pad(fs,d,v=0.12):
    t=np.arange(int(SR*d))/SR; env=np.minimum(1,t/0.6)*np.minimum(1,(d-t)/0.8)
    x=sum(np.sign(np.sin(2*np.pi*f*det*t))*0.3+np.sin(2*np.pi*f*det*t) for f in fs for det in (0.997,1.004))
    return v*lp(x,1400)*env/len(fs)
def kick(v=0.9):
    t=np.arange(int(SR*0.45))/SR; f=45+80*np.exp(-t*30)
    return v*np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*9)
def snare(v=0.35):
    t=np.arange(int(SR*0.25))/SR; n=rng.standard_normal(len(t))
    return v*(lp(hp(n,900),5000)*np.exp(-t*22)+0.4*np.sin(2*np.pi*190*t)*np.exp(-t*30))
def hat(v=0.08):
    t=np.arange(int(SR*0.06))/SR; return v*hp(rng.standard_normal(len(t)),7000)*np.exp(-t*70)
def boom(v=0.9,d=1.6):
    t=np.arange(int(SR*d))/SR; f=43+25*np.exp(-t*20)
    return v*np.tanh(1.6*np.sin(2*np.pi*np.cumsum(f)/SR))*np.exp(-t*2.2)
def crackle(d,v=0.05):
    n=len(buf(d)); x=lp(rng.standard_normal(n),3000)*0.15
    idx=rng.random(n)<0.00018; x[idx]+=rng.standard_normal(idx.sum())*1.2
    return v*hp(x,500)
def reverb(x,mix=0.25,dec=1.6):
    t=np.arange(int(SR*dec))/SR; ir=rng.standard_normal(len(t))*np.exp(-t*4.5); ir=lp(ir,4000); ir/=np.abs(ir).sum()/6
    w=fftconvolve(x,ir)[:len(x)]; return (1-mix)*x+mix*w
def wobble(x,depth=0.0015,rate=0.6):
    n=np.arange(len(x)); d=depth*SR*(1+np.sin(2*np.pi*rate*n/SR))
    return np.interp(n-d,n,x)
def tapestop(x,start,dur=0.6):
    i=int(start*SR); n=int(dur*SR); out=x.copy()
    sp=np.linspace(1,0,n)**1.3; pos=i+np.cumsum(sp); pos=np.clip(pos,0,len(x)-1)
    out[i:i+n]=np.interp(pos,np.arange(len(x)),x)*np.linspace(1,0.2,n); out[i+n:]=0; return out
def finish(x,name,lpf=6500):
    x=lp(x,lpf); x=np.tanh(1.2*x)/np.tanh(1.2)
    fade=int(SR*0.5); x[-fade:]*=np.linspace(1,0,fade)**1.5
    x/=np.abs(x).max()*1.12
    st=np.stack([x,np.roll(x,int(SR*0.008))*0.96]).T
    raw=(st*32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg','-y','-loglevel','error','-f','s16le','-ar',str(SR),'-ac','2','-i','-','-af','loudnorm=I=-16:TP=-1.5:LRA=11','-ar','44100','-b:a','192k',name],input=raw,check=True)
B=60/78  # Tempo 78 bpm
def chord(out,notes,t,v=0.22,d=2.6):
    for k,s in enumerate(notes): add(out,epiano(n2f(m(s)),d,v),t+k*0.012)

# A: Lo-Fi Spieluhr. Rhodes Am9 -> Fmaj7, Spieluhr-Motiv in Moll mit Halbtonschritt, staubige Drums, Vinyl
def A():
    D=4.3; o=buf(D)
    chord(o,['A2','G3','C4','E4','B4'],0); chord(o,['F2','E3','A3','C4','G4'],2*B); chord(o,['A2','E3','G3','C4','B4'],4*B,d=1.6)
    for t,nn in [(0,'E6'),(B/2,'C6'),(B,'B5'),(1.5*B,'C6'),(2*B,'A5'),(2.75*B,'G#5'),(3*B,'A5'),(4*B,'E6')]: add(o,bell(n2f(m(nn)),v=0.22),t)
    for t in [0,1.5*B,2.5*B]: add(o,kick(0.7),t)
    for t in [B,3*B]: add(o,snare(0.28),t+0.02)
    for k in range(9): add(o,hat(0.05 if k%2 else 0.07),k*B/2+(0.03 if k%2 else 0))
    o=wobble(reverb(o,0.3)); o+=crackle(D,0.06); return o
# B: Glocke und 808. Dunkles Pad, Celesta absteigend, am Ende Tape-Stop und tiefer Boom
def B_():
    D=4.3; o=buf(D)
    add(o,pad([n2f(m(s)) for s in ['D3','F3','A3','C4']],3.0,0.16),0)
    for t,nn in [(0,'A5'),(0.38,'F5'),(0.76,'E5'),(1.14,'D5'),(1.52,'C#5'),(1.9,'D5'),(2.28,'A4')]: add(o,bell(n2f(m(nn)),v=0.26),t)
    for k in range(6): add(o,hat(0.045),k*0.38+0.19)
    add(o,kick(0.5),0); add(o,snare(0.2),0.76); add(o,kick(0.4),1.33); add(o,snare(0.2),1.52)
    o=reverb(o,0.35,2.0); o=tapestop(o,2.35,0.55)
    add(o,boom(0.85),2.95); add(o,bell(n2f(m('D6')),v=0.12,d=1.3),2.95)
    o+=crackle(D,0.05); return o
# C: Nachtcafé. E-Piano-Arpeggio Dm9 mit Swing, Besen-Hats, Schluss-Akkord rutscht müde nach unten (Schulterzucken)
def C():
    D=4.3; o=buf(D); sw=0.08
    arp=['D3','A3','C4','E4','F4','E4','C4','A3']
    for k,nn in enumerate(arp): add(o,epiano(n2f(m(nn)),1.6,0.2),k*0.3+(sw if k%2 else 0))
    for k in range(10): add(o,hat(0.05),k*0.3+(sw if k%2 else 0))
    add(o,kick(0.6),0); add(o,snare(0.22),0.6); add(o,kick(0.55),1.2); add(o,snare(0.22),1.8)
    end=buf(2.0)
    for k,s in enumerate(['Bb2','A3','D4','F4','C5']): add(end,epiano(n2f(m(s)),2.0,0.24),k*0.015)
    # müde nach unten ziehen: Tonhöhe sinkt um gut einen Halbton
    n=np.arange(len(end)); r=1-0.07*np.clip((n/SR-0.5)/1.2,0,1); pos=np.cumsum(r); end=np.interp(pos,n,end)
    add(o,end,2.4); add(o,bell(n2f(m('A5')),v=0.16),2.4)
    o=wobble(reverb(o,0.3),0.002,0.8); o+=crackle(D,0.06); return o
for f,name in [(A,'jingle-lofi-spieluhr.mp3'),(B_,'jingle-glocke-808.mp3'),(C,'jingle-nachtcafe.mp3')]:
    finish(f(),name)
print('ok')
