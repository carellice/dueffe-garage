import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { updateSettings } from '../lib/store.ts'
import { Amber, Cream, Ember, Gold, Muted, alpha } from '../lib/theme.ts'
import { GradientButton, Icon, Pressable, TextButton } from '../components/ui.tsx'
import { fastOutSlowIn, spring, tween } from '../components/motion.ts'

const slides = [
  { title: 'Il tuo garage,\nsempre con te.', body: 'Auto, manutenzioni, documenti e scadenze in un unico spazio privato.', icon: 'garage-nav' },
  { title: 'Ogni auto ha\nla sua storia.', body: 'Conserva targa, chilometri, foto e appunti nella scheda del veicolo.', icon: 'car' },
  { title: 'Interventi sotto\ncontrollo.', body: 'Registra tagliandi, revisione, bollo, assicurazione e altri lavori.', icon: 'wrench' },
  { title: 'Documenti e\nscadenze.', body: 'Archivia i file sul tuo server di casa e consulta i promemoria quando vuoi.', icon: 'calendar-nav' },
  { title: 'Pronto a partire.', body: 'I dati restano disponibili offline. Esporta un backup per portarli con te.', icon: 'shield' },
]

/** Onboarding of HomeScreens.kt: always dark, five slides. */
export function Onboarding({ done }: { done: () => void }) {
  const [[step, dir], setStep] = useState<[number, number]>([0, 1])
  const go = (next: number) => setStep([next, next > step ? 1 : -1])
  const finish = () => { updateSettings({ onboarded: true }); done() }
  const last = step === slides.length - 1
  return (
    <div data-dark style={{
      position: 'absolute', inset: 0, background: '#09080A', color: Cream, display: 'flex', flexDirection: 'column', overflow: 'clip',
      padding: 'calc(28px + var(--safe-top)) 28px calc(28px + var(--safe-bottom))',
      ['--onAccent' as string]: '#09080A', ['--accent' as string]: `linear-gradient(to bottom right, ${Gold}, ${Amber})`,
    }}>
      <motion.div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        initial={{ opacity: 0.55 }} animate={{ opacity: 1 }} transition={{ duration: 1.6, ease: fastOutSlowIn, repeat: Infinity, repeatType: 'reverse' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle 100vw at 50% 30%, ${alpha(Gold, 0.16)}, transparent)` }} />
      </motion.div>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(circle 90vw at 0% 100%, ${alpha(Ember, 0.10)}, transparent)` }} />
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
        <img src="/garage_logo_dark.png" alt="Garage" width={44} height={44} />
        <span style={{ flex: 1 }} />
        <TextButton onClick={finish} color={alpha('#FFF8E9', 0.7)} style={{ fontWeight: 500 }}>Salta</TextButton>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <motion.div initial={{ y: -8 }} animate={{ y: 8 }} transition={{ duration: 2.2, ease: fastOutSlowIn, repeat: Infinity, repeatType: 'reverse' }}
          style={{ width: 220, height: 220, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 14, ease: 'linear', repeat: Infinity }}
            style={{ position: 'absolute', inset: 0, borderRadius: '50%', padding: 3, background: `conic-gradient(from 90deg, ${Gold}, ${Amber}, ${Ember}, transparent, ${Gold})`,
              WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))', mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))' }} />
          <div style={{ position: 'absolute', width: 170, height: 170, borderRadius: '50%', background: 'radial-gradient(closest-side, #2A2318, #110E0A)' }} />
          <AnimatePresence initial={false}>
            <motion.div key={step} style={{ position: 'absolute', color: Gold, display: 'flex' }}
              initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1, transition: { scale: spring(0.5, 200), opacity: tween(220) } }}
              exit={{ opacity: 0, transition: tween(120) }}>
              <Icon name={slides[step].icon} size={84} />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
      <div style={{ position: 'relative', minHeight: 41 * 2 + 12 + 14 + 44 + 24 }}>
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div key={step} custom={dir}
            variants={{
              enter: (d: number) => ({ x: d > 0 ? '33%' : '-33%', opacity: 0 }),
              center: { x: 0, opacity: 1, transition: { x: spring(0.85, 200), opacity: tween(260) } },
              exit: (d: number) => ({ x: d > 0 ? '-25%' : '25%', opacity: 0, transition: { x: tween(200), opacity: tween(160) } }),
            }}
            initial="enter" animate="center" exit="exit">
            <div style={{ color: Gold, letterSpacing: 2, fontWeight: 900, fontSize: 12 }}>0{step + 1} / 05</div>
            <div style={{ height: 12 }} />
            <div style={{ color: Cream, fontSize: 38, fontWeight: 900, lineHeight: '41px', letterSpacing: -0.8, whiteSpace: 'pre-line' }}>{slides[step].title}</div>
            <div style={{ height: 14 }} />
            <div style={{ color: Muted, fontSize: 16, lineHeight: '22px', minHeight: 44 }}>{slides[step].body}</div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div style={{ height: 26 }} />
      <div role="tablist" style={{ display: 'flex', gap: 6, alignItems: 'center', position: 'relative' }}>
        {slides.map((_, i) => (
          <motion.div key={i} animate={{ width: i === step ? 28 : 8 }} transition={spring(0.6, 1500)} style={{ height: 8, borderRadius: 4, overflow: 'hidden' }}>
            <Pressable role="tab" selected={i === step} ripple={false} onClick={() => go(i)} style={{ width: '100%', height: 8, background: i === step ? `linear-gradient(to right, ${Gold}, ${Amber})` : alpha(Muted, 0.35) }} />
          </motion.div>
        ))}
      </div>
      <div style={{ height: 22 }} />
      <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
        <AnimatePresence initial={false}>
          {step > 0 && (
            <motion.div key="back" initial={{ width: 0, opacity: 0 }} animate={{ width: 'auto', opacity: 1, transition: { width: spring(0.8, 1500), opacity: tween(150) } }}
              exit={{ width: 0, opacity: 0, transition: tween(180) }} style={{ overflow: 'hidden', flex: 'none' }}>
              <Pressable pressed={1} onClick={() => go(step - 1)} style={{ height: 56, borderRadius: 28, border: `1px solid ${alpha('#FFF8E9', 0.25)}`, color: Cream, padding: '0 24px', display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 700, letterSpacing: 0.2, whiteSpace: 'nowrap' }}>
                Indietro
              </Pressable>
            </motion.div>
          )}
        </AnimatePresence>
        <GradientButton onClick={() => (last ? finish() : go(step + 1))} height={56} shine={last} style={{ flex: 1 }}>
          <span style={{ fontSize: 16, fontWeight: 900 }}>{last ? 'Inizia subito' : 'Continua'}</span>
          <span style={{ width: 6 }} />
          <Icon name="chevron-right" size={20} />
        </GradientButton>
      </div>
    </div>
  )
}
