import { Hero } from '@/components/landing/Hero'
import { Problem } from '@/components/landing/Problem'
import { Novelties } from '@/components/landing/Novelties'
import { Pipeline } from '@/components/landing/Pipeline'
import { BeyondBaseline } from '@/components/landing/BeyondBaseline'
import { Market } from '@/components/landing/Market'
import { ProductCTA } from '@/components/landing/ProductCTA'

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <Problem />
      <Novelties />
      <Pipeline />
      <BeyondBaseline />
      <Market />
      <ProductCTA />
    </main>
  )
}
