
import ServiceCard from '@/components/services/ServiceCard';
import { Button } from '@/components/ui/button';
import { GraduationCap, Briefcase } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <section className="text-center mb-16">
        <h1 className="text-5xl font-bold mb-4 text-primary">مرحباً بك في DigitalMen0</h1>
        <p className="text-xl text-foreground/80 max-w-2xl mx-auto mb-8">
          نقدم خدمات استشارية وتدريبية مخصصة لمساعدتك في تحقيق أهدافك الرقمية والمهنية.
        </p>
        <Button size="lg" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Link href="/request">اطلب خدمتك الآن</Link>
        </Button>
      </section>

      <section className="mb-16">
        <Image
          src="/Digital Marketing Agency.png"
          alt="Digital Marketing Agency Services"
          width={1200}
          height={400}
          className="rounded-lg shadow-lg object-cover w-full"
          data-ai-hint="digital marketing agency"
          priority // Added priority for LCP image
        />
      </section>

      <section>
        <h2 className="text-3xl font-semibold text-center mb-10 text-foreground">خدماتنا</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <ServiceCard
            title="التدريب الشخصي (Coaching)"
            description="برامج تدريبية فردية مصممة لتطوير مهاراتك وتحقيق إمكاناتك الكاملة في المجال الرقمي."
            icon={<GraduationCap className="h-12 w-12 text-accent" />}
            imageSrc="/3.png"
            imageAlt="Coaching Service Illustration"
            dataAiHint="coaching mentorship"
            serviceKey="coaching" // Added serviceKey
          />
          <ServiceCard
            title="الاستشارات (Consultation)"
            description="استشارات متخصصة لمساعدتك في التغلب على التحديات، اتخاذ قرارات استراتيجية، وتحسين أداء أعمالك الرقمية."
            icon={<Briefcase className="h-12 w-12 text-accent" />}
            imageSrc="/2.png"
            imageAlt="Consultation Service Illustration"
            dataAiHint="business consultation"
            serviceKey="consultation" // Added serviceKey
          />
        </div>
      </section>
    </div>
  );
}
