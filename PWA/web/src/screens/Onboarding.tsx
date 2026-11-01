import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Bouncy, GradientButton, Icon, Tap } from '../components/ui.tsx'
import { fastOutSlowIn, spring, Stiffness, tween } from '../components/motion.ts'
import { Amber, Black, Cream, Ember, Gold, Muted, alpha } from '../lib/theme.ts'
import type { IconName } from '../lib/icons.gen.ts'

const slides: { title: string; body: string; icon: IconName }[] = [
  { title: 'Il tuo garage,\nsempre con te.', body: 'Auto, manutenzioni, documenti e scadenze in un unico spazio privato.', icon: 'garageNav' },
  { title: 'Ogni auto ha\nla sua storia.', body: 'Conserva targa, chilometri, foto e appunti nella scheda del veicolo.', icon: 'car' },
  { title: 'Interventi sotto\ncontrollo.', body: 'Registra tagliandi, revisione, bollo, assicurazione e altri lavori.', icon: 'wrench' },
  { title: 'Documenti e\nscadenze.', body: 'Archivia i file sul tuo server e consulta i promemoria quando vuoi.', icon: 'calendarNav' },
  { title: 'Pronto a partire.', body: "I dati restano disponibili anche offline. Esporta un backup per portarli con te.", icon: 'shield' },
]

/** Onboarding of HomeScreens.kt: always dark, five slides. */
export function Onboarding({ done }: { done: () => void }) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const go = (next: number) => { setDirection(next > step ? 1 : -1); setStep(next) }
  const last = step === slides.length - 1
  return (
    <div className="layer" style={{ background: Black, color: Cream, ['--onAccent' as string]: Black, ['--accentA' as string]: Gold, ['--accentB' as string]: Amber, containerType: 'size' }}>
      <motion.div aria-hidden style={{ position: 'absolute', left: '50cqw', top: '30cqh', width: '200cqw', height: '200cqw', marginLeft: '-100cqw', marginTop: '-100cqw', borderRadius: '50%',
        background: `radial-gradient(closest-side, ${alpha(Gold, 0.16)}, transparent)` }}
        initial={{ opacity: 0.55 }} animate={{ opacity: 1 }} transition={{ duration: 1.6, ease: fastOutSlowIn, repeat: Infinity, repeatType: 'reverse' }} />
      <div aria-hidden style={{ position: 'absolute', left: 0, top: '100cqh', width: '180cqw', height: '180cqw', marginLeft: '-90cqw', marginTop: '-90cqw', borderRadius: '50%',
        background: `radial-gradient(closest-side, ${alpha(Ember, 0.1)}, transparent)` }} />
      <div className="status-pad nav-pad" style={{ position: 'absolute', inset: 0 }}>
        <div style={{ height: '100%', padding: 28, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/garage_logo_dark.png" alt="Garage" style={{ width: 44, height: 44 }} />
            <span style={{ flex: 1 }} />
            <Tap onClick={done} style={{ minHeight: 40, padding: '0 12px', borderRadius: 20, display: 'flex', alignItems: 'center', color: alpha(Cream, 0.7), fontSize: 14, fontWeight: 500, letterSpacing: 0.1 }}>Salta</Tap>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
            <motion.div style={{ width: 220, height: 220, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              initial={{ y: -8 }} animate={{ y: 8 }} transition={{ duration: 2.2, ease: fastOutSlowIn, repeat: Infinity, repeatType: 'reverse' }}>
              <motion.div aria-hidden style={{ position: 'absolute', inset: -1.5, borderRadius: '50%',
                background: `conic-gradient(from 90deg, ${Gold}, ${Amber}, ${Ember}, transparent, ${Gold})`,
                WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
                mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))' }}
                animate={{ rotate: 360 }} transition={{ duration: 14, ease: 'linear', repeat: Infinity }} />
              <div style={{ position: 'absolute', width: 170, height: 170, borderRadius: '50%', background: 'radial-gradient(closest-side, #2A2318, #110E0A)' }} />
              <AnimatePresence initial={false}>
                <motion.div key={step} style={{ position: 'absolute', color: Gold }}
                  initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0, transition: tween(120) }}
                  transition={{ scale: spring(0.5, Stiffness.Low), opacity: tween(220) }}>
                  <Icon name={slides[step].icon} size={84} />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>
          <div style={{ position: 'relative' }}>
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
              <motion.div key={step} custom={direction}
                variants={{
                  enter: (d: number) => ({ x: `${(d > 0 ? 1 : -1) * 33.3}%`, opacity: 0 }),
                  center: { x: 0, opacity: 1 },
                  exit: (d: number) => ({ x: `${(d > 0 ? -1 : 1) * 25}%`, opacity: 0, transition: { x: tween(200), opacity: tween(160) } }),
                }}
                initial="enter" animate="center" exit="exit"
                transition={{ x: spring(0.85, Stiffness.Low), opacity: tween(260) }}>
                <div style={{ color: Gold, letterSpacing: 2, fontWeight: 900, fontSize: 12, lineHeight: '16px' }}>{`0${step + 1} / 05`}</div>
                <div style={{ height: 12 }} />
                <div style={{ color: Cream, fontSize: 38, lineHeight: '41px', fontWeight: 900, letterSpacing: -0.8, whiteSpace: 'pre-line' }}>{slides[step].title}</div>
                <div style={{ height: 14 }} />
                <div style={{ color: Muted, fontSize: 16, lineHeight: '22px', letterSpacing: 0.5, minHeight: 44 }}>{slides[step].body}</div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div style={{ height: 26 }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {slides.map((_, i) => (
              <Bouncy key={i} role="tab" ripple={false} onClick={() => go(i)} className={i === step ? 'accent-bg' : ''}
                initial={false} animate={{ width: i === step ? 28 : 8 }} transition={spring(0.6)}
                style={{ height: 8, borderRadius: 4, background: i === step ? undefined : alpha(Muted, 0.35) }} />
            ))}
          </div>
          <div style={{ height: 22 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <AnimatePresence initial={false}>
              {step > 0 && (
                <motion.div key="back" style={{ overflow: 'hidden', flexShrink: 0 }}
                  initial={{ width: 0, opacity: 0 }} animate={{ width: 'auto', opacity: 1 }} exit={{ width: 0, opacity: 0, transition: { width: tween(180), opacity: spring() } }}
                  transition={{ width: spring(0.8), opacity: spring() }}>
                  <Tap onClick={() => go(step - 1)} style={{ height: 56, borderRadius: 28, border: `1px solid ${alpha(Cream, 0.25)}`, padding: '0 24px', display: 'flex', alignItems: 'center',
                    color: Cream, fontSize: 14, fontWeight: 500, letterSpacing: 0.1, whiteSpace: 'nowrap' }}>Indietro</Tap>
                </motion.div>
              )}
            </AnimatePresence>
            <GradientButton onClick={() => (last ? done() : go(step + 1))} height={56} shine={last} style={{ flex: 1 }}>
              <span style={{ fontSize: 16, fontWeight: 900 }}>{last ? 'Inizia subito' : 'Continua'}</span>
              <span style={{ width: 6 }} />
              <Icon name="chevronRight" size={20} />
            </GradientButton>
          </div>
        </div>
      </div>
    </div>
  )
}
