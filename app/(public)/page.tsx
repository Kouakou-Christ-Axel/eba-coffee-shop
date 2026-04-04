import HeroSection from '@/components/(public)/accueil/hero-section';
import IncontournablesSection from '@/components/(public)/accueil/incontournables-section';
import UniversEbaSection from '@/components/(public)/accueil/univers-eba-section';
import PlaceSection from '@/components/(public)/accueil/place-section';
import SocialSection from '@/components/(public)/accueil/social-section';
import FindUsSection from '@/components/(public)/accueil/find-us-section';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <IncontournablesSection />
      <UniversEbaSection />
      <PlaceSection />
      <FindUsSection />
      <SocialSection />
    </>
  );
}
