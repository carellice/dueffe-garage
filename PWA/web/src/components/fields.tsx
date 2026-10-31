import { motion } from 'framer-motion'
import { type CSSProperties, type HTMLAttributes, type ReactNode, useRef, useState } from 'react'
import { tween } from './motion.ts'

type InputMode = HTMLAttributes<HTMLInputElement>['inputMode']

/**
 * Material 3 OutlinedTextField: the label sits in the field and floats onto the border when focused
 * or filled, cutting a gap in the border. [notch] is kept for callers and no longer needed.
 */
export function OutlinedTextField({
  value, onChange, label, placeholder, leading, suffix, radius = 4, containerColor,
  multiline = false, minRows = 1, height, inputMode, type = 'text', autoComplete, unfocusedBorder = 'var(--outline)',
  textStyle, labelSize = 16, style, onFocusChange, readOnly, onClick, trailing, maxLength, enterKeyHint, onEnter, name,
}: {
  value: string; onChange?: (v: string) => void; label?: string; placeholder?: string; leading?: ReactNode; suffix?: string
  radius?: number; notch?: string; containerColor?: string; multiline?: boolean; minRows?: number; height?: number
  inputMode?: InputMode; type?: string; autoComplete?: string; unfocusedBorder?: string; textStyle?: CSSProperties
  labelSize?: number; style?: CSSProperties; onFocusChange?: (f: boolean) => void; readOnly?: boolean; onClick?: () => void
  trailing?: ReactNode; maxLength?: number; enterKeyHint?: 'done' | 'go' | 'next' | 'search' | 'send'; onEnter?: () => void; name?: string
}) {
  const [focused, setFocused] = useState(false)
  const input = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const floating = focused || value !== '' || (!!placeholder && focused)
  const borderColor = focused ? 'var(--primary)' : unfocusedBorder
  const startPad = leading ? 52 : 16
  const common = {
    ref: input, className: 'field-input', value, 'aria-label': label ?? placeholder, readOnly, maxLength, name, autoComplete, enterKeyHint,
    placeholder: floating || !label ? placeholder : undefined,
    onChange: (e: { target: { value: string } }) => onChange?.(e.target.value),
    onFocus: () => { setFocused(true); onFocusChange?.(true) },
    onBlur: () => { setFocused(false); onFocusChange?.(false) },
    style: { ...textStyle },
  }
  return (
    <div onClick={() => { onClick?.(); if (!readOnly) input.current?.focus() }}
      style={{
        position: 'relative', minHeight: 56, height, borderRadius: radius, background: containerColor,
        display: 'flex', alignItems: multiline ? 'stretch' : 'center', cursor: onClick ? 'pointer' : 'text', ...style,
      }}>
      {/* The border, cut under the floating label like Material's notch. */}
      <fieldset aria-hidden style={{
        position: 'absolute', inset: '-5px 0 0', margin: 0, padding: '0 11px', borderRadius: radius, pointerEvents: 'none', minWidth: 0,
        border: `${focused ? 2 : 1}px solid ${borderColor}`, transition: 'border-color 150ms', textAlign: 'left',
      }}>
        {label && (
          <legend style={{
            float: 'unset', width: 'auto', overflow: 'hidden', display: 'block', padding: 0, height: 11, fontSize: 12, visibility: 'hidden',
            whiteSpace: 'nowrap', maxWidth: floating ? '100%' : 0.01, transition: floating ? 'max-width 100ms 50ms' : 'max-width 50ms',
            marginLeft: focused ? -1 : 0,
          }}>
            <span style={{ padding: '0 4px', display: 'inline-block', letterSpacing: 0.4 }}>{label}</span>
          </legend>
        )}
      </fieldset>
      {leading && <div style={{ position: 'absolute', left: 12, top: multiline ? 16 : '50%', transform: multiline ? undefined : 'translateY(-50%)', display: 'flex' }}>{leading}</div>}
      {label && (
        <motion.span
          initial={false}
          animate={floating
            ? { top: -8, left: startPad - 4 - (leading ? 36 : 0), fontSize: 12, lineHeight: '16px' }
            : { top: multiline ? 16 : 'calc(50% - 12px)', left: startPad, fontSize: labelSize, lineHeight: '24px' }}
          transition={tween(150)}
          style={{
            position: 'absolute', padding: floating ? '0 4px' : 0,
            color: focused ? 'var(--primary)' : 'var(--onSurfaceVariant)', letterSpacing: floating ? 0.4 : 0.5,
            pointerEvents: 'none', whiteSpace: 'nowrap', maxWidth: 'calc(100% - 32px)', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
          {label}
        </motion.span>
      )}
      <div style={{ flex: 1, display: 'flex', alignItems: multiline ? 'flex-start' : 'center', padding: `${multiline ? 16 : 0}px ${trailing ? 4 : suffix ? 4 : 16}px ${multiline ? 16 : 0}px ${startPad}px`, minWidth: 0 }}>
        {multiline
          ? <textarea {...common} rows={minRows} style={{ ...common.style, height: height ? height - 32 : undefined }} />
          : <input {...common} type={type} inputMode={inputMode}
              onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.() }} />}
      </div>
      {suffix && <span style={{ color: 'var(--onSurfaceVariant)', fontSize: 13, paddingRight: 16, opacity: floating ? 1 : 0 }}>{suffix}</span>}
      {trailing && <div style={{ paddingRight: 12, display: 'flex' }}>{trailing}</div>}
    </div>
  )
}
