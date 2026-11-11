import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { AccentButton, Bouncy, Gauge, GhostButton, Icon, Tap } from '../components/ui.tsx'
import { fastOutSlowIn, spring, tween } from '../components/motion.ts'
import { Carbon, CarbonPanel, CarbonRaised, Frost, Ice, Steel, alpha } from '../lib/theme.ts'
import type { IconName } from '../lib/icons.gen.ts'

const slides: { title: string; body: string; icon: IconName }[] = [
  { title: 'Il tuo garage,\nsempre con te.', body: 'Auto, manutenzioni, documenti e scadenze in un unico spazio privato.', icon: 'garageNav' },
  { title: 'Ogni auto ha\nla sua storia.', body: 'Conserva targa, chilometri, foto e appunti nella scheda del veicolo.', icon: 'car' },
  { title: 'Interventi sotto\ncontrollo.', body: 'Registra tagliandi, revisione, bollo, assicurazione e altri lavori.', icon: 'wrench' },
  { title: 'Documenti e\nscadenze.', body: 'Archivia i file sul tuo server e consulta i promemoria quando vuoi.', icon: 'calendarNav' },
  { title: 'Pronto a partire.', body: "I dati restano disponibili anche offline. Esporta un backup per portarli con te.", icon: 'shield' },
]

/** Onboarding of HomeScreens.kt: always in the dark cockpit look; a speedometer gauge sweeps forward with each step. */
export function Onboarding({ done }: { done: () => void }) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const go = (next: number) => { setDirection(next > step ? 1 : -1); setStep(next) }
  const last = step === slides.length - 1
  const vars = {
    background: Carbon, color: Frost, containerType: 'size',
    ['--primary' as string]: Ice, ['--onAccent' as string]: Carbon, ['--surface' as string]: CarbonPanel, ['--onSurface' as string]: Frost,
    ['--onSurfaceVariant' as string]: Steel, ['--outline' as string]: Steel, ['--hairline' as string]: 'rgba(255,255,255,.07)',
  } as React.CSSProperties
  return (
    <div className="layer" style={vars}>
      <motion.div aria-hidden style={{ position: 'absolute', left: '50cqw', top: '32cqh', width: '180cqw', height: '180cqw', marginLeft: '-90cqw', marginTop: '-90cqw', borderRadius: '50%',
        background: `radial-gradient(closest-side, ${alpha(Ice, 0.14)}, transparent)` }}
        initial={{ opacity: 0.6 }} animate={{ opacity: 1 }} transition={{ duration: 2, ease: fastOutSlowIn, repeat: Infinity, repeatType: 'reverse' }} />
      <div className="status-pad nav-pad" style={{ position: 'absolute', inset: 0 }}>
        <div style={{ height: '100%', padding: '18px 26px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/garage_logo_dark.png" alt="Garage" style={{ width: 40, height: 40 }} />
            <span style={{ flex: 1 }} />
            <Tap onClick={done} style={{ minHeight: 40, padding: '0 12px', borderRadius: 20, display: 'flex', alignItems: 'center', color: alpha(Frost, 0.7), fontSize: 14, fontWeight: 500 }}>Salta</Tap>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
            <div style={{ position: 'relative' }}>
              <Gauge fraction={(step + 1) / slides.length} color={Ice} size={230} stroke={6}>
                <div style={{ width: 150, height: 150, borderRadius: '50%', background: `radial-gradient(closest-side, ${CarbonRaised}, ${Carbon})`, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AnimatePresence initial={false}>
                    <motion.div key={step} style={{ position: 'absolute', color: Ice }}
                      initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0, transition: tween(140) }}
                      transition={{ scale: tween(320), opacity: tween(260, fastOutSlowIn, 80) }}>
                      <Icon name={slides[step].icon} size={64} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </Gauge>
              <div className="tnum" style={{ position: 'absolute', left: 0, right: 0, bottom: 6, textAlign: 'center', fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>{`0${step + 1}`}</div>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
              <motion.div key={step} custom={direction}
                variants={{
                  enter: (d: number) => ({ x: `${(d > 0 ? 1 : -1) * 25}%`, opacity: 0 }),
                  center: { x: 0, opacity: 1 },
                  exit: (d: number) => ({ x: `${(d > 0 ? -1 : 1) * 16}%`, opacity: 0, transition: { x: tween(220), opacity: tween(160) } }),
                }}
                initial="enter" animate="center" exit="exit"
                transition={{ x: tween(360), opacity: tween(300) }}>
                <div style={{ fontSize: 36, lineHeight: '40px', fontWeight: 700, letterSpacing: -0.9, whiteSpace: 'pre-line' }}>{slides[step].title}</div>
                <div style={{ height: 12 }} />
                <div style={{ color: Steel, fontSize: 16, lineHeight: '22px', minHeight: 44 }}>{slides[step].body}</div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div style={{ height: 26 }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {slides.map((_, i) => (
              <Bouncy key={i} role="tab" ripple={false} onClick={() => go(i)}
                initial={false} animate={{ width: i === step ? 26 : 6 }} transition={spring(0.7)}
                style={{ height: 6, borderRadius: 3, background: i <= step ? Ice : alpha(Steel, 0.3) }} />
            ))}
          </div>
          <div style={{ height: 22 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <AnimatePresence initial={false}>
              {step > 0 && (
                <motion.div key="back" style={{ overflow: 'hidden', flexShrink: 0 }}
                  initial={{ width: 0, opacity: 0 }} animate={{ width: 'auto', opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={tween(220)}>
                  <GhostButton onClick={() => go(step - 1)}>Indietro</GhostButton>
                </motion.div>
              )}
            </AnimatePresence>
            <AccentButton onClick={() => (last ? done() : go(step + 1))} style={{ flex: 1 }}>
              {last ? 'Inizia' : 'Continua'}<Icon name="chevronRight" size={20} />
            </AccentButton>
          </div>
        </div>
      </div>
    </div>
  )
}
