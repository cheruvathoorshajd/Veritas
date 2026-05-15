'use client'

export function SectionLabel({ num, text }: { num: string; text: string }) {
  return (
    <div className="section-label" style={{ marginTop: 38 }}>
      <span className="num">({num})</span>
      <span style={{ textTransform: 'uppercase' }}>{text}</span>
    </div>
  )
}
