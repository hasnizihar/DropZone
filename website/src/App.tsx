import React from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { Showcase } from './components/Showcase';
import { Features } from './components/Features';
import { HowItWorks } from './components/HowItWorks';
import { OpenSource } from './components/OpenSource';
import { FAQ } from './components/FAQ';
import { CTA } from './components/CTA';
import { Footer } from './components/Footer';

export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-brand-black text-brand-white flex flex-col font-sans selection:bg-brand-lime selection:text-brand-black">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Showcase />
        <Features />
        <HowItWorks />
        <OpenSource />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default App;
