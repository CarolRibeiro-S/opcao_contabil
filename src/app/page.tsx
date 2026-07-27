import Header from '@/components/home/Header'
import Hero from '@/components/home/Hero'
import Services from '@/components/home/Services'
import Diferencial from '@/components/home/Diferencial'
import Sobre from '@/components/home/Sobre'
import Contato from '@/components/home/Contato'
import Footer from '@/components/home/Footer'
import ChatBubble from '@/components/home/ChatBubble'
import ScrollReveal from '@/components/home/ScrollReveal'

export default function Home() {
  return (
    <>
      <Header />
      <Hero />
      <Services />
      <Diferencial />
      <Sobre />
      <Contato />
      <Footer />
      <ChatBubble />
      <ScrollReveal />
    </>
  )
}
